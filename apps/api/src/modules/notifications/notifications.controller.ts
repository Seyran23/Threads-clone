import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { NotificationsService } from './notifications.service';
import { NotificationsPageResponse } from './response/notifications-page.response';

@ApiTags('notifications')
@ApiCookieAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(
    @CurrentUser() user: { id: string },
    @Query() query: GetNotificationsQueryDto,
  ): Promise<NotificationsPageResponse> {
    return this.notificationsService.getNotifications(user.id, query.cursor, query.limit);
  }
}
