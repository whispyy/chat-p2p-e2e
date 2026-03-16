import { useCallback, useEffect, useRef, useState } from 'react';
import { WebRTCService } from '../services/webrtc.service';
import { ChatService } from '../services/chat.service';
import { MeshNode } from '../services/mesh';
import * as MeshIdentity from '../services/mesh/mesh-identity';
import type { ConnectionState } from '../types';
import { decodeSignal, encodeSignal } from '../utils/encoding';
import { getMyId, initIdentity } from '../services/identity.service';
import { upsertContact, markRead } from '../services/storage.service';

export interface WebRTCHandle {
  state: ConnectionState;
  errorMessage: string;
  offerCode: string;
  answerCode: string;
  peerId: string;
  chatService: ChatService | null;
  startOffer: () => Promise<void>;
  submitAnswer: (code: string) => Promise<void>;
  startJoin: () => void;
  submitOffer: (code: string) => Promise<void>;
  reset: () => void;
  reconnect: (targetPeerId: string) => Promise<void>;
  meshReady: boolean;
  connectedPeers: ReadonlySet<string>;
  contactsVersion: number;
  meshNodeRef: MeshNode | null;
}

// Singleton MeshNode shared across the app lifecycle
let meshNodeSingleton: MeshNode | null = null;

export async function getMeshNode(): Promise<MeshNode> {
  if (!meshNodeSingleton) {
    meshNodeSingleton = new MeshNode();
    await meshNodeSingleton.init();
  }
  return meshNodeSingleton;
}

