import { apiFetch } from "@/lib/api-client";
export type Mission={id:string;title:string;category:string;description:string|null;targetValue:number|null;currentValue:number|null;unit:string|null;milestones:Array<{id:string;title:string;completedAt:string|null}>};
export async function listMissions(){const r=await apiFetch<{missions:Mission[]}>("/api/missions");if(r.error)throw new Error(r.error.message);return r.data?.missions??[]}
export async function createMission(input:{title:string;category:string;description?:string;targetValue?:number;unit?:string;milestones:string[]}){const r=await apiFetch<{mission:Mission}>("/api/missions",{method:"POST",body:input});if(r.error||!r.data?.mission)throw new Error(r.error?.message||"Could not create mission.");return r.data.mission}
