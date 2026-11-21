import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        const record = response as Record<string, unknown>;
        if (Array.isArray(record.message)) {
          message = record.message as string[];
        } else if (typeof record.message === 'string') {
          message = record.message;
        }
        if (typeof record.error === 'string') code = record.error;
      }
    } else if (
      exception instanceof Prisma.PrismaClientKnownRequestError
    ) {
      code = exception.code;
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A resource with these unique values already exists';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'Related resource does not exist';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      message,
      error: code ?? HttpStatus[status] ?? 'Error',
      timestamp: new Date().toISOString(),
      path: req?.url ?? 'unknown',
    };

    if (status >= 500) {
      this.logger.error(
        `${req?.method ?? 'UNKNOWN'} ${req?.url ?? 'unknown'} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${req?.method ?? 'UNKNOWN'} ${req?.url ?? 'unknown'} -> ${status}: ${JSON.stringify(message)}`);
    }

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }
}
