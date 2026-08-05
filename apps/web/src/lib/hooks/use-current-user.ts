'use client';

import { useQuery } from '@tanstack/react-query';

import { fetchCurrentUser } from '@/lib/api/auth';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    retry: false,
  });
}
