import { Inject, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as decoding from 'lib0/decoding';
import WebSocket from 'ws';
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { ENV, type Env } from '../../common/config/env.schema';
import {
  WS_RECHECK_INTERVAL_MS,
  WS_SIZE_CHECK_INTERVAL,
  WS_TOKEN_BUCKET_CAPACITY,
  WS_TOKEN_BUCKET_REFILL_PER_SECOND,
} from '../../common/constants/limits';
import {
  revokePattern,
  roomAwarenessChannel,
  roomCommentsChannel,
  roomUpdatesChannel,
} from '../../common/constants/redis-channels';
import { ROLE_RANK, Role } from '../../common/constants/roles';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PersistenceService } from './persistence.service';
import { classifyYjsMessage, decideYjsMessageAllowance } from './rbac-filter';
import {
  encodeAwarenessMessage,
  encodeSyncReplyToStep1,
  encodeSyncStep1,
  encodeSyncStep2,
} from './yjs-protocol';

interface Room {
  boardId: string;
  doc: Y.Doc;
  awareness: Awareness;
  sockets: Set<WebSocket>;
  subscribed: boolean;
  version: number;
  updateCount: number;
}

interface SocketMeta {
  room: Room;
  userId: string;
  role: Role;
  tokens: number;
  lastRefill: number;
  lastRoleCheck: number;
  clientIds: Set<number>;
  lastViolationAt: number;
}

interface PubSubEnvelope {
  instanceId: string;
  boardId: string;
  kind: 'update' | 'awareness' | 'comment';
  framed: string;
  update?: string;
  payload?: unknown;
}

const ROOM_CHANNEL_RE = /^syncboard:revoke:([^:]+):([^:]+)$/;

