import styled, { css, keyframes } from 'styled-components';
import type { Message as MessageType, MessagePosition } from '../types';

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
  const showTime = position === 'solo' || position === 'last';

  return (
    <Wrapper $fromMe={message.fromMe} $position={position}>
      <Bubble
        $fromMe={message.fromMe}
        $borderRadius={getBorderRadius(message.fromMe, position)}
      >
        <Text>{message.text}</Text>
      </Bubble>
      {showTime && (
        <Time $fromMe={message.fromMe}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Time>
      )}
    </Wrapper>
  );
}

const fadeSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Wrapper = styled.div<{ $fromMe: boolean; $position: MessagePosition }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $fromMe }) => ($fromMe ? 'flex-end' : 'flex-start')};
  margin-top: ${({ $position }) => ($position === 'first' || $position === 'solo' ? '8px' : '2px')};
  animation: ${fadeSlideIn} 0.18s ease-out;
`;

const Bubble = styled.div<{ $fromMe: boolean; $borderRadius: string }>`
  max-width: 75%;
  padding: 9px 13px;
  border-radius: ${({ $borderRadius }) => $borderRadius};
  word-break: break-word;

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
  white-space: pre-wrap;
`;

const Time = styled.span<{ $fromMe: boolean }>`
  font-size: 11px;
  color: #aaa;
  margin-top: 3px;
  padding: 0 4px;
`;
