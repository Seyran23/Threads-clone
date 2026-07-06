import { Global, Module } from '@nestjs/common';

import { BullMqConnectionService } from './bullmq-connection.service';

@Global()
@Module({
  providers: [BullMqConnectionService],
  exports: [BullMqConnectionService],
})
export class BullMqModule {}
