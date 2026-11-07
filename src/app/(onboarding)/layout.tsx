/** Focused, full-screen flows: no app navigation. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
