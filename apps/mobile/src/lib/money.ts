import { apiFetch } from "@/lib/api-client";

export type LedgerDirection = "LENT" | "BORROWED" | "RECEIVED" | "PAID";

export type MoneyPerson = {
  id: string;
  name: string;
  phone: string | null;
  category: string | null;
  balance: number;
};

export type LedgerEntry = {
  id: string;
  personId: string;
  direction: LedgerDirection;
  amount: number;
  note: string | null;
  occurredAt: string;
  person: Pick<MoneyPerson, "id" | "name" | "phone">;
};

export type MoneyTransaction = {
  id: string;
  kind: "INCOME" | "EXPENSE";
  title: string;
  amount: number;
  category: string | null;
  note: string | null;
  occurredAt: string;
};

export type MoneyWorkspace = {
  people: Omit<MoneyPerson, "balance">[];
  contacts: MoneyPerson[];
  ledger: LedgerEntry[];
  transactions: MoneyTransaction[];
  summary: { income: number; spend: number };
};

async function request<T>(path: string, body?: unknown) {
  const result = await apiFetch<T>(path, body ? { method: "POST", body } : {});
  if (!result.data)
    throw new Error(result.error?.message || "Money is unavailable");
  return result.data;
}

export function getMoneyWorkspace() {
  return request<MoneyWorkspace>("/api/money");
}

export function createLedgerEntry(input: {
  personId: string;
  direction: LedgerDirection;
  amount: number;
  note?: string;
}) {
  return request<MoneyWorkspace>("/api/money", { action: "ledger", ...input });
}

export function createMoneyTransaction(input: {
  kind: "INCOME" | "EXPENSE";
  title: string;
  amount: number;
  category?: string;
  note?: string;
}) {
  return request<MoneyWorkspace>("/api/money", {
    action: "transaction",
    ...input,
  });
}

export type PersonKhata = { person: MoneyPerson; entries: LedgerEntry[] };

export async function getPersonKhata(personId: string) {
  const result = await apiFetch<PersonKhata>(`/api/money/${personId}`);
  if (!result.data)
    throw new Error(result.error?.message || "Khata is unavailable");
  return result.data;
}

export async function sendKhataReminder(personId: string) {
  const result = await apiFetch(`/api/money/${personId}`, {
    method: "POST",
  });
  if (result.error) throw new Error(result.error.message);
}
