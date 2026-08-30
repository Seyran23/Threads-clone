'use client';

import { WifiOff } from 'lucide-react';

import { useOnlineStatus } from '@/lib/hooks/use-online-status';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive/10 py-2 text-sm text-destructive"
    >
      <WifiOff className="size-4" />
      You&apos;re offline — some features won&apos;t work until you reconnect.
    </div>
  );
}
