import { AppShell, EMPLOYER_NAV } from "@/components/chamba/app-shell";

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={EMPLOYER_NAV} mode="empresa">
      {children}
    </AppShell>
  );
}
