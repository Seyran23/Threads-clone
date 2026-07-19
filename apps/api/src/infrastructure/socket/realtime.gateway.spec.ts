import { PinoLogger } from 'nestjs-pino';
import { Socket } from 'socket.io';

import { AccessTokenService } from '@/common/token/access-token.service';

import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let accessTokenService: jest.Mocked<AccessTokenService>;
  let presenceService: jest.Mocked<PresenceService>;
  let logger: jest.Mocked<PinoLogger>;
  let server: { to: jest.Mock; in: jest.Mock; emit: jest.Mock; fetchSockets: jest.Mock };

  const makeClient = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 'socket-1',
      handshake: { headers: { cookie: 'access_token=valid-token' } },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      ...overrides,
    }) as unknown as Socket;

  beforeEach(() => {
    accessTokenService = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1', jti: 'jti-1' }),
    } as unknown as jest.Mocked<AccessTokenService>;

    presenceService = {
      addConnection: jest.fn().mockResolvedValue(true),
      removeConnection: jest.fn().mockResolvedValue(true),
      touchLastSeen: jest.fn(),
    } as unknown as jest.Mocked<PresenceService>;

    logger = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    server = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([]),
    };

    gateway = new RealtimeGateway(accessTokenService, presenceService, logger);
    (gateway as unknown as { server: typeof server }).server = server;
  });

  describe('handleConnection', () => {
    it('authenticates via the access-token cookie, joins the user room, and tracks presence', async () => {
      const client = makeClient();

      await gateway.handleConnection(client);

      expect(accessTokenService.verify).toHaveBeenCalledWith('valid-token');
      expect(client.join).toHaveBeenCalledWith('user:user-1');
      expect(presenceService.addConnection).toHaveBeenCalledWith('user-1', 'socket-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('broadcasts presence:online when this is the first connection', async () => {
      presenceService.addConnection.mockResolvedValue(true);

      await gateway.handleConnection(makeClient());

      expect(server.to).toHaveBeenCalledWith('presence:user-1');
      expect(server.emit).toHaveBeenCalledWith('presence:online', { userId: 'user-1' });
    });

    it('does not broadcast presence:online for a second simultaneous connection', async () => {
      presenceService.addConnection.mockResolvedValue(false);

      await gateway.handleConnection(makeClient());

      expect(server.emit).not.toHaveBeenCalledWith('presence:online', expect.anything());
    });

    it('disconnects the socket when there is no cookie header', async () => {
      const client = makeClient({ handshake: { headers: {} } });

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(presenceService.addConnection).not.toHaveBeenCalled();
    });

    it('disconnects the socket when the access token is invalid', async () => {
      accessTokenService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });
      const client = makeClient();

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(presenceService.addConnection).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('broadcasts presence:offline when the last connection closes', async () => {
      const client = makeClient({ data: { userId: 'user-1' } });
      presenceService.removeConnection.mockResolvedValue(true);

      await gateway.handleDisconnect(client);

      expect(presenceService.removeConnection).toHaveBeenCalledWith('user-1', 'socket-1');
      expect(server.emit).toHaveBeenCalledWith('presence:offline', { userId: 'user-1' });
    });

    it('does not broadcast when other connections remain', async () => {
      const client = makeClient({ data: { userId: 'user-1' } });
      presenceService.removeConnection.mockResolvedValue(false);

      await gateway.handleDisconnect(client);

      expect(server.emit).not.toHaveBeenCalled();
    });

    it('does nothing when the socket never authenticated', async () => {
      const client = makeClient({ data: {} });

      await gateway.handleDisconnect(client);

      expect(presenceService.removeConnection).not.toHaveBeenCalled();
    });
  });

  describe('handleHeartbeat', () => {
    it('touches last-seen for the authenticated user', async () => {
      const client = makeClient({ data: { userId: 'user-1' } });

      await gateway.handleHeartbeat(client);

      expect(presenceService.touchLastSeen).toHaveBeenCalledWith('user-1');
    });
  });

  describe('presence subscribe/unsubscribe', () => {
    it('joins the target user presence room on subscribe', async () => {
      const client = makeClient();

      await gateway.handleSubscribe(client, 'target-user');

      expect(client.join).toHaveBeenCalledWith('presence:target-user');
    });

    it('leaves the target user presence room on unsubscribe', async () => {
      const client = makeClient();

      await gateway.handleUnsubscribe(client, 'target-user');

      expect(client.leave).toHaveBeenCalledWith('presence:target-user');
    });
  });

  describe('emitToUser', () => {
    it('returns false and does not emit when the user has no active sockets', async () => {
      server.fetchSockets.mockResolvedValue([]);

      const delivered = await gateway.emitToUser('user-1', 'notification:new', { id: 'n-1' });

      expect(delivered).toBe(false);
      expect(server.emit).not.toHaveBeenCalled();
    });

    it('emits and returns true when the user has an active socket', async () => {
      server.fetchSockets.mockResolvedValue([{ id: 'socket-1' }]);

      const delivered = await gateway.emitToUser('user-1', 'notification:new', { id: 'n-1' });

      expect(server.to).toHaveBeenCalledWith('user:user-1');
      expect(server.emit).toHaveBeenCalledWith('notification:new', { id: 'n-1' });
      expect(delivered).toBe(true);
    });
  });
});
