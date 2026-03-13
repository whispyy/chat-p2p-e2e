export type SegmentKind = 'text' | 'bold' | 'italic' | 'code' | 'strike' | 'link';

interface BaseSegment {
  kind: SegmentKind;
  content: string;
}

export interface TextSegment   extends BaseSegment { kind: 'text' }
export interface BoldSegment   extends BaseSegment { kind: 'bold' }
export interface ItalicSegment extends BaseSegment { kind: 'italic' }
export interface CodeSegment   extends BaseSegment { kind: 'code' }
export interface StrikeSegment extends BaseSegment { kind: 'strike' }
export interface LinkSegment   extends BaseSegment { kind: 'link'; href: string }

export type Segment =
  | TextSegment
  | BoldSegment
  | ItalicSegment
  | CodeSegment
  | StrikeSegment
  | LinkSegment;

/**
 * A Formatter describes one text transformation rule.
 * To add a new formatter, append an entry to formatters.ts — nothing else changes.
 */
export interface Formatter {
  /** Human-readable name, used for ordering documentation and debugging. */
  name: string;
  /**
   * Pattern WITHOUT the global flag. The parser adds `g` internally.
   * Do not use the `s` (dotAll) flag — formatters intentionally don't cross newlines.
   */
  pattern: RegExp;
  /** Converts a regex match into one or more segments. */
  parse: (match: RegExpExecArray) => Segment[];
}
