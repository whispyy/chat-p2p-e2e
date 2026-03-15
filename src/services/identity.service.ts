import * as MeshIdentity from './mesh/mesh-identity';

export const MY_ID_KEY = 'peer-chat:my-id';

let meshInitialized = false;

/** Initialize the ECDSA-based identity. Must be called before getMyId(). */
export async function initIdentity(): Promise<void> {
  await MeshIdentity.init();
  meshInitialized = true;

  // Migrate: store the ECDSA peerId in the old key slot for backward compat
  localStorage.setItem(MY_ID_KEY, MeshIdentity.getPeerId());
}

/** Overwrites the stored identity (used by backup restore). */
export function setMyId(id: string): void {
  localStorage.setItem(MY_ID_KEY, id);
}

/** Returns this device's persistent ID (ECDSA-derived peerId once initialized, UUID fallback). */
export function getMyId(): string {
  if (meshInitialized) {
    return MeshIdentity.getPeerId();
  }
  // Fallback for before init completes
  let id = localStorage.getItem(MY_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(MY_ID_KEY, id);
  }
  return id;
}

/** Returns a short human-readable version of a peer ID (first 8 hex chars, uppercase). */
export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Returns a default display name for an unknown peer. */
export function defaultPeerName(id: string): string {
  return `Peer ${shortId(id)}`;
}
