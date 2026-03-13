export function encodeSignal(sdp: RTCSessionDescriptionInit): string {
  return btoa(JSON.stringify(sdp));
}

export function decodeSignal(code: string): RTCSessionDescriptionInit {
  let parsed: unknown;
  try {
    parsed = JSON.parse(atob(code.trim()));
  } catch {
    throw new Error('Invalid code — make sure you pasted the full text.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('type' in parsed) ||
    !('sdp' in parsed)
  ) {
    throw new Error('Invalid code — unexpected format.');
  }
  return parsed as RTCSessionDescriptionInit;
}
