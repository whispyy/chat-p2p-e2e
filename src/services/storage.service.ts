import type { Contact, Message } from '../types';
import { defaultPeerName, getMyId, setMyId } from './identity.service';

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

// ─── Backup / restore ─────────────────────────────────────────────────────

export interface BackupData {
  version: 1;
  exportedAt: number;
  myId: string | null;
  contacts: Record<string, Contact>;
  messages: Record<string, Message[]>;
}

/** Serialises the full app state to a JSON string. */
export function exportData(): string {
  const contacts = readAllContacts();
  const messages: Record<string, Message[]> = {};
  for (const id of Object.keys(contacts)) {
    messages[id] = getMessages(id);
  }
  const payload: BackupData = {
    version: 1,
    exportedAt: Date.now(),
    myId: getMyId(),
    contacts,
    messages,
  };
  return JSON.stringify(payload, null, 2);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function validateBackup(raw: unknown): BackupData {
  if (!isPlainObject(raw)) throw new Error('Backup file is not a valid JSON object.');
  if (raw['version'] !== 1) throw new Error('Unsupported backup version.');
  if (raw['myId'] !== null && typeof raw['myId'] !== 'string')
    throw new Error('Backup file is corrupt: invalid identity.');

  if (!isPlainObject(raw['contacts']))
    throw new Error('Backup file is corrupt: contacts must be an object.');
  if (!isPlainObject(raw['messages']))
    throw new Error('Backup file is corrupt: messages must be an object.');

  for (const [id, contact] of Object.entries(raw['contacts'])) {
    if (!isPlainObject(contact) || typeof contact['id'] !== 'string' || typeof contact['name'] !== 'string' || typeof contact['lastSeen'] !== 'number')
      throw new Error(`Backup file is corrupt: invalid contact "${id}".`);
  }

  for (const [id, msgs] of Object.entries(raw['messages'])) {
    if (!Array.isArray(msgs)) throw new Error(`Backup file is corrupt: messages for "${id}" must be an array.`);
    for (const msg of msgs) {
      if (!isPlainObject(msg) || typeof msg['id'] !== 'string' || typeof msg['text'] !== 'string' || typeof msg['fromMe'] !== 'boolean' || typeof msg['timestamp'] !== 'number')
        throw new Error(`Backup file is corrupt: invalid message in conversation "${id}".`);
    }
  }

  return raw as unknown as BackupData;
}

/** Restores app state from a previously exported JSON string. Throws on invalid input. */
export function importData(json: string): void {
  const data = validateBackup(JSON.parse(json));

  if (data.myId) setMyId(data.myId);
  writeAllContacts(data.contacts);
  for (const [id, msgs] of Object.entries(data.messages)) {
    localStorage.setItem(msgsKey(id), JSON.stringify(msgs));
  }
}

/** Removes all peer-chat:* keys from localStorage. */
export function clearData(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('peer-chat:')) toRemove.push(key);
  }
  toRemove.forEach((key) => localStorage.removeItem(key));
}
