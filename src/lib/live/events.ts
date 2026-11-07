/**
 * Tiny pub-sub between the persisted store and the in-memory live caches (catalog, my company,
 * applicants). It has no imports, so any module can use it without creating an import cycle.
 *
 *  - "reset":      the user changed (enterDemo / exitDemo / sign-out / another account) → drop caches.
 *  - "catalog":    public vacancies/companies/branches changed → refetch the catalog.
 *  - "myCompany":  the employer's own company/branches/jobs changed → refetch them.
 *  - "applicants": an application changed → refetch applicant lists.
 */
export type LiveTopic = "reset" | "catalog" | "myCompany" | "applicants";

const listeners = new Map<LiveTopic, Set<() => void>>();

export function onLive(topic: LiveTopic, cb: () => void): () => void {
  let set = listeners.get(topic);
  if (!set) listeners.set(topic, (set = new Set()));
  set.add(cb);
  return () => set.delete(cb);
}

export function emitLive(...topics: LiveTopic[]): void {
  for (const t of topics) for (const cb of listeners.get(t) ?? []) cb();
}