export function useWebRTC(): WebRTCHandle {
  const [state, setState] = useState<ConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [chatService, setChatService] = useState<ChatService | null>(null);
  const [peerId, setPeerId] = useState('');
  const [meshReady, setMeshReady] = useState(false);
  const [meshNodeState, setMeshNodeState] = useState<MeshNode | null>(null);
  const [connectedPeers, setConnectedPeers] = useState<ReadonlySet<string>>(new Set());
  const [contactsVersion, setContactsVersion] = useState(0);

  const webrtcRef = useRef<WebRTCService | null>(null);
  const sessionRef = useRef(0);
  const meshNodeRef = useRef<MeshNode | null>(null);
  // Track the peerId associated with the current webrtc connection (not React state, avoids stale closure)
  const peerIdRef = useRef('');
  // Track the active ChatService for forwarding incoming messages to the UI
  const chatServiceRef = useRef<ChatService | null>(null);

  // Keep chatServiceRef in sync for the mesh callbacks
  useEffect(() => { chatServiceRef.current = chatService; }, [chatService]);

  // Initialize mesh on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initIdentity();
      const node = await getMeshNode();
      if (cancelled) return;
      meshNodeRef.current = node;

      node.onPeerConnected = (id, chat) => {
        if (cancelled) return;
        upsertContact(id);
        peerIdRef.current = id;
        setPeerId(id);
        setChatService(chat);
        setState('connected');
      };

      node.onConnectionsChanged = (peerIds) => {
        if (cancelled) return;
        setConnectedPeers(new Set(peerIds));
      };

      // Forward incoming messages to the active ChatService for live UI updates.
      // Storage + ack already handled by MeshNode at the transport layer.
      node.onIncomingMessage = (fromPeerId, message) => {
        if (cancelled) return;
        if (peerIdRef.current === fromPeerId && chatServiceRef.current) {
          // User is in this chat — forward to UI and mark read immediately
          chatServiceRef.current.onMessage?.(message);
          markRead(fromPeerId);
        } else {
          // Background message — refresh contacts list to show new preview + unread badge
          setContactsVersion((v) => v + 1);
        }
      };

      node.onDeliveryAck = (fromPeerId, messageId) => {
        if (cancelled) return;
        if (peerIdRef.current === fromPeerId) {
          chatServiceRef.current?.onDelivered?.(messageId);
        }
      };

      setMeshNodeState(node);
      setMeshReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  /** Reset UI state only — does NOT close the WebRTC connection (mesh keeps it alive). */
  const reset = useCallback(() => {
    sessionRef.current += 1;

    // Only close the connection if it's NOT registered in the mesh.
    // If the mesh has it, the connection stays alive for gossip/heartbeat/reconnect.
    const webrtc = webrtcRef.current;
    const node = meshNodeRef.current;
    if (webrtc && !(node && peerIdRef.current && node.isConnected(peerIdRef.current))) {
      webrtc.close();
    }

    webrtcRef.current = null;
    peerIdRef.current = '';
    setState('idle');
    setErrorMessage('');
    setOfferCode('');
    setAnswerCode('');
    setChatService(null);
    setPeerId('');
  }, []);

  /** Wires identity exchange with ECDSA proof onto a freshly-opened WebRTCService. */
  const attachIdentityHandlers = useCallback((webrtc: WebRTCService, session: number) => {
    webrtc.onChannelOpen = async () => {
      if (session !== sessionRef.current) return;

      const myId = getMyId();
      let pubkey: string | undefined;
      let sig: string | undefined;

      try {
        pubkey = await MeshIdentity.getPublicKeyBase64();
        sig = await MeshIdentity.sign(myId);
      } catch {
        // If mesh identity isn't ready, send without proof
      }

      webrtc.sendIdentity(myId, pubkey, sig);
      const chat = new ChatService(webrtc);
      setChatService(chat);
      setState('connected');
    };

    webrtc.onPeerIdentity = (id: string, pubkey?: string) => {
      if (session !== sessionRef.current) return;
      upsertContact(id);
      markRead(id);
      peerIdRef.current = id;
      setPeerId(id);

      // Wire into mesh — this also sets up onMeshMessage routing inside the mesh node
      const node = meshNodeRef.current;
      if (node && pubkey) {
        node.wireDataChannel(webrtc, id, pubkey);
      }
    };
  }, []);

  const startOffer = useCallback(async () => {
    setState('gathering');
    setErrorMessage('');
    const session = ++sessionRef.current;
    const webrtc = new WebRTCService();
    webrtcRef.current = webrtc;
    attachIdentityHandlers(webrtc, session);

    try {
      const offer = await webrtc.createOffer();
      if (session !== sessionRef.current) return;
      setOfferCode(encodeSignal(offer));
      setState('awaiting_answer');
    } catch (err) {
      if (session !== sessionRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create offer');
      setState('error');
    }
  }, [attachIdentityHandlers]);

  const submitAnswer = useCallback(async (code: string) => {
    const webrtc = webrtcRef.current;
    if (!webrtc) return;
    try {
      const answer = decodeSignal(code);
      await webrtc.submitAnswer(answer);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Invalid answer code');
      setState('error');
    }
  }, []);

  const startJoin = useCallback(() => {
    setState('joining');
    setErrorMessage('');
  }, []);

  const submitOffer = useCallback(async (code: string) => {
    setState('generating_answer');
    setErrorMessage('');
    const session = ++sessionRef.current;
    const webrtc = new WebRTCService();
    webrtcRef.current = webrtc;
    attachIdentityHandlers(webrtc, session);

    try {
      const offer = decodeSignal(code);
      const answer = await webrtc.createAnswer(offer);
      if (session !== sessionRef.current) return;
      setAnswerCode(encodeSignal(answer));
      setState('has_answer');
    } catch (err) {
      if (session !== sessionRef.current) return;
      setErrorMessage(err instanceof Error ? err.message : 'Invalid offer code');
      setState('error');
    }
  }, [attachIdentityHandlers]);

  const reconnect = useCallback(async (targetPeerId: string) => {
    const node = meshNodeRef.current;
    if (!node) {
      await startOffer();
      return;
    }

    // If already connected in the mesh, just reopen the chat on the existing connection
    if (node.isConnected(targetPeerId)) {
      const chat = node.createChatService(targetPeerId);
      if (chat) {
        markRead(targetPeerId);
        upsertContact(targetPeerId);
        peerIdRef.current = targetPeerId;
        setPeerId(targetPeerId);
        setChatService(chat);
        setState('connected');
        return;
      }
    }

    // Try mesh relay reconnection
    setState('reconnecting');
    setErrorMessage('');

    try {
      await node.reconnectToPeer(targetPeerId);
    } catch {
      // No relay peers available — fall back to manual offer flow
      await startOffer();
    }
  }, [startOffer]);

  return {
    state, errorMessage, offerCode, answerCode, peerId, chatService,
    startOffer, submitAnswer, startJoin, submitOffer, reset, reconnect, meshReady, connectedPeers, contactsVersion,
    meshNodeRef: meshNodeState,
  };
}
