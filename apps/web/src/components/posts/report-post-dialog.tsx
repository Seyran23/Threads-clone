'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { ReportReason } from '@threads-clone/shared-types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiError } from '@/lib/api/client';
import { reportPost } from '@/lib/api/posts';
import { cn } from '@/lib/utils';
import { removePostFromListCaches } from '@/lib/utils/optimistic-post-update';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE_SPEECH', label: 'Hate speech' },
  { value: 'VIOLENCE', label: 'Violence' },
  { value: 'NUDITY', label: 'Nudity' },
  { value: 'OTHER', label: 'Other' },
];

interface ReportPostDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportPostDialog({ postId, open, onOpenChange }: ReportPostDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<ReportReason | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      if (!reason) {
        throw new Error('No reason selected');
      }
      return reportPost(postId, reason);
    },
    onSuccess: () => {
      removePostFromListCaches(queryClient, postId);
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setReason(null);
          mutation.reset();
        }
      }}
    >
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Report post</DialogTitle>
        </DialogHeader>

        <div role="radiogroup" aria-label="Reason for reporting" className="space-y-1">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                reason === r.value && 'bg-muted font-medium',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        {mutation.isSuccess && (
          <p className="text-sm text-muted-foreground">Thanks — we've received your report.</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!reason || mutation.isPending}
          >
            {mutation.isPending ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
