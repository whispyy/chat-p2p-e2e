import { useRef, useState } from 'react';
import styled from 'styled-components';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB

// coarse pointer = touchscreen (mobile/tablet), fine pointer = mouse (desktop)
const isMobile = window.matchMedia('(pointer: coarse)').matches;

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendImage: (file: File) => void;
}

export function MessageInput({ onSend, onSendImage }: MessageInputProps) {
  const [text, setText] = useState('');
  const [imageError, setImageError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      showImageError('Only image files are supported.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showImageError('Image must be under 25 MB.');
      return;
    }
    onSendImage(file);
  };

  const showImageError = (msg: string) => {
    setImageError(msg);
    setTimeout(() => setImageError(''), 3000);
  };

  const canSend = text.trim().length > 0;

  return (
    <Bar>
      <PhotoButton onClick={() => fileInputRef.current?.click()} aria-label="Send image">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </PhotoButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImagePick}
      />

      <InputWrapper>
        {imageError && <ImageError>{imageError}</ImageError>}
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
  align-items: center;
  gap: 8px;
  padding: 10px 16px max(12px, env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  flex-shrink: 0;
`;

const PhotoButton = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: #f0f0f5;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  &:active {
    background: #e0e0ea;
    color: #4f8ef7;
  }
`;

const InputWrapper = styled.div`
  flex: 1;
  background: #f2f2f7;
  border-radius: 22px;
  border: 1.5px solid transparent;
  transition: border-color 0.15s;
  display: flex;
  flex-direction: column;

  &:focus-within {
    border-color: rgba(79, 142, 247, 0.4);
    background: #fff;
  }
`;

const ImageError = styled.p`
  margin: 0;
  padding: 6px 16px 0;
  font-size: 12px;
  color: #e05050;
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
