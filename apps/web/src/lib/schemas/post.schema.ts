import { z } from 'zod';

export const postComposerSchema = z.object({
  content: z.string().min(1, 'Say something first').max(500, 'Must be at most 500 characters'),
});
export type PostComposerValues = z.infer<typeof postComposerSchema>;
