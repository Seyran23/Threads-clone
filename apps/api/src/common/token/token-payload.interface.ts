export interface TokenPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}
