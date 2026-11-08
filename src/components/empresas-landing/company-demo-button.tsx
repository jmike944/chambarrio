"use client";

import { useEnterDemo } from "@/components/landing/demo-entry";

/** "Ver el panel de demostración": enters the company demo (Logística Zapalinamé) and opens /empresa. */
export function CompanyDemoButton({ className, children }: { className?: string; children: React.ReactNode }) {
  const enter = useEnterDemo();
  return (
    <button type="button" onClick={() => enter("empresa")} className={className}>
      {children}
    </button>
  );
}
