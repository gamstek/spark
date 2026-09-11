export function resolvePublicBaseUrl(
  value: string | undefined,
  environment = process.env.NODE_ENV ?? 'development',
): string {
  if (!value) {
    if (environment === 'development' || environment === 'test')
      return 'http://localhost:3000';
    throw new Error('PUBLIC_BASE_URL_REQUIRED');
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      (value !== url.origin && value !== `${url.origin}/`)
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error('PUBLIC_BASE_URL_INVALID');
  }
}
