'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { updateProfile } from '@/lib/api/users';
import { useAvatarUpload } from '@/lib/hooks/use-avatar-upload';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface EditProfileDialogProps {
  username: string;
  avatarUrl: string | null;
}

export function EditProfileDialog({ username, avatarUrl }: EditProfileDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [usernameInput, setUsernameInput] = useState(username);
  const { upload, selectFile, reset } = useAvatarUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        username: usernameInput !== username ? usernameInput : undefined,
        avatarKey: upload?.status === 'done' ? upload.s3Key : undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile(updated.username), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
      reset();
      setOpen(false);
      if (updated.username !== username) {
        router.push(`/profile/${updated.username}`);
      }
    },
  });

  const displayAvatar = upload?.previewUrl ?? avatarUrl ?? undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setUsernameInput(username);
          reset();
        }
      }}
    >
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
        Edit profile
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-2 py-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative"
            aria-label="Change avatar"
          >
            <Avatar className="size-20">
              {displayAvatar && <AvatarImage src={displayAvatar} alt={`${username}'s avatar`} />}
              <AvatarFallback className="text-2xl">
                {username.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                selectFile(file);
              }
              e.target.value = '';
            }}
          />
          {upload?.status === 'error' && (
            <p className="text-sm text-destructive">Image upload failed. Try another file.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-username">Username</Label>
          <Input
            id="edit-username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || upload?.status === 'uploading' || !usernameInput.trim()}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
