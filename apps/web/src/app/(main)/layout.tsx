'use client';

import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useNotificationSocket } from '@/lib/hooks/use-notification-socket';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { data } = useCurrentUser();
  useNotificationSocket(!!data);

  return children;
}
