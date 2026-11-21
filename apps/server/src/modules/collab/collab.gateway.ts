import { HttpStatus, Logger, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import type { RawData, WebSocket as WsClient } from 'ws';
import { WebSocketServer } from 'ws';
import type { Role } from '@prisma/client';
import { MAX_WS_FRAME_BYTES, WS_BASE_PATH } from '../../common/constants/limits';
import { PermissionsService } from '../permissions/permissions.service';
import { CollabService } from './collab.service';
import { WsTicketService, type WsTicketPayload } from './ws-ticket.service';
import { parseBoardWsUrl } from './ws-url';

interface SocketConnectionContext {
  boardId: string;
  userId: string;
  role: Role;
}

type AuthenticatedSocket = WsClient & {
  boardContext?: SocketConnectionContext;
};

function toBuffer(data: RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (Buffer.isBuffer(data)) return data;
  return Buffer.from(data);
}

function abortUpgrade(socket: Duplex, statusCode: HttpStatus): void {
  socket.on('error', () => socket.destroy());
  socket.end(
    `HTTP/1.1 ${statusCode} ${statusCode === HttpStatus.UNAUTHORIZED ? 'Unauthorized' : 'Forbidden'}\r\n` +
      'Connection: close\r\nContent-Length: 0\r\n\r\n',
  );
}

/**
 * The Nest WsAdapter only matches exact paths. Boards use a path parameter
 * (`/ws/boards/:boardId`), so we register an additional upgrade handler on the
 * underlying HTTP server. It redeems the single-use ticket before delegating
 * the handshake to the adapter-owned WebSocketServer.
 */
@WebSocketGateway({ path: WS_BASE_PATH, maxPayload: MAX_WS_FRAME_BYTES })
export class CollabGateway
  implements
    OnGatewayInit<WebSocketServer>,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(CollabGateway.name);
  private wss!: WebSocketServer;
  private httpServer!: HttpServer;
  private upgradeHandler?: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ) => void;

  constructor(
    private readonly collab: CollabService,
    private readonly tickets: WsTicketService,
    private readonly permissions: PermissionsService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  afterInit(server: WebSocketServer): void {
    this.wss = server;
    const httpServer = this.httpAdapterHost.httpAdapter?.getHttpServer() as
      | HttpServer
      | undefined;
    if (!httpServer) return;

    this.httpServer = httpServer;
    this.upgradeHandler = (request, socket, head) => {
      const parsed = parseBoardWsUrl(request.url);
      if (!parsed) return;
      void this.authenticate(parsed.boardId, parsed.ticket, request, socket, head);
    };
    this.httpServer.on('upgrade', this.upgradeHandler);
  }

  private async authenticate(
    boardId: string,
    ticket: string,
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    let payload: WsTicketPayload | null;
    try {
      payload = await this.tickets.consume(ticket, boardId);
    } catch {
      payload = null;
    }
    if (!payload) {
      abortUpgrade(socket, HttpStatus.UNAUTHORIZED);
      return;
    }

    // Tickets contain a role snapshot; always prefer the current DB state.
    const currentRole = await this.permissions.getRole(payload.userId, boardId);
    if (!currentRole) {
      abortUpgrade(socket, HttpStatus.FORBIDDEN);
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (client) => {
      (client as AuthenticatedSocket).boardContext = {
        boardId,
        userId: payload.userId,
        role: currentRole,
      };
      this.wss.emit('connection', client, request);
    });
  }

  async handleConnection(client: unknown, request: IncomingMessage): Promise<void> {
    const socket = client as AuthenticatedSocket;
    const context =
      socket.boardContext ??
      (() => {
        const parsed = parseBoardWsUrl(request.url);
        return parsed
          ? { boardId: parsed.boardId, userId: '', role: 'VIEWER' as Role }
          : null;
      })();

    if (!context || !context.userId) {
      socket.close(1008, 'Missing or invalid WS ticket');
      return;
    }

    try {
      const room = await this.collab.getRoom(context.boardId);
      await this.collab.attachSocket(socket, room, context.userId, context.role);

      socket.on('message', (data: RawData) => {
        void this.collab.handleMessage(socket, toBuffer(data));
      });
      socket.on('error', () => {
        void this.collab.detachSocket(socket);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rejected WS client on board ${context.boardId}: ${message}`);
      socket.close(1011, 'Unable to join board');
    }
  }

  handleDisconnect(client: unknown): void {
    void this.collab.detachSocket(client as AuthenticatedSocket);
  }

  onModuleDestroy(): void {
    if (this.httpServer && this.upgradeHandler) {
      this.httpServer.off('upgrade', this.upgradeHandler);
    }
  }
}
