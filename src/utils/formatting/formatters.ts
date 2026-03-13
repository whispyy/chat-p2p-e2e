import type { Formatter } from './types';

/**
 * Ordered list of inline formatters.
 *
 * ORDER MATTERS: formatters run in sequence; earlier ones consume their tokens
 * first. Bold must precede italic so `**text**` is never partially matched by `*`.
 *
 * To add a new formatter (e.g. code blocks for Option C):
 *   1. Define a new entry below with a name, pattern, and parse function.
 *   2. Insert it at the right position in the array.
 *   That's it — parser.ts and renderer.tsx pick it up automatically
 *   once you also add its SegmentKind to types.ts and a render case to renderer.tsx.
 */
export const formatters: Formatter[] = [
  {
    name: 'bold',
    // **text** or __text__ — content must start and end with a non-space char
    pattern: /\*\*(\S(?:.*?\S)?)\*\*|__(\S(?:.*?\S)?)__/,
    parse: (match) => [{ kind: 'bold', content: match[1] ?? match[2] }],
  },
  {
    name: 'italic',
    // *text* or _text_ — runs after bold so lone * in **bold** is already consumed
    pattern: /\*(\S(?:.*?\S)?)\*|_(\S(?:.*?\S)?)_/,
    parse: (match) => [{ kind: 'italic', content: match[1] ?? match[2] }],
  },
  {
    name: 'code',
    // `inline code` — backtick delimited, no nesting
    pattern: /`([^`\n]+)`/,
    parse: (match) => [{ kind: 'code', content: match[1] }],
  },
  {
    name: 'strike',
    // ~~strikethrough~~
    pattern: /~~(\S(?:.*?\S)?)~~/,
    parse: (match) => [{ kind: 'strike', content: match[1] }],
  },
  {
    name: 'link',
    // http(s) URLs — trailing punctuation is trimmed so "see https://foo.com." works
    pattern: /https?:\/\/[^\s<>"']+/,
    parse: (match) => {
      const href = match[0].replace(/[.,;:!?)]+$/, '');
      return [{ kind: 'link', content: href, href }];
    },
  },
];
