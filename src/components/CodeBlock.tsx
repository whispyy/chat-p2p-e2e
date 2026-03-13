import { useState } from 'react';
import styled from 'styled-components';

interface CodeBlockProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}

export function CodeBlock({ value, onChange, readOnly = false, placeholder }: CodeBlockProps) {
  const [copyFeedback, setCopyFeedback] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopyFeedback('Copied!');
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const handleShare = async () => {
    await navigator.share({ title: 'Chat invite', text: value });
    setShareFeedback('Shared!');
    setTimeout(() => setShareFeedback(''), 2000);
  };

  const handleSelect = (e: React.FocusEvent<HTMLTextAreaElement> | React.MouseEvent<HTMLTextAreaElement>) => {
    (e.target as HTMLTextAreaElement).select();
  };

  return (
    <Wrapper>
      <StyledTextarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={readOnly ? handleSelect : undefined}
        onClick={readOnly ? handleSelect : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
      {readOnly && (
        <ButtonRow>
          <ActionButton onClick={handleCopy}>{copyFeedback || 'Copy'}</ActionButton>
          {!!navigator.share && (
            <ActionButton $primary onClick={handleShare}>{shareFeedback || 'Share'}</ActionButton>
          )}
        </ButtonRow>
      )}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const StyledTextarea = styled.textarea`
  width: 100%;
  min-height: 120px;
  padding: 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  &:focus {
    border-color: rgba(79, 142, 247, 0.5);
    background: rgba(255, 255, 255, 0.07);
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button<{ $primary?: boolean }>`
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, transform 0.1s;

  ${({ $primary }) => $primary ? `
    border: none;
    background: #4f8ef7;
    color: white;
    &:active { background: #3a7de0; transform: scale(0.98); }
  ` : `
    border: 1.5px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.7);
    &:active { background: rgba(255, 255, 255, 0.12); transform: scale(0.98); }
  `}
`;
