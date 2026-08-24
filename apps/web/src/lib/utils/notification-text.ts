import type { NotificationType } from '@threads-clone/shared-types';

export function describeNotification(type: NotificationType): string {
  switch (type) {
    case 'LIKE':
      return 'liked your post';
    case 'REPLY':
      return 'replied to your post';
    case 'FOLLOW':
      return 'followed you';
    case 'FOLLOW_REQUEST':
      return 'wants to follow you';
  }
}

export const TOASTABLE_TYPES: NotificationType[] = ['FOLLOW', 'FOLLOW_REQUEST', 'REPLY'];
