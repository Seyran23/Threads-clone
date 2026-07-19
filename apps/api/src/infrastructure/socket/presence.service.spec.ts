import { RedisService } from '@/infrastructure/redis/redis.service';

import { PresenceService } from './presence.service';

describe('PresenceService', () => {
  let presenceService: PresenceService;
  let redis: jest.Mocked<RedisService>;

  beforeEach(() => {
    redis = {
      sadd: jest.fn(),
      srem: jest.fn(),
      scard: jest.fn(),
      set: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    presenceService = new PresenceService(redis);
  });

  describe('addConnection', () => {
    it('returns true when this is the first connection (went online)', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(1);

      const wentOnline = await presenceService.addConnection('user-1', 'socket-1');

      expect(redis.sadd).toHaveBeenCalledWith('presence:connections:user-1', 'socket-1');
      expect(wentOnline).toBe(true);
    });

    it('returns false when the user already had another connection', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(2);

      const wentOnline = await presenceService.addConnection('user-1', 'socket-2');

      expect(wentOnline).toBe(false);
    });
  });

  describe('removeConnection', () => {
    it('returns true when the last connection was removed (went offline)', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(0);

      const wentOffline = await presenceService.removeConnection('user-1', 'socket-1');

      expect(redis.srem).toHaveBeenCalledWith('presence:connections:user-1', 'socket-1');
      expect(wentOffline).toBe(true);
    });

    it('returns false when other connections remain', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(1);

      const wentOffline = await presenceService.removeConnection('user-1', 'socket-1');

      expect(wentOffline).toBe(false);
    });
  });

  describe('isOnline', () => {
    it('is true when at least one connection is tracked', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(1);

      expect(await presenceService.isOnline('user-1')).toBe(true);
    });

    it('is false when no connections are tracked', async () => {
      (redis.scard as jest.Mock).mockResolvedValue(0);

      expect(await presenceService.isOnline('user-1')).toBe(false);
    });
  });

  describe('touchLastSeen', () => {
    it('sets a TTL-bound last-seen timestamp key', async () => {
      await presenceService.touchLastSeen('user-1');

      expect(redis.set).toHaveBeenCalledWith(
        'presence:lastSeen:user-1',
        expect.any(Number),
        'EX',
        90,
      );
    });
  });
});
