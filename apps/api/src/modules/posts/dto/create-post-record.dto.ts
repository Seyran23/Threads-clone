export class CreatePostRecordDto {
  authorId!: string;
  content!: string;
  parentId?: string;
  depth!: number;
  hashtagIds!: string[];
}
