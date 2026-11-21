import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AuditSeverity = 'info' | 'warn' | 'high';

export interface AuditLogInput {
  actorId?: string | null;
  boardId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  severity?: AuditSeverity;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(action: string, input: AuditLogInput = {}): Promise<void> {
    const severity = input.severity ?? 'info';
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          actorId: input.actorId ?? null,
          boardId: input.boardId ?? null,
          ipAddress: input.ipAddress ?? null,
          metadata: {
            ...(input.metadata ?? {}),
            severity,
            loggedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // Auditing must never break the primary flow, but high-severity failures
      // are surfaced loudly so operators can react.
      const message = error instanceof Error ? error.message : String(error);
      if (severity === 'high') {
        this.logger.error(`Failed to persist high-severity audit event ${action}: ${message}`);
      } else {
        this.logger.warn(`Failed to persist audit event ${action}: ${message}`);
      }
    }
  }
}
