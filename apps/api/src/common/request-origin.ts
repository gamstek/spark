import { BadRequestException } from '@nestjs/common';

export interface OriginRequest {
  protocol: string;
  headers: {
    host?: string;
    'x-forwarded-host'?: string | string[];
  };
}

export function requestOrigin(request: OriginRequest): string {
  const { protocol } = request;
  const forwardedHost = request.headers['x-forwarded-host'];
  const forwardedHosts = Array.isArray(forwardedHost)
    ? forwardedHost
    : (forwardedHost?.split(',') ?? []);
  const host = forwardedHosts.at(-1)?.trim() || request.headers.host;
  if ((protocol !== 'http' && protocol !== 'https') || !host)
    throw new BadRequestException('VALIDATION_ERROR');

  try {
    const url = new URL(`${protocol}://${host}`);
    if (url.host !== host || url.pathname !== '/')
      throw new Error('invalid host');
    return url.origin;
  } catch {
    throw new BadRequestException('VALIDATION_ERROR');
  }
}
