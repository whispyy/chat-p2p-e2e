const MY_ID_KEY = 'peer-chat:my-id';

/** Returns this device's persistent ID, generating one on first call. */
export function getMyId(): string {
  let id = localStorage.getItem(MY_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(MY_ID_KEY, id);
  }
  return id;
}

/** Returns a short human-readable version of any UUID (first 8 hex chars, uppercase). */
export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase();
}

/** Returns a default display name for an unknown peer. */
export function defaultPeerName(id: string): string {
  return `Peer ${shortId(id)}`;
}
