import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: the process is up and able to serve requests. */
  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: PostgreSQL and Redis are both reachable. */
  @Get('ready')
  async ready(): Promise<{ status: 'ready'; checks: Record<string, 'ok'> }> {
    const checks: Record<string, 'ok'> = {};
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'PostgreSQL is not reachable',
        checks,
      });
    }
    try {
      if ((await this.redis.ping()) !== 'PONG') throw new Error('unexpected ping reply');
      checks.redis = 'ok';
    } catch {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Redis is not reachable',
        checks,
      });
    }
    return { status: 'ready', checks };
  }
}
