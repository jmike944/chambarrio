import { AppShell, CANDIDATE_NAV } from "@/components/chamba/app-shell";

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={CANDIDATE_NAV} mode="candidato">
      {children}
    </AppShell>
  );
}
