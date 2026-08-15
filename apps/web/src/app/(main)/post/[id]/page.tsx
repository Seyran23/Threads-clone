import { PostDetailView } from './post-detail-view';

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  return <PostDetailView postId={id} />;
}
