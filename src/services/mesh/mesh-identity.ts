const KEYPAIR_KEY = 'peer-chat:keypair';

let cachedPeerId: string | null = null;
let cachedKeyPair: CryptoKeyPair | null = null;

async function exportKeyToJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

async function importPublicKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}

async function importPrivateKeyFromJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
}

function arrayBufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function computePeerId(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', raw);
  return arrayBufferToHex(hash);
}

export async function init(): Promise<void> {
  const stored = localStorage.getItem(KEYPAIR_KEY);
  if (stored) {
    try {
      const { pub, priv } = JSON.parse(stored);
      const publicKey = await importPublicKeyFromJwk(pub);
      const privateKey = await importPrivateKeyFromJwk(priv);
      cachedKeyPair = { publicKey, privateKey };
      cachedPeerId = await computePeerId(publicKey);
      return;
    } catch {
      // Corrupted — regenerate
    }
  }

  cachedKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  cachedPeerId = await computePeerId(cachedKeyPair.publicKey);

  const pub = await exportKeyToJwk(cachedKeyPair.publicKey);
  const priv = await exportKeyToJwk(cachedKeyPair.privateKey);
  localStorage.setItem(KEYPAIR_KEY, JSON.stringify({ pub, priv }));
}

export function getPeerId(): string {
  if (!cachedPeerId) throw new Error('MeshIdentity not initialized — call init() first');
  return cachedPeerId;
}

export async function getPublicKeyBase64(): Promise<string> {
  if (!cachedKeyPair) throw new Error('MeshIdentity not initialized');
  const raw = await crypto.subtle.exportKey('raw', cachedKeyPair.publicKey);
  return arrayBufferToBase64(raw);
}

export async function sign(data: string): Promise<string> {
  if (!cachedKeyPair) throw new Error('MeshIdentity not initialized');
  const encoded = new TextEncoder().encode(data);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cachedKeyPair.privateKey,
    encoded,
  );
  return arrayBufferToBase64(sig);
}

export async function verify(pubKeyBase64: string, data: string, signature: string): Promise<boolean> {
  const rawKey = base64ToArrayBuffer(pubKeyBase64);
  const publicKey = await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  const encoded = new TextEncoder().encode(data);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    base64ToArrayBuffer(signature),
    encoded,
  );
}

export function shortPeerId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function defaultPeerName(id: string): string {
  return `Peer ${shortPeerId(id)}`;
}
