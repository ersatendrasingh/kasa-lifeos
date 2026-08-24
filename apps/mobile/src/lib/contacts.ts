import { getPermissionsAsync, requestPermissionsAsync } from "expo-contacts";
import { Fields, getContactsAsync } from "expo-contacts/legacy";
import * as SecureStore from "expo-secure-store";

import { importPeople } from "@/lib/people";

const IMPORT_BATCH_SIZE = 150;
const AUTO_SYNC_KEY = "kasa.people.last-contact-sync";
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1_000;

type ImportableContact = { name: string; phone?: string; email?: string };

function cleanPhone(value?: string) {
  const phone = value?.replace(/[^+\d]/g, "").trim();
  return phone && phone.replace(/\D/g, "").length >= 3 ? phone : undefined;
}

function cleanEmail(value?: string) {
  const email = value?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export async function hasPhoneContactsPermission() {
  const permission = await getPermissionsAsync();
  return permission.granted;
}

export async function shouldAutoSyncPhoneContacts() {
  const lastSync = await SecureStore.getItemAsync(AUTO_SYNC_KEY);
  return !lastSync || Date.now() - Number(lastSync) >= AUTO_SYNC_INTERVAL_MS;
}

async function markPhoneContactsSynced() {
  await SecureStore.setItemAsync(AUTO_SYNC_KEY, String(Date.now()));
}

export async function syncPhoneContacts(requestAccess: boolean, onProgress?: (value: number) => void) {
  onProgress?.(6);
  let permission = await getPermissionsAsync();
  if (!permission.granted && requestAccess && permission.canAskAgain) {
    permission = await requestPermissionsAsync();
  }
  if (!permission.granted) {
    throw new Error("Allow Contacts access to sync your phone contacts into KASA.");
  }

  onProgress?.(20);
  // The new class-based bulk reader crashes on this iOS device. The legacy
  // native reader is stable here and retrieves only name, phone and email.
  const response = await getContactsAsync({
    fields: [Fields.Name, Fields.PhoneNumbers, Fields.Emails],
    pageSize: 0,
  });
  const seen = new Set<string>();
  const contacts: ImportableContact[] = [];
  for (const contact of response.data) {
    const name = contact.name?.trim();
    if (!name || name.length < 2) continue;
    const phone = cleanPhone(contact.phoneNumbers?.[0]?.number);
    const email = cleanEmail(contact.emails?.[0]?.email);
    const key = phone ? `phone:${phone}` : `name:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({ name, ...(phone ? { phone } : {}), ...(email ? { email } : {}) });
  }

  if (!contacts.length) {
    await markPhoneContactsSynced();
    return { imported: 0, skipped: 0 };
  }
  let imported = 0;
  let skipped = 0;
  for (let offset = 0; offset < contacts.length; offset += IMPORT_BATCH_SIZE) {
    const batch = contacts.slice(offset, offset + IMPORT_BATCH_SIZE);
    const result = await importPeople(batch);
    imported += result.imported;
    skipped += result.skipped;
    onProgress?.(20 + Math.round(((offset + batch.length) / contacts.length) * 80));
  }
  await markPhoneContactsSynced();
  return { imported, skipped };
}
