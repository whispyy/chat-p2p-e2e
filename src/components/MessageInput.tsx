import { useRef, useState } from 'react';
import styled from 'styled-components';

// coarse pointer = touchscreen (mobile/tablet), fine pointer = mouse (desktop)
const isMobile = window.matchMedia('(pointer: coarse)').matches;

interface MessageInputProps {
  onSend: (text: string) => void;
}

export function MessageInput({ onSend }: MessageInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    autoResize(e.target);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (isMobile) {
      // Mobile: Enter = newline (natural). Send is button-only.
    } else {
      // Desktop: Enter sends, Shift+Enter inserts newline.
      if (!e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const canSend = text.trim().length > 0;

  return (
    <Bar>
      <InputWrapper>
        <Input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          rows={1}
          autoComplete="off"
          autoCorrect="on"
          spellCheck
        />
      </InputWrapper>
      <SendButton onClick={handleSend} disabled={!canSend} $active={canSend} aria-label="Send message">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </SendButton>
    </Bar>
  );
}

const Bar = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 16px max(12px, env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  flex-shrink: 0;
`;

const InputWrapper = styled.div`
  flex: 1;
  background: #f2f2f7;
  border-radius: 22px;
  border: 1.5px solid transparent;
  transition: border-color 0.15s;

  &:focus-within {
    border-color: rgba(79, 142, 247, 0.4);
    background: #fff;
  }
`;

const Input = styled.textarea`
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  font-size: 16px;
  resize: none;
  outline: none;
  font-family: inherit;
  max-height: 140px;
  overflow-y: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
  line-height: 1.4;
  color: #111;

  &::placeholder {
    color: #aaa;
  }
`;

const SendButton = styled.button<{ $active: boolean }>`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: ${({ $active }) => ($active ? '#4f8ef7' : '#e0e0e0')};
  color: white;
  cursor: ${({ $active }) => ($active ? 'pointer' : 'default')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;

  &:active:not(:disabled) {
    transform: scale(0.92);
    background: #3a7de0;
  }
`;
