import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { PinoLogger } from 'nestjs-pino';
import { Server, Socket } from 'socket.io';

import { AccessTokenService } from '@/common/token/access-token.service';
import { ACCESS_TOKEN_COOKIE } from '@/common/token/token-cookie.constants';

import { PresenceService } from './presence.service';
import {
  HEARTBEAT_EVENT,
  PRESENCE_OFFLINE_EVENT,
  PRESENCE_ONLINE_EVENT,
  PRESENCE_SUBSCRIBE_EVENT,
  PRESENCE_UNSUBSCRIBE_EVENT,
} from './socket.constants';
import { parseCookieHeader } from './utils/parse-cookie-header.util';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly presenceService: PresenceService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RealtimeGateway.name);
  }

  async handleConnection(client: Socket): Promise<void> {
    const userId = this.authenticate(client);

    if (!userId) {
      this.logger.warn({ socketId: client.id }, 'Socket auth failed, disconnecting');

      client.disconnect(true);

      return;
    }

    client.data.userId = userId;
    await client.join(this.userRoom(userId));

    const wentOnline = await this.presenceService.addConnection(userId, client.id);
    await this.presenceService.touchLastSeen(userId);

    if (wentOnline) {
      this.server.to(this.presenceRoom(userId)).emit(PRESENCE_ONLINE_EVENT, { userId });
    }

    this.logger.info({ userId, socketId: client.id }, 'Socket connected');
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const wentOffline = await this.presenceService.removeConnection(userId, client.id);

    if (wentOffline) {
      this.server.to(this.presenceRoom(userId)).emit(PRESENCE_OFFLINE_EVENT, { userId });
    }

    this.logger.info({ userId, socketId: client.id }, 'Socket disconnected');
  }

  @SubscribeMessage(HEARTBEAT_EVENT)
  async handleHeartbeat(@ConnectedSocket() client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      await this.presenceService.touchLastSeen(userId);
    }
  }

  @SubscribeMessage(PRESENCE_SUBSCRIBE_EVENT)
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() targetUserId: string,
  ): Promise<void> {
    await client.join(this.presenceRoom(targetUserId));
  }

  @SubscribeMessage(PRESENCE_UNSUBSCRIBE_EVENT)
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() targetUserId: string,
  ): Promise<void> {
    await client.leave(this.presenceRoom(targetUserId));
  }

  async emitToUser(userId: string, event: string, payload: unknown): Promise<boolean> {
    const room = this.userRoom(userId);
    const sockets = await this.server.in(room).fetchSockets();

    if (sockets.length === 0) {
      return false;
    }

    this.server.to(room).emit(event, payload);

    return true;
  }

  private authenticate(client: Socket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }

    const token = parseCookieHeader(cookieHeader)[ACCESS_TOKEN_COOKIE];
    if (!token) {
      return undefined;
    }

    try {
      return this.accessTokenService.verify(token).sub;
    } catch {
      return undefined;
    }
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private presenceRoom(userId: string): string {
    return `presence:${userId}`;
  }
}
