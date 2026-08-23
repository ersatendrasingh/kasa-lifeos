import {
  Contact,
  ContactField,
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-contacts";

import { importPeople } from "@/lib/people";

export async function importPhoneContacts(onProgress?: (value: number) => void) {
  onProgress?.(8);
  let permission = await getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await requestPermissionsAsync();
  }
  if (!permission.granted) throw new Error("Allow Contacts access in Settings to import your phone contacts.");
  onProgress?.(20);
  const contactsWithDetails = await Contact.getAllDetails([
    ContactField.FULL_NAME,
    ContactField.PHONES,
    ContactField.EMAILS,
  ] as const);
  onProgress?.(55);
  const contacts = contactsWithDetails
    .filter((contact) => contact.fullName?.trim())
    .map((contact) => ({
      name: contact.fullName!.trim(),
      phone: contact.phones?.[0]?.number,
      email: contact.emails?.[0]?.address,
    }));
  if (!contacts.length) return { imported: 0, skipped: 0 };
  onProgress?.(75);
  const result = await importPeople(contacts);
  onProgress?.(100);
  return result;
}
