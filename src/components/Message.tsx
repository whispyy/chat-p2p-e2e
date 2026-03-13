import { useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import type { Message as MessageType, MessagePosition } from '../types';
import { parseMessage, renderSegments } from '../utils/formatting';
import { ImageViewer } from './ImageViewer';

interface MessageProps {
  message: MessageType;
  position: MessagePosition;
}

const RADIUS = 18;
const FLAT = 5;

function getBorderRadius(fromMe: boolean, position: MessagePosition): string {
  if (fromMe) {
    if (position === 'solo')   return `${RADIUS}px ${RADIUS}px ${FLAT}px ${RADIUS}px`;
    if (position === 'first')  return `${RADIUS}px ${RADIUS}px ${FLAT}px ${RADIUS}px`;
    if (position === 'middle') return `${RADIUS}px ${FLAT}px ${FLAT}px ${RADIUS}px`;
    /* last */                 return `${RADIUS}px ${FLAT}px ${RADIUS}px ${RADIUS}px`;
  } else {
    if (position === 'solo')   return `${RADIUS}px ${RADIUS}px ${RADIUS}px ${FLAT}px`;
    if (position === 'first')  return `${RADIUS}px ${RADIUS}px ${RADIUS}px ${FLAT}px`;
    if (position === 'middle') return `${FLAT}px ${RADIUS}px ${RADIUS}px ${FLAT}px`;
    /* last */                 return `${FLAT}px ${RADIUS}px ${RADIUS}px ${RADIUS}px`;
  }
}

export function Message({ message, position }: MessageProps) {
  const showMeta = position === 'solo' || position === 'last';
  const [showTooltip, setShowTooltip] = useState(false);
  const borderRadius = getBorderRadius(message.fromMe, position);

  const handleTap = () => {
    if (!message.fromMe) return;
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <Wrapper $fromMe={message.fromMe} $position={position}>
      <Bubble
        $fromMe={message.fromMe}
        $borderRadius={borderRadius}
        $isImage={!!message.image}
        onClick={handleTap}
      >
        {message.image ? (
          <ImageContent image={message.image} />
        ) : (
          <Text>{renderSegments(parseMessage(message.text))}</Text>
        )}
      </Bubble>
      {showMeta && (
        <Meta $fromMe={message.fromMe}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {message.fromMe && (
            <CheckMark>
              {message.delivered ? (
                <svg width="14" height="10" viewBox="0 0 16 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 5.5 4.5 9 4.5 9" />
                  <polyline points="4.5 5.5 8 9 15 1" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 5.5 4.5 9 11 1" />
                </svg>
              )}
            </CheckMark>
          )}
        </Meta>
      )}
      {showTooltip && (
        <Tooltip $fromMe={message.fromMe}>
          {message.delivered ? 'Delivered' : 'Sent'}
        </Tooltip>
      )}
    </Wrapper>
  );
}

function ImageContent({ image }: { image: NonNullable<MessageType['image']> }) {
  const [viewerOpen, setViewerOpen] = useState(false);


  if (image.progress !== undefined || !image.url) {
    const pct = image.progress ?? 0;
    return (
      <ProgressBox>
        <ProgressLabel>{pct}%</ProgressLabel>
        <ProgressTrack>
          <ProgressFill style={{ width: `${pct}%` }} />
        </ProgressTrack>
      </ProgressBox>
    );
  }

  return (
    <>
      <BubbleImage
        src={image.url}
        alt="Shared image"
        onClick={() => setViewerOpen(true)}
      />
      {viewerOpen && (
        <ImageViewer
          src={image.url}
          mimeType={image.mimeType}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Animations ───────────────────────────────────────────────────────────

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const tooltipFade = keyframes`
  0% { opacity: 0; transform: translateY(-2px); }
  15% { opacity: 1; transform: translateY(0); }
  85% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-2px); }
`;

// ─── Styles ───────────────────────────────────────────────────────────────

const Wrapper = styled.div<{ $fromMe: boolean; $position: MessagePosition }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $fromMe }) => ($fromMe ? 'flex-end' : 'flex-start')};
  margin-top: ${({ $position }) => ($position === 'first' || $position === 'solo' ? '8px' : '2px')};
  animation: ${fadeSlideIn} 0.18s ease-out;
  position: relative;
`;

const Bubble = styled.div<{ $fromMe: boolean; $borderRadius: string; $isImage: boolean }>`
  max-width: 75%;
  border-radius: ${({ $borderRadius }) => $borderRadius};
  overflow: hidden;
  word-break: break-word;

  ${({ $isImage }) => !$isImage && css`padding: 9px 13px;`}

  ${({ $fromMe }) =>
    $fromMe
      ? css`
          background: #4f8ef7;
          color: white;
        `
      : css`
          background: #ffffff;
          color: #111;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        `}
`;

const Text = styled.p`
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
`;

const Meta = styled.span<{ $fromMe: boolean }>`
  font-size: 11px;
  color: #aaa;
  margin-top: 3px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  gap: 3px;
  ${({ $fromMe }) => $fromMe && 'justify-content: flex-end;'}
`;

const CheckMark = styled.span`
  display: inline-flex;
  align-items: center;
  color: #aaa;
  line-height: 0;
`;

const Tooltip = styled.div<{ $fromMe: boolean }>`
  font-size: 11px;
  color: #888;
  background: rgba(0, 0, 0, 0.06);
  padding: 3px 8px;
  border-radius: 6px;
  margin-top: 2px;
  animation: ${tooltipFade} 2s ease-in-out forwards;
  pointer-events: none;
  ${({ $fromMe }) => $fromMe && 'align-self: flex-end;'}
`;

const BubbleImage = styled.img`
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: cover;
  cursor: pointer;
`;

const ProgressBox = styled.div`
  width: 180px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ProgressLabel = styled.span`
  font-size: 12px;
  opacity: 0.7;
`;

const ProgressTrack = styled.div`
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.25);
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 2px;
  background: currentColor;
  transition: width 0.15s ease;
`;
