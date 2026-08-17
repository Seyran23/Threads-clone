import type { NotificationsPage } from '@threads-clone/shared-types';

import { apiFetch } from './client';
import type { GetNotificationsParams } from './notifications.types';

export function getNotifications(params: GetNotificationsParams = {}): Promise<NotificationsPage> {
  const query = new URLSearchParams();
  if (params.cursor) {
    query.set('cursor', params.cursor);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }

  const queryString = query.toString();
  return apiFetch<NotificationsPage>(`/notifications${queryString ? `?${queryString}` : ''}`);
}
