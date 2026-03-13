import { useEffect, useRef, useState } from 'react';
import styled, { keyframes } from 'styled-components';

interface ImageViewerProps {
  src: string;
  mimeType: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function ImageViewer({ src, mimeType, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // scaleRef is kept in sync inline inside every setScale call so DOM handlers
  // (attached once, no re-subscription) always read the current value synchronously.
  const scaleRef = useRef(scale);

  const viewerRef         = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef     = useRef(false); // sync ref for handlers that can't read state
  const lastPointer       = useRef({ x: 0, y: 0 });
  const pinchDist      = useRef<number | null>(null);
  const lastTapTime    = useRef(0);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Reset pan when fully zoomed out
  useEffect(() => {
    if (scale <= 1) setOffset({ x: 0, y: 0 });
  }, [scale]);

  // ── Mouse drag (pan when zoomed) ──────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setOffset((o) => ({
      x: o.x + e.clientX - lastPointer.current.x,
      y: o.y + e.clientY - lastPointer.current.y,
    }));
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  // ── Touch: pinch-zoom + drag + double-tap ─────────────────────────────────
  // Attached as a non-passive DOM listener so e.preventDefault() is respected
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist.current = Math.hypot(dx, dy);
      } else if (e.touches.length === 1) {
        lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        // Double-tap → toggle 1x / 2.5x
        const now = Date.now();
        if (now - lastTapTime.current < 280) {
          if (scaleRef.current > 1) {
            scaleRef.current = 1;
            setScale(1);
          } else {
            scaleRef.current = 2.5;
            setScale(2.5);
          }
        }
        lastTapTime.current = now;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // must be non-passive to work
      if (e.touches.length === 2 && pinchDist.current !== null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / pinchDist.current;
        pinchDist.current = dist;
        setScale((s) => { const next = clamp(s * ratio, MIN_SCALE, MAX_SCALE); scaleRef.current = next; return next; });
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        const dx = e.touches[0].clientX - lastPointer.current.x;
        const dy = e.touches[0].clientY - lastPointer.current.y;
        lastPointer.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      }
    };

    const onTouchEnd = () => { pinchDist.current = null; };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setScale((s) => { const next = clamp(s + delta, MIN_SCALE, MAX_SCALE); scaleRef.current = next; return next; });
    };


    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    el.addEventListener('wheel',      onWheel,      { passive: false });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
      el.removeEventListener('wheel',      onWheel);
    };
  }, []); // attach once; reads latest values via refs

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
    const a = document.createElement('a');
    a.href = src;
    a.download = `peer-chat-${Date.now()}.${ext}`;
    a.click();
  };

  return (
    <Overlay onClick={onClose}>
      <TopBar onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </CloseButton>
        <DownloadButton onClick={handleDownload} aria-label="Download image">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Save
        </DownloadButton>
      </TopBar>

      <ViewerArea
        ref={viewerRef}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <ZoomableImage
          src={src}
          alt="Full size"
          draggable={false}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </ViewerArea>

      <HintBar onClick={(e) => e.stopPropagation()}>
        {scale <= 1 ? 'Double-tap or pinch to zoom' : 'Drag to pan · double-tap to reset'}
      </HintBar>
    </Overlay>
  );
}

// ─── Animations ───────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

// ─── Styles ───────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  animation: ${fadeIn} 0.18s ease-out;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: max(14px, env(safe-area-inset-top)) 16px 12px;
  flex-shrink: 0;
`;

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;

  &:active { background: rgba(255, 255, 255, 0.2); }
`;

const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  border-radius: 20px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:active {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.4);
  }
`;

const ViewerArea = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
`;

const ZoomableImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transform-origin: center center;
  transition: transform 0.05s linear;
  pointer-events: none;
`;

const HintBar = styled.p`
  margin: 0;
  padding: 10px 16px max(16px, env(safe-area-inset-bottom));
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  flex-shrink: 0;
`;
