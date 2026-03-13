import type { Formatter, Segment } from './types';
import { formatters } from './formatters';

/**
 * Applies a single formatter to an array of segments.
 * Only 'text' segments are processed; all others pass through unchanged.
 */
function applyFormatter(segments: Segment[], formatter: Formatter): Segment[] {
  // Build a global version of the pattern for exec-based iteration
  const flags = 'g' + formatter.pattern.flags.replace('g', '');
  const regex = new RegExp(formatter.pattern.source, flags);

  return segments.flatMap((segment) => {
    if (segment.kind !== 'text') return [segment];

    const result: Segment[] = [];
    let lastIndex = 0;
    regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(segment.content)) !== null) {
      // Capture any plain text before this match
      if (match.index > lastIndex) {
        result.push({ kind: 'text', content: segment.content.slice(lastIndex, match.index) });
      }

      result.push(...formatter.parse(match));
      lastIndex = match.index + match[0].length;

      // Guard against zero-length match infinite loops
      if (match[0].length === 0) regex.lastIndex++;
    }

    // Capture any remaining plain text after the last match
    if (lastIndex < segment.content.length) {
      result.push({ kind: 'text', content: segment.content.slice(lastIndex) });
    }

    return result.length > 0 ? result : [segment];
  });
}

/**
 * Parses a raw message string into a flat array of typed segments
 * by running all formatters in order.
 */
export function parseMessage(text: string): Segment[] {
  let segments: Segment[] = [{ kind: 'text', content: text }];
  for (const formatter of formatters) {
    segments = applyFormatter(segments, formatter);
  }
  return segments;
}
