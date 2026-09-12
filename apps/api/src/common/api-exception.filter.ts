import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  ACTIVITY_NOT_FOUND: 404,
  DRAFT_NOT_FOUND: 404,
  EXPORT_NOT_FOUND: 404,
  PRIZE_CODE_NOT_FOUND: 404,
  REDEMPTION_NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  RECORD_CONFLICT: 409,
  ACTIVITY_LOCKED: 409,
  ACTIVITY_STARTED: 409,
  DRAW_NOT_ACTIVE: 409,
  OUT_OF_STOCK: 409,
  ACTIVITY_ENDED: 409,
  FORM_NOT_AVAILABLE: 409,
  REDEMPTION_EXPIRED: 410,
  NOT_QUALIFIED: 403,
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<{
      id?: string;
      headers?: Record<string, string>;
    }>();
    const response = http.getResponse<{
      status(code: number): { send(body: unknown): void };
    }>();
    let code = 'INTERNAL_ERROR';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof ZodError) {
      code = 'VALIDATION_ERROR';
      status = HttpStatus.BAD_REQUEST;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : (body as { message?: string | string[] }).message;
      code = Array.isArray(message)
        ? 'VALIDATION_ERROR'
        : (message ?? exception.message);
      if (!/^[A-Z][A-Z0-9_:.-]+$/.test(code)) {
        code =
          status === HttpStatus.UNAUTHORIZED
            ? 'UNAUTHORIZED'
            : status === HttpStatus.FORBIDDEN
              ? 'FORBIDDEN'
              : status >= 500
                ? 'INTERNAL_ERROR'
                : 'VALIDATION_ERROR';
      }
    } else if (
      exception instanceof Error &&
      /^[A-Z][A-Z0-9_:.-]+$/.test(exception.message)
    ) {
      code = exception.message.split(':')[0]!;
      status = statusByCode[code] ?? HttpStatus.BAD_REQUEST;
    }

    const requestId =
      request.id ?? request.headers?.['x-request-id'] ?? 'unknown';
    response.status(status).send({ code, message: code, requestId });
  }
}
