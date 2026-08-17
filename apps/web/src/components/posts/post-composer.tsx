'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, X } from 'lucide-react';
import Image from 'next/image';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';

import type { Post } from '@threads-clone/shared-types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { createPost, createReply } from '@/lib/api/posts';
import { MAX_IMAGES_PER_POST } from '@/lib/constants/media.constants';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useImageUploads } from '@/lib/hooks/use-image-uploads';
import { queryKeys } from '@/lib/query-keys';
import { postComposerSchema, type PostComposerValues } from '@/lib/schemas/post.schema';

interface PostComposerProps {
  parentId?: string;
  placeholder?: string;
  onSuccess?: (post: Post) => void;
}

export function PostComposer({ parentId, placeholder, onSuccess }: PostComposerProps) {
  const { data } = useCurrentUser();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    uploads,
    addFiles,
    removeUpload,
    reset: resetUploads,
    isUploading,
    hasError,
    s3Keys,
  } = useImageUploads();

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<PostComposerValues>({ resolver: zodResolver(postComposerSchema) });

  const mutation = useMutation({
    mutationFn: (values: PostComposerValues) =>
      parentId
        ? createReply(parentId, { content: values.content, mediaKeys: s3Keys })
        : createPost({ content: values.content, mediaKeys: s3Keys }),
    onSuccess: (post) => {
      resetForm();
      resetUploads();
      if (parentId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.replies(parentId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.post(parentId) });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feed });
      }
      onSuccess?.(post);
    },
  });

  const username = data?.user.username ?? '';

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      className="flex gap-3 border-b border-border p-4"
    >
      <Avatar size="lg">
        {data?.user.avatarUrl && (
          <AvatarImage src={data.user.avatarUrl} alt={`${username}'s avatar`} />
        )}
        <AvatarFallback>{username.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <Textarea
          placeholder={placeholder ?? "What's new?"}
          className="min-h-12 resize-none border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          {...register('content')}
        />
        {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}

        {uploads.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {uploads.map((upload) => (
              <div key={upload.id} className="relative aspect-square overflow-hidden rounded-lg">
                <Image
                  src={upload.previewUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                  style={{ opacity: upload.status === 'uploading' ? 0.5 : 1 }}
                />
                <button
                  type="button"
                  onClick={() => removeUpload(upload.id)}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                  aria-label="Remove image"
                >
                  <X className="size-3" />
                </button>
                {upload.status === 'error' && (
                  <p className="absolute inset-x-0 bottom-0 bg-destructive/80 text-center text-xs text-destructive-foreground">
                    Failed
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {hasError && (
          <p className="text-sm text-destructive">
            An image failed to upload. Remove it to post without it, or try again.
          </p>
        )}

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}

        <div className="flex items-center justify-between">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                addFiles(e.target.files);
              }
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={uploads.length >= MAX_IMAGES_PER_POST}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Add image"
          >
            <ImageIcon className="size-4" />
          </Button>

          <Button type="submit" disabled={mutation.isPending || isUploading || hasError}>
            {mutation.isPending ? 'Posting…' : isUploading ? 'Uploading…' : 'Post'}
          </Button>
        </div>
      </div>
    </form>
  );
}
