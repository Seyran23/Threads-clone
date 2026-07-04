const HASHTAG_PATTERN = /#(\w+)/g;

export function extractHashtags(content: string): string[] {
  const matches = content.matchAll(HASHTAG_PATTERN);

  const tags = new Set<string>();

  for (const match of matches) {
    tags.add(match[1].toLowerCase());
  }

  return [...tags];
}