@Injectable()
export class CollabService implements OnModuleDestroy {
  private readonly logger = new Logger(CollabService.name);
  private readonly instanceId = randomUUID();
  private readonly rooms = new Map<string, Room>();
  private readonly loading = new Map<string, Promise<Room>>();
  private readonly sockets = new Map<WebSocket, SocketMeta>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly permissions: PermissionsService,
    private readonly persistence: PersistenceService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {
    this.redis.sub.on('message', (channel: string, message: string) => {
      void this.onPubSubMessage(channel, message);
    });
    this.redis.sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
      void this.onRevocation(channel, message);
    });
  }

  // ------------------------------------------------------------------- rooms

  async getRoom(boardId: string): Promise<Room> {
    const existing = this.rooms.get(boardId);
    if (existing) return existing;

    const pending = this.loading.get(boardId);
    if (pending) return pending;

    const hydration = this.hydrate(boardId);
    this.loading.set(boardId, hydration);
    try {
      const room = await hydration;
      this.rooms.set(boardId, room);
      return room;
    } finally {
      this.loading.delete(boardId);
    }
  }

  private async hydrate(boardId: string): Promise<Room> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { yjsState: true, stateVersion: true },
    });
    if (!board) throw new NotFoundException('Board not found');

    const doc = new Y.Doc();
    if (board.yjsState) {
      Y.applyUpdate(doc, new Uint8Array(board.yjsState));
    }
    const awareness = new Awareness(doc);
    return {
      boardId,
      doc,
      awareness,
      sockets: new Set<WebSocket>(),
      subscribed: false,
      version: board.stateVersion,
      updateCount: 0,
    };
  }

  private async subscribe(room: Room): Promise<void> {
    if (room.subscribed) return;
    await this.redis.sub.subscribe(
      roomUpdatesChannel(room.boardId),
      roomAwarenessChannel(room.boardId),
      roomCommentsChannel(room.boardId),
    );
    await this.redis.sub.psubscribe(revokePattern(room.boardId));
    room.subscribed = true;
  }

  private async unsubscribe(room: Room): Promise<void> {
    if (!room.subscribed) return;
    await this.redis.sub.unsubscribe(
      roomUpdatesChannel(room.boardId),
      roomAwarenessChannel(room.boardId),
      roomCommentsChannel(room.boardId),
    );
    await this.redis.sub.punsubscribe(revokePattern(room.boardId));
    room.subscribed = false;
  }

  // --------------------------------------------------------------- lifecycle

  async attachSocket(
    socket: WebSocket,
    room: Room,
    userId: string,
    role: Role,
  ): Promise<void> {
    const now = Date.now();
    const meta: SocketMeta = {
      room,
      userId,
      role,
      tokens: WS_TOKEN_BUCKET_CAPACITY,
      lastRefill: now,
      lastRoleCheck: now,
      clientIds: new Set<number>(),
      lastViolationAt: 0,
    };
    this.sockets.set(socket, meta);
    room.sockets.add(socket);

    const firstClient = room.sockets.size === 1;
    if (firstClient) await this.subscribe(room);

    socket.send(Buffer.from(encodeSyncStep1(room.doc)));
    socket.send(
      Buffer.from(
        encodeAwarenessMessage(
          encodeAwarenessUpdate(room.awareness, [
            ...room.awareness.getStates().keys(),
          ]),
        ),
      ),
    );

    this.logger.log(`Client joined board ${room.boardId} as ${role}`);
  }

  async detachSocket(socket: WebSocket): Promise<void> {
    const meta = this.sockets.get(socket);
    if (!meta) return;
    const { room } = meta;

    if (meta.clientIds.size > 0) {
      removeAwarenessStates(room.awareness, [...meta.clientIds], socket);
      const update = encodeAwarenessUpdate(room.awareness, [
        ...room.awareness.getStates().keys(),
      ]);
      this.broadcastToRoom(room, Buffer.from(encodeAwarenessMessage(update)));
    }

    this.sockets.delete(socket);
    room.sockets.delete(socket);

    if (room.sockets.size === 0) {
      await this.persistence.flushNow(room.boardId);
      await this.unsubscribe(room);
      const board = await this.prisma.board.findUnique({
        where: { id: room.boardId },
        select: { stateVersion: true },
      });
      if (board) room.version = board.stateVersion;
      this.logger.log(`Last client left board ${room.boardId}; state flushed`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const room of this.rooms.values()) {
      room.awareness.destroy();
      room.doc.destroy();
    }
    this.rooms.clear();
    this.sockets.clear();
  }

  // ---------------------------------------------------------------- messages

  async handleMessage(socket: WebSocket, data: Buffer): Promise<void> {
    const meta = this.sockets.get(socket);
    if (!meta || socket.readyState !== WebSocket.OPEN) return;

    if (!this.consumeToken(meta)) {
      await this.auditViolation(meta, 'frame-flood', 'token-bucket');
      socket.close(1008, 'Message rate limit exceeded');
      return;
    }
    if (data.byteLength > this.env.MAX_WS_FRAME_BYTES) {
      await this.auditViolation(meta, 'oversized-frame', 'payload-cap');
      socket.close(1009, 'Frame too large');
      return;
    }

    const message = classifyYjsMessage(data);
    if (!message) {
      await this.auditViolation(meta, 'malformed-frame', 'unknown');
      return;
    }

    const decision = decideYjsMessageAllowance(meta.role, message);
    if (!decision.allow) {
      await this.auditViolation(meta, decision.reason ?? 'denied', message.kind);
      socket.send(
        JSON.stringify({ type: 'error', code: 'READ_ONLY', message: decision.reason }),
      );
      return;
    }

    const now = Date.now();
    if (now - meta.lastRoleCheck > WS_RECHECK_INTERVAL_MS) {
      meta.lastRoleCheck = now;
      const freshRole = await this.permissions.getRole(meta.userId, meta.room.boardId);
      if (!freshRole) {
        await this.auditViolation(meta, 'role-revoked', 'periodic-check');
        socket.close(1008, 'Access revoked');
        return;
      }
      meta.role = freshRole;
      if (message.isWrite && !this.canWrite(meta)) {
        await this.auditViolation(meta, 'read-only-role', message.kind);
        return;
      }
    }

    const { room } = meta;
    const update = message.update ?? new Uint8Array();

    if (message.kind === 'sync-step1') {
      const decoder = decoding.createDecoder(update);
      const reply = encodeSyncReplyToStep1(
        room.doc,
        decoding.readVarUint8Array(decoder),
      );
      socket.send(Buffer.from(reply));
      return;
    }

    if (message.kind === 'sync-step2' || message.kind === 'sync-update') {
      Y.applyUpdate(room.doc, update, socket);
      this.broadcastToRoom(room, data, socket);
      await this.publish(room, 'update', data, update);
      this.schedulePersistence(room);
      this.checkDocumentSize(room, socket);
      return;
    }

    if (message.kind === 'awareness') {
      const before = new Set(room.awareness.getStates().keys());
      applyAwarenessUpdate(room.awareness, update, socket);
      for (const clientId of room.awareness.getStates().keys()) {
        if (!before.has(clientId)) meta.clientIds.add(clientId);
      }
      this.broadcastToRoom(room, data, socket);
      await this.publish(room, 'awareness', data, update);
    }
  }

  private consumeToken(meta: SocketMeta): boolean {
    const now = Date.now();
    const elapsedSeconds = (now - meta.lastRefill) / 1000;
    meta.lastRefill = now;
    meta.tokens = Math.min(
      WS_TOKEN_BUCKET_CAPACITY,
      meta.tokens + elapsedSeconds * WS_TOKEN_BUCKET_REFILL_PER_SECOND,
    );
    if (meta.tokens < 1) return false;
    meta.tokens -= 1;
    return true;
  }

  private canWrite(meta: SocketMeta): boolean {
    return ROLE_RANK[meta.role] >= ROLE_RANK[Role.EDITOR];
  }

  private checkDocumentSize(room: Room, socket: WebSocket): void {
    room.updateCount += 1;
    if (room.updateCount % WS_SIZE_CHECK_INTERVAL !== 0) return;
    if (Y.encodeStateAsUpdate(room.doc).byteLength > this.env.MAX_DOCUMENT_BYTES) {
      const meta = this.sockets.get(socket);
      if (meta) void this.auditViolation(meta, 'document-size-cap', 'payload-cap');
      socket.close(1009, 'Document size limit exceeded');
    }
  }

  private broadcastToRoom(
    room: Room,
    data: Uint8Array,
    exclude?: WebSocket,
  ): void {
    const payload = Buffer.from(data);
    for (const client of room.sockets) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private schedulePersistence(room: Room): void {
    this.persistence.schedule(room.boardId, async () => {
      const board = await this.prisma.board.findUnique({
        where: { id: room.boardId },
        select: { stateVersion: true },
      });
      return {
        update: Y.encodeStateAsUpdate(room.doc),
        version: board?.stateVersion ?? room.version,
        onRemote: (remote: Uint8Array): void => {
          Y.applyUpdate(room.doc, remote, 'conflict-merge');
        },
      };
    });
  }

  private async publish(
    room: Room,
    kind: 'update' | 'awareness',
    framed: Uint8Array,
    update: Uint8Array,
  ): Promise<void> {
    const envelope: PubSubEnvelope = {
      instanceId: this.instanceId,
      boardId: room.boardId,
      kind,
      framed: Buffer.from(framed).toString('base64'),
      update: Buffer.from(update).toString('base64'),
    };
    const channel =
      kind === 'update'
        ? roomUpdatesChannel(room.boardId)
        : roomAwarenessChannel(room.boardId);
    await this.redis.pub.publish(channel, JSON.stringify(envelope));
  }

  private async onPubSubMessage(channel: string, raw: string): Promise<void> {
    let envelope: PubSubEnvelope;
    try {
      envelope = JSON.parse(raw) as PubSubEnvelope;
    } catch {
      return;
    }
    if (!envelope || envelope.instanceId === this.instanceId) return;

    const room = this.rooms.get(envelope.boardId);
    if (!room) return;

    try {
      const framed = Buffer.from(envelope.framed, 'base64');
      if (envelope.kind === 'update') {
        const update = Buffer.from(envelope.update ?? '', 'base64');
        Y.applyUpdate(room.doc, update, 'redis');
        this.broadcastToRoom(room, framed);
        this.schedulePersistence(room);
      } else if (envelope.kind === 'awareness') {
        const update = Buffer.from(envelope.update ?? '', 'base64');
        applyAwarenessUpdate(room.awareness, update, 'redis');
        this.broadcastToRoom(room, framed);
      } else if (envelope.kind === 'comment' && channel === roomCommentsChannel(room.boardId)) {
        for (const client of room.sockets) {
          if (client.readyState === WebSocket.OPEN) client.send(framed);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to apply cross-instance message: ${message}`);
    }
  }

  private async onRevocation(channel: string, raw: string): Promise<void> {
    const match = ROOM_CHANNEL_RE.exec(channel);
    if (!match) return;
    const boardId = match[1];
    const userId = match[2];
    if (!boardId || !userId) return;

    const room = this.rooms.get(boardId);
    if (!room) return;

    let newRole: Role | null = null;
    let reason = 'access-revoked';
    try {
      const payload = JSON.parse(raw) as { newRole?: string | null; reason?: string };
      if (payload.newRole && payload.newRole in ROLE_RANK) {
        newRole = payload.newRole as Role;
      }
      if (payload.reason) reason = payload.reason;
    } catch {
      // An unparsable payload still means revocation — fail closed.
    }

    for (const socket of [...room.sockets]) {
      const meta = this.sockets.get(socket);
      if (!meta || meta.userId !== userId) continue;
      if (newRole) {
        meta.role = newRole;
        socket.send(JSON.stringify({ type: 'role-changed', role: newRole, reason }));
      } else {
        await this.auditViolation(meta, reason, 'revocation-channel');
        socket.close(1008, 'Board access revoked');
      }
    }
  }

  private async auditViolation(
    meta: SocketMeta,
    reason: string,
    kind: string,
  ): Promise<void> {
    const now = Date.now();
    if (now - meta.lastViolationAt < 10_000) return;
    meta.lastViolationAt = now;
    await this.audit.log('WS_PERMISSION_VIOLATION', {
      actorId: meta.userId,
      boardId: meta.room.boardId,
      metadata: { reason, kind },
      severity: 'warn',
    });
  }

  // ------------------------------------------------------ server-side writes

  /** Apply a version-history snapshot to the live room for all connected clients. */
  async replaceBoardState(boardId: string, state: Uint8Array): Promise<boolean> {
    const room = this.rooms.get(boardId);
    if (!room) return false;

    const snapshotDoc = new Y.Doc();
    Y.applyUpdate(snapshotDoc, state);
    const before = Y.encodeStateVector(room.doc);
    const current = room.doc.getMap('elements');
    const target = snapshotDoc.getMap('elements');

    room.doc.transact(() => {
      for (const key of [...current.keys()]) {
        if (!target.has(key)) current.delete(key);
      }
      target.forEach((value, key) => {
        if (value instanceof Y.Map) {
          const copy = new Y.Map<unknown>();
          value.forEach((inner, innerKey) => copy.set(innerKey, inner));
          current.set(key, copy);
        } else {
          current.set(key, value);
        }
      });
    }, 'server-restore');

    const framed = encodeSyncStep2(room.doc, before);
    this.broadcastToRoom(room, framed);
    await this.publish(room, 'update', framed, Y.encodeStateAsUpdate(room.doc, before));
    this.schedulePersistence(room);
    return true;
  }

  broadcastComment(boardId: string, payload: unknown): void {
    const room = this.rooms.get(boardId);
    const framed = Buffer.from(JSON.stringify(payload));
    if (room) {
      for (const client of room.sockets) {
        if (client.readyState === WebSocket.OPEN) client.send(framed);
      }
    }
    const envelope: PubSubEnvelope = {
      instanceId: this.instanceId,
      boardId,
      kind: 'comment',
      framed: framed.toString('base64'),
    };
    void this.redis.pub.publish(
      roomCommentsChannel(boardId),
      JSON.stringify(envelope),
    );
  }
}
