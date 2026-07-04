import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenService } from './access-token.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AccessTokenService],
  exports: [AccessTokenService],
})
export class TokenModule {}
