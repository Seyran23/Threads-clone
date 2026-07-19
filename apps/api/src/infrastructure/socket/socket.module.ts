import { Global, Module } from '@nestjs/common';

import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';

@Global()
@Module({
  providers: [RealtimeGateway, PresenceService],
  exports: [RealtimeGateway, PresenceService],
})
export class SocketModule {}
