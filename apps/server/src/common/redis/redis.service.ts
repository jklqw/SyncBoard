import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, type Env } from '../config/env.schema';

/**
 * Three dedicated connections:
 *  - regular: commands, rate limits, tickets, locks
 *  - publisher: pub/sub publish (a subscriber connection cannot issue commands)
 *  - subscriber: pub/sub subscribe in reserved mode
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly regular: Redis;
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(@Inject(ENV) env: Env) {
    const options = {
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times: number): number => Math.min(times * 100, 3000),
    } as const;

    this.regular = new Redis(env.REDIS_URL, options);
    this.publisher = new Redis(env.REDIS_URL, options);
    this.subscriber = new Redis(env.REDIS_URL, {
      ...options,
      maxRetriesPerRequest: null,
    });

    const connections: Array<[string, Redis]> = [
      ['regular', this.regular],
      ['publisher', this.publisher],
      ['subscriber', this.subscriber],
    ];
    for (const [name, connection] of connections) {
      connection.on('error', (error: Error) => {
        this.logger.warn(`Redis ${name} connection error: ${error.message}`);
      });
      connection.on('ready', () => {
        this.logger.log(`Redis ${name} connection ready`);
      });
    }
  }

  get client(): Redis {
    return this.regular;
  }

  get pub(): Redis {
    return this.publisher;
  }

  get sub(): Redis {
    return this.subscriber;
  }

  async ping(): Promise<string> {
    return this.regular.ping();
  }

  async onModuleDestroy(): Promise<void> {
    const connections = [this.regular, this.publisher, this.subscriber];
    await Promise.all(
      connections.map(async (connection) => {
        try {
          if (connection.status === 'end') return;
          await connection.quit();
        } catch {
          connection.disconnect();
        }
      }),
    );
  }
}
