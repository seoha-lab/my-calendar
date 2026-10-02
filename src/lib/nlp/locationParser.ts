import type { TextSpan } from './types';

export function parseLocation(input: string): { location?: string; span?: TextSpan } {
  const match = /(^|\s)([^\s]+)에서(?=\s|$)/.exec(input);
  if (!match) return {};
  const location = match[2].trim();
  const start = match.index + match[1].length;
  return { location, span: { start, end: start + match[2].length + 2, text: `${match[2]}에서` } };
}

