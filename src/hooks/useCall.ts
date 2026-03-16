import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallState } from '../types';
import type { MeshNode } from '../services/mesh';
import { startRingtone, stopRingtone } from '../utils/ringtone';

export interface CallHandle {
  callState: CallState;
  callPeerId: string | null;
  isMuted: boolean;
  callDuration: number;
  incomingCallPeerId: string | null;
  startCall: (peerId: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  callError: string | null;
}

export function useCall(meshNode: MeshNode | null): CallHandle {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callPeerId, setCallPeerId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCallPeerId, setIncomingCallPeerId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTime = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Wire mesh node callbacks
  useEffect(() => {
    const node = meshNode;
    if (!node) return;

    node.onCallStateChange = (state, peerId) => {
      const s = state as CallState;
      setCallState(s);

      if (s === 'incoming_ringing') {
        setIncomingCallPeerId(peerId);
        setCallPeerId(peerId);
        startRingtone();
      } else if (s === 'outgoing_ringing') {
        setCallPeerId(peerId);
        setIncomingCallPeerId(null);
        startRingtone();
      } else if (s === 'active') {
        stopRingtone();
        setIncomingCallPeerId(null);
        setCallPeerId(peerId);
        callStartTime.current = Date.now();
        setCallDuration(0);
        durationTimer.current = setInterval(() => {
          setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
        }, 1000);
      } else if (s === 'idle') {
        stopRingtone();
        setIncomingCallPeerId(null);
        setCallPeerId(null);
        setIsMuted(false);
        setCallDuration(0);
        if (durationTimer.current) {
          clearInterval(durationTimer.current);
          durationTimer.current = null;
        }
        if (audioRef.current) {
          audioRef.current.srcObject = null;
        }
      } else if (s === 'negotiating') {
        stopRingtone();
        setCallPeerId(peerId);
        setIncomingCallPeerId(null);
      }
    };

    node.onCallRemoteStream = (stream) => {
      // Play the remote audio through an <audio> element
      if (!audioRef.current) {
        audioRef.current = document.createElement('audio');
        audioRef.current.autoplay = true;
        // Needed for iOS Safari
        audioRef.current.setAttribute('playsinline', '');
      }
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => { /* autoplay blocked, user interaction needed */ });
    };

    node.onCallError = (error) => {
      setCallError(error);
      setTimeout(() => setCallError(null), 4000);
    };

    return () => {
      node.onCallStateChange = null;
      node.onCallRemoteStream = null;
      node.onCallError = null;
    };
  }, [meshNode]);

  const startCall = useCallback((peerId: string) => {
    if (!meshNode) return;
    setCallError(null);
    const cs = meshNode.getOrCreateCallService(peerId);
    if (cs) {
      setCallPeerId(peerId);
      cs.startCall();
    }
  }, [meshNode]);

  const acceptCall = useCallback(() => {
    if (!meshNode || !incomingCallPeerId) return;
    setCallError(null);
    const cs = meshNode.getCallService(incomingCallPeerId);
    cs?.acceptCall();
  }, [meshNode, incomingCallPeerId]);

  const rejectCall = useCallback(() => {
    if (!meshNode || !incomingCallPeerId) return;
    const cs = meshNode.getCallService(incomingCallPeerId);
    cs?.rejectCall();
  }, [meshNode, incomingCallPeerId]);

  const hangUp = useCallback(() => {
    if (!meshNode || !callPeerId) return;
    const cs = meshNode.getCallService(callPeerId);
    cs?.hangUp();
  }, [meshNode, callPeerId]);

  const toggleMute = useCallback(() => {
    if (!meshNode || !callPeerId) return;
    const cs = meshNode.getCallService(callPeerId);
    if (cs) {
      const muted = cs.toggleMute();
      setIsMuted(muted);
    }
  }, [meshNode, callPeerId]);

  return {
    callState, callPeerId, isMuted, callDuration,
    incomingCallPeerId, startCall, acceptCall, rejectCall,
    hangUp, toggleMute, callError,
  };
}
