import type { AuthorMeta } from '@/data/types';

export const ROLE_OPTIONS = [
  { id: 'intern', label: 'Intern' },
  { id: 'apprentice', label: 'Apprentice / Graduate trainee' },
  { id: 'engineer', label: 'Engineer' },
  { id: 'senior_engineer', label: 'Senior Engineer / Specialist' },
  { id: 'technician', label: 'Technician / Field Service' },
  { id: 'operations', label: 'Operations / Production' },
  { id: 'sales', label: 'Sales / Customer-facing' },
  { id: 'project_manager', label: 'Project Manager' },
  { id: 'manager', label: 'Team Lead / Manager' },
  { id: 'hr', label: 'HR' },
  { id: 'it', label: 'IT' },
  { id: 'finance', label: 'Finance / Admin' },
  { id: 'other', label: 'Other / Prefer not to say' },
] as const;

/** Deliberately coarse bands so a role + band doesn't single anyone out. */
export const EXPERIENCE_OPTIONS = [
  { id: 'lt1', label: 'Less than 1 year', short: '<1 yr' },
  { id: '1to3', label: '1–3 years', short: '1–3 yrs' },
  { id: '3to5', label: '3–5 years', short: '3–5 yrs' },
  { id: '5to10', label: '5–10 years', short: '5–10 yrs' },
  { id: '10plus', label: '10+ years', short: '10+ yrs' },
] as const;

export const roleLabel = (id: string | null | undefined) => ROLE_OPTIONS.find((r) => r.id === id)?.label ?? null;
export const experienceLabel = (id: string | null | undefined) => EXPERIENCE_OPTIONS.find((e) => e.id === id)?.label ?? null;
const experienceShort = (id: string | null | undefined) => EXPERIENCE_OPTIONS.find((e) => e.id === id)?.short ?? null;

/** "Engineer · 3–5 yrs at ABB", or null when nothing is shown. */
export function authorLine(a: AuthorMeta | null): string | null {
  if (!a) return null;
  const role = a.role === 'other' ? null : roleLabel(a.role);
  const exp = experienceShort(a.experience);
  const parts = [role, exp ? `${exp} at ABB` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
