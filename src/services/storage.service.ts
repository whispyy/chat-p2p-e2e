import type { Contact, Message } from '../types';
import { defaultPeerName } from './identity.service';

const CONTACTS_KEY = 'peer-chat:contacts';
const msgsKey = (id: string) => `peer-chat:msgs:${id}`;

// ─── Internal helpers ──────────────────────────────────────────────────────

function readAllContacts(): Record<string, Contact> {
  try {
    return JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeAllContacts(contacts: Record<string, Contact>): void {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Returns all contacts sorted by most recently active. */
export function getContacts(): Contact[] {
  return Object.values(readAllContacts()).sort((a, b) => b.lastSeen - a.lastSeen);
}

export function getContact(id: string): Contact | null {
  return readAllContacts()[id] ?? null;
}

/**
 * Creates or updates a contact.
 * Preserves existing name and lastMessage; only updates the fields you pass.
 */
export function upsertContact(id: string, update: { name?: string } = {}): Contact {
  const all = readAllContacts();
  const existing = all[id];
  all[id] = {
    id,
    name: update.name ?? existing?.name ?? defaultPeerName(id),
    lastSeen: Date.now(),
    lastMessage: existing?.lastMessage ?? null,
  };
  writeAllContacts(all);
  return all[id];
}

/** Appends a message to a contact's history and updates contact metadata. */
export function appendMessage(contactId: string, message: Message): void {
  const all = readAllContacts();
  if (!all[contactId]) return;

  // Update only contact metadata — no full message list needed
  all[contactId].lastSeen = message.timestamp;
  all[contactId].lastMessage = { text: message.text, fromMe: message.fromMe };
  writeAllContacts(all);

  // Append to the per-contact message store
  const key = msgsKey(contactId);
  let msgs: Message[] = [];
  try {
    msgs = JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    msgs = [];
  }
  msgs.push(message);
  localStorage.setItem(key, JSON.stringify(msgs));
}

/** Returns stored messages for a contact, or an empty array. */
export function getMessages(contactId: string): Message[] {
  try {
    return JSON.parse(localStorage.getItem(msgsKey(contactId)) ?? '[]');
  } catch {
    return [];
  }
}
