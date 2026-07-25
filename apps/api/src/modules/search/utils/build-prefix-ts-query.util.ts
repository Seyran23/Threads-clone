const TSQUERY_SPECIAL_CHARS = /[&|!():*]/g;

export function buildPrefixTsQuery(input: string): string {
  const words = input
    .split(/\s+/)
    .map((word) => word.replace(TSQUERY_SPECIAL_CHARS, ''))
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return '';
  }

  return words.map((word, index) => (index === words.length - 1 ? `${word}:*` : word)).join(' & ');
}
