import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PERSIST_LOCK_TTL_MS, WS_CEILING_MS, WS_DEBOUNCE_MS } from '../../common/constants/limits';
import { persistLockKey } from '../../common/constants/redis-channels';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

export interface StateCapture {
  update: Uint8Array;
  version: number;
  /** Merge a conflicting remote snapshot back into the in-memory doc. */
  onRemote?: (remote: Uint8Array) => void;
}

export type CaptureState = () => StateCapture | Promise<StateCapture>;

const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

@Injectable()
export class PersistenceService implements OnModuleDestroy {
  private readonly logger = new Logger(PersistenceService.name);
  private readonly instanceId = randomUUID();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly dirtySince = new Map<string, number>();
  private readonly captures = new Map<string, CaptureState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Debounce writes, with a hard ceiling during continuous drawing. */
  schedule(boardId: string, capture: CaptureState): void {
    this.captures.set(boardId, capture);
    const now = Date.now();
    const since = this.dirtySince.get(boardId) ?? now;
    this.dirtySince.set(boardId, since);

    const existing = this.timers.get(boardId);
    if (existing) clearTimeout(existing);

    const delay = now - since >= WS_CEILING_MS ? 0 : WS_DEBOUNCE_MS;
    const timer = setTimeout(() => {
      this.timers.delete(boardId);
      void this.flush(boardId);
    }, delay);
    timer.unref?.();
    this.timers.set(boardId, timer);
  }

  /** Flush immediately (last editor leaving a room / shutdown). */
  async flushNow(boardId: string): Promise<void> {
    const timer = this.timers.get(boardId);
    if (timer) clearTimeout(timer);
    this.timers.delete(boardId);
    this.dirtySince.delete(boardId);
    await this.flush(boardId);
    this.captures.delete(boardId);
  }

  async flushAll(): Promise<void> {
    const boardIds = Array.from(new Set([...this.timers.keys(), ...this.captures.keys()]));
    await Promise.all(boardIds.map((boardId) => this.flushNow(boardId)));
  }

  async onModuleDestroy(): Promise<void> {
    await this.flushAll();
  }

  private async flush(boardId: string): Promise<void> {
    const capture = this.captures.get(boardId);
    if (!capture) return;

    const lockKey = persistLockKey(boardId);
    const acquired = await this.redis.client.set(
      lockKey,
      this.instanceId,
      'PX',
      PERSIST_LOCK_TTL_MS,
      'NX',
    );
    if (acquired !== 'OK') return;

    try {
      const board = await this.prisma.board.findUnique({
        where: { id: boardId },
        select: { yjsState: true, stateVersion: true },
      });
      if (!board) return;

      let snapshot = await capture();
      if (board.stateVersion !== snapshot.version && board.yjsState) {
        const remote = new Uint8Array(board.yjsState);
        if (snapshot.onRemote) {
          snapshot.onRemote(remote);
          snapshot = await capture();
        }
      }

      const written = await this.prisma.board.updateMany({
        where: { id: boardId, stateVersion: board.stateVersion },
        data: {
          yjsState: Buffer.from(snapshot.update),
          stateVersion: { increment: 1 },
          updatedAt: new Date(),
        },
      });

      if (written.count === 0) {
        // Another instance advanced the version between our read and write;
        // retry on the next debounce cycle instead of clobbering its state.
        this.dirtySince.set(boardId, Date.now() - WS_CEILING_MS);
        this.schedule(boardId, capture);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist board ${boardId}: ${message}`);
    } finally {
      await this.redis.client.eval(RELEASE_LUA, 1, lockKey, this.instanceId);
    }
  }
}
