import { apiFetch } from "@/lib/api-client";

export type Person = {
  id: string; name: string; phone: string | null; email: string | null;
  company: string | null; role: string | null; category: string; tags: string[] | null;
  birthday: string | null; trustLevel: number; favorite: boolean; lastContactAt: string | null;
  _count?: { memories: number };
};
export type PersonMemory = { id: string; kind: string; title: string; detail: string | null; occurredAt: string };
export type PersonDetail = Person & { memories: PersonMemory[] };

export async function listPeople(q?: string) {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  const response = await apiFetch<{ people: Person[] }>(`/api/people${query}`);
  if (response.error) throw new Error(response.error.message);
  return response.data?.people ?? [];
}
export async function getPerson(id: string) {
  const response = await apiFetch<{ person: PersonDetail }>(`/api/people/${id}`);
  if (response.error || !response.data?.person) throw new Error(response.error?.message || "Person not found");
  return response.data.person;
}
export async function createPerson(input: { name: string; category: string; phone?: string; favorite?: boolean }) {
  const response = await apiFetch<{ person: Person }>("/api/people", { method: "POST", body: input });
  if (response.error || !response.data?.person) throw new Error(response.error?.message || "Could not add this person.");
  return response.data.person;
}
export async function importPeople(contacts: Array<{ name: string; phone?: string; email?: string }>) {
  const response = await apiFetch<{ imported: number; skipped: number }>("/api/people", { method: "POST", body: { contacts } });
  if (response.error) throw new Error(response.error.message);
  return response.data ?? { imported: 0, skipped: 0 };
}
export async function addPersonMemory(id: string, input: { kind: string; title: string; detail?: string }) {
  const response = await apiFetch<{ memory: PersonMemory }>(`/api/people/${id}/memories`, { method: "POST", body: input });
  if (response.error || !response.data?.memory) throw new Error(response.error?.message || "Could not save this memory.");
  return response.data.memory;
}
