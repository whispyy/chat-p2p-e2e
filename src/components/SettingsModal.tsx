import { useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { clearData, exportData, importData } from '../services/storage.service';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `peer-chat-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importData(reader.result as string);
        window.location.reload();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Invalid backup file.');
      }
    };
    reader.readAsText(file);
    // reset input so the same file can be re-selected if needed
    e.target.value = '';
  };

  const handleReset = () => {
    clearData();
    window.location.reload();
  };

  return (
    <Backdrop onClick={onClose}>
      <Sheet onClick={(e) => e.stopPropagation()}>
        <Handle />

        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <CloseButton onClick={onClose} aria-label="Close settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </CloseButton>
        </SheetHeader>

        <SectionLabel>Data &amp; conversations</SectionLabel>

        <ActionRow onClick={handleExport}>
          <ActionIconWrap>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </ActionIconWrap>
          <ActionBody>
            <ActionTitle>Export backup</ActionTitle>
            <ActionSub>Download all conversations as a JSON file</ActionSub>
          </ActionBody>
          <Chevron>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Chevron>
        </ActionRow>

        <ActionRow onClick={() => fileInputRef.current?.click()}>
          <ActionIconWrap>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </ActionIconWrap>
          <ActionBody>
            <ActionTitle>Import backup</ActionTitle>
            <ActionSub>Restore from a previously exported file</ActionSub>
          </ActionBody>
          <Chevron>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Chevron>
        </ActionRow>

        {importError && <ImportError>{importError}</ImportError>}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />

        <Divider />

        {!confirmReset ? (
          <ActionRow $danger onClick={() => setConfirmReset(true)}>
            <ActionIconWrap $danger>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </ActionIconWrap>
            <ActionBody>
              <ActionTitle $danger>Reset all data</ActionTitle>
              <ActionSub>Delete all conversations, contacts, and identity</ActionSub>
            </ActionBody>
          </ActionRow>
        ) : (
          <ResetConfirm>
            <ResetWarning>
              This will permanently delete all conversations, contacts, and your device identity. You cannot undo this.
            </ResetWarning>
            <ResetButtons>
              <CancelButton onClick={() => setConfirmReset(false)}>Cancel</CancelButton>
              <ConfirmButton onClick={handleReset}>Delete everything</ConfirmButton>
            </ResetButtons>
          </ResetConfirm>
        )}

        <SafeAreaSpacer />
      </Sheet>
    </Backdrop>
  );
}

// ─── Animations ───────────────────────────────────────────────────────────

const slideUp = keyframes`
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

// ─── Styles ───────────────────────────────────────────────────────────────

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  animation: ${fadeIn} 0.2s ease-out both;
`;

const Sheet = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: #111d35;
  border-radius: 24px 24px 0 0;
  padding: 0 0 0;
  animation: ${slideUp} 0.28s cubic-bezier(0.32, 0.72, 0, 1) both;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const Handle = styled.div`
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.18);
  margin: 12px auto 0;
`;

const SheetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 4px;
`;

const SheetTitle = styled.h2`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.2px;
`;

const CloseButton = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:active { background: rgba(255, 255, 255, 0.18); }
`;

const SectionLabel = styled.p`
  margin: 20px 20px 6px;
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const ActionRow = styled.div<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.12s;
  color: ${({ $danger }) => ($danger ? '#ff5a5a' : 'white')};

  &:active { background: rgba(255, 255, 255, 0.05); }
`;

const ActionIconWrap = styled.div<{ $danger?: boolean }>`
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: ${({ $danger }) =>
    $danger ? 'rgba(255, 90, 90, 0.12)' : 'rgba(79, 142, 247, 0.12)'};
  color: ${({ $danger }) => ($danger ? '#ff5a5a' : '#4f8ef7')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const ActionBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActionTitle = styled.p<{ $danger?: boolean }>`
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: ${({ $danger }) => ($danger ? '#ff5a5a' : 'rgba(255, 255, 255, 0.9)')};
  line-height: 1.3;
`;

const ActionSub = styled.p`
  margin: 2px 0 0;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.4;
`;

const Chevron = styled.div`
  color: rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
`;

const ImportError = styled.p`
  margin: 0 20px 4px;
  font-size: 12px;
  color: #ff5a5a;
  padding: 8px 12px;
  background: rgba(255, 90, 90, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(255, 90, 90, 0.2);
`;

const Divider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.07);
  margin: 8px 0;
`;

const ResetConfirm = styled.div`
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ResetWarning = styled.p`
  margin: 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.6;
  padding: 12px 14px;
  background: rgba(255, 90, 90, 0.07);
  border: 1px solid rgba(255, 90, 90, 0.18);
  border-radius: 10px;
`;

const ResetButtons = styled.div`
  display: flex;
  gap: 10px;
`;

const CancelButton = styled.button`
  flex: 1;
  padding: 13px;
  border-radius: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:active { background: rgba(255, 255, 255, 0.06); }
`;

const ConfirmButton = styled.button`
  flex: 1;
  padding: 13px;
  border-radius: 12px;
  border: none;
  background: #ff3b30;
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;

  &:active { opacity: 0.85; }
`;

const SafeAreaSpacer = styled.div`
  height: max(16px, env(safe-area-inset-bottom));
`;
