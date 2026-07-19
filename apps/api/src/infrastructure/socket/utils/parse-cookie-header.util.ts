export function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (name.length > 0) {
      cookies[name] = decodeURIComponent(value);
    }
  }

  return cookies;
}
