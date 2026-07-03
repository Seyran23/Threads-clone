import * as argon2 from 'argon2';

import { UnauthorizedException } from '@/common/exceptions/app.exception';
import { UsersService } from '@/modules/users/users.service';

import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';

jest.mock('argon2');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let tokenService: jest.Mocked<TokenService>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;

  const user = {
    id: 'user-1',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    usersService = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    tokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      hashToken: jest.fn(),
    } as unknown as jest.Mocked<TokenService>;

    refreshTokenRepository = {
      create: jest.fn(),
      findByTokenHash: jest.fn(),
      markUsed: jest.fn(),
      revokeFamily: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokenRepository>;

    authService = new AuthService(usersService, tokenService, refreshTokenRepository);

    tokenService.signAccessToken.mockReturnValue('access-token');
    tokenService.signRefreshToken.mockReturnValue('refresh-token');
    tokenService.verifyAccessToken.mockReturnValue({ sub: user.id, jti: 'jti-a', exp: 1000 });
    tokenService.verifyRefreshToken.mockReturnValue({ sub: user.id, jti: 'jti-r', exp: 2000 });
    tokenService.hashToken.mockReturnValue('hashed-refresh-token');
    refreshTokenRepository.create.mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hashes the password before creating the user', async () => {
      jest.mocked(argon2.hash).mockResolvedValue('hashed-password' as never);
      usersService.createUser.mockResolvedValue(user);

      await authService.register({
        email: user.email,
        username: user.username,
        password: 'plain-password',
      });

      expect(argon2.hash).toHaveBeenCalledWith('plain-password');
      expect(usersService.createUser).toHaveBeenCalledWith({
        email: user.email,
        username: user.username,
        passwordHash: 'hashed-password',
      });
    });

    it('returns tokens and the created user', async () => {
      jest.mocked(argon2.hash).mockResolvedValue('hashed-password' as never);
      usersService.createUser.mockResolvedValue(user);

      const result = await authService.register({
        email: user.email,
        username: user.username,
        password: 'plain-password',
      });

      expect(result).toEqual({
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          accessTokenExpiresAt: new Date(1000 * 1000),
          refreshTokenExpiresAt: new Date(2000 * 1000),
        },
        user,
      });
    });

    it('persists a refresh token row for the hashed token', async () => {
      jest.mocked(argon2.hash).mockResolvedValue('hashed-password' as never);
      usersService.createUser.mockResolvedValue(user);

      await authService.register({
        email: user.email,
        username: user.username,
        password: 'plain-password',
      });

      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: user.id, tokenHash: 'hashed-refresh-token' }),
      );
    });
  });

  describe('login', () => {
    it('throws when no user exists for the email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws when the password does not match', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      jest.mocked(argon2.verify).mockResolvedValue(false as never);

      await expect(authService.login({ email: user.email, password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns tokens and the user on success', async () => {
      usersService.findByEmail.mockResolvedValue(user);
      jest.mocked(argon2.verify).mockResolvedValue(true as never);

      const result = await authService.login({ email: user.email, password: 'correct' });

      expect(result.user).toBe(user);
      expect(result.tokens.accessToken).toBe('access-token');
    });
  });

  describe('refresh', () => {
    const storedToken = {
      id: 'rt-1',
      userId: user.id,
      tokenHash: 'hashed-refresh-token',
      familyId: 'family-1',
      used: false,
      revoked: false,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    };

    it('throws when the token is not found', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(authService.refresh('unknown')).rejects.toThrow(UnauthorizedException);
    });

    it('detects reuse of an already-used token and revokes the family', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({ ...storedToken, used: true });

      await expect(authService.refresh('replayed')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith(storedToken.familyId);
    });

    it('detects reuse of an already-revoked token and re-revokes the family', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({ ...storedToken, revoked: true });

      await expect(authService.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith(storedToken.familyId);
    });

    it('throws when the stored token has expired, without revoking the family', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refresh('expired')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
    });

    it('throws when the JWT signature/expiry check fails', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(storedToken);
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('bad signature');
      });

      await expect(authService.refresh('tampered')).rejects.toThrow(UnauthorizedException);
    });

    it('marks the old token used and issues new tokens in the same family', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(storedToken);

      const result = await authService.refresh('valid-token');

      expect(refreshTokenRepository.markUsed).toHaveBeenCalledWith(storedToken.id);
      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ familyId: storedToken.familyId, userId: storedToken.userId }),
      );
      expect(result.accessToken).toBe('access-token');
    });
  });

  describe('logout', () => {
    it('is a no-op when the token is not found', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

      await authService.logout('unknown');

      expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
    });

    it('revokes the family when the token is found', async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValue({
        id: 'rt-1',
        userId: user.id,
        tokenHash: 'hashed-refresh-token',
        familyId: 'family-1',
        used: false,
        revoked: false,
        expiresAt: new Date(),
        createdAt: new Date(),
      });

      await authService.logout('valid-token');

      expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith('family-1');
    });
  });
});
