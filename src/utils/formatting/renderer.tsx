import React from 'react';
import styled from 'styled-components';
import type { Segment } from './types';

/**
 * Renders a flat segment array to React nodes.
 * Each SegmentKind maps to one case here — add a case when adding a new kind.
 */
export function renderSegments(segments: Segment[]): React.ReactNode {
  return segments.map((seg, i) => {
    switch (seg.kind) {
      case 'text':   return renderTextWithLineBreaks(seg.content, i);
      case 'bold':   return <strong key={i}>{seg.content}</strong>;
      case 'italic': return <em key={i}>{seg.content}</em>;
      case 'code':   return <InlineCode key={i}>{seg.content}</InlineCode>;
      case 'strike': return <s key={i}>{seg.content}</s>;
      case 'link':
        return (
          <Link key={i} href={seg.href} target="_blank" rel="noopener noreferrer">
            {seg.content}
          </Link>
        );
    }
  });
}

/** Splits plain text on newlines and inserts <br> elements between lines. */
function renderTextWithLineBreaks(text: string, parentKey: number): React.ReactNode {
  const lines = text.split('\n');
  if (lines.length === 1) return <React.Fragment key={parentKey}>{text}</React.Fragment>;
  return (
    <React.Fragment key={parentKey}>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

// ─── Inline styled elements ────────────────────────────────────────────────
// Both use `color: inherit` so they adapt to sent (white) and received (dark) bubbles.

const InlineCode = styled.code`
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
  font-size: 0.88em;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
`;

const Link = styled.a`
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
  opacity: 0.9;

  &:hover {
    opacity: 1;
  }
`;
