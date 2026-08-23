export const personCategories = [
  "FAMILY",
  "FRIEND",
  "WORK",
  "DOCTOR",
  "BANK",
  "VEHICLE",
  "HOME_SERVICE",
  "TEACHER",
  "LAWYER",
  "FREELANCER",
  "OTHER",
] as const;

export const personMemoryKinds = [
  "NOTE",
  "CALL",
  "MEETING",
  "MESSAGE",
  "DOCUMENT",
  "PAYMENT",
  "VISIT",
  "REMINDER",
] as const;

export type PersonCategory = (typeof personCategories)[number];
export type PersonMemoryKind = (typeof personMemoryKinds)[number];
