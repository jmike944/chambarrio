"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConfetti } from "@/components/chamba/motion";
import { COMPANY_BY_ID, DEMO_COMPANY_ID } from "@/lib/data/jobs";
import { useLiveAuth } from "@/lib/live/auth-state";
import { loadSession } from "@/lib/live/backend";
import { signOutEverywhere, useLiveUser, useSessionLoaded, useSessionReady } from "@/lib/live/session";
import { useApp, useHydrated } from "@/lib/store";
import { sendCode, verifyCode } from "@/lib/supabase/auth";
import {
  DEMO_RECRUITER_BRANCH,
  DEMO_RECRUITER_ID,
  INVITE_TTL_DAYS,
  acceptInvite,
  previewInvite,
  setDemoViewAs,
  useMyMembership,
  useTeam,
  type InvitePreview,
  type TeamResult,
} from "@/lib/team";
import { WORK_CONFETTI } from "./flow";
import { JoinTeamScreen, type JoinActions, type JoinStage } from "./join-team-screen";
import { invitePath } from "./next-path";

/*
 * /unirse?t=<token>: accept a team invite.
 *  - live: invite_preview (works signed out) → sign in with an email code (the link in that email comes
 *    back here) → accept_invite → confetti → /empresa. An onboarded candidate account first chooses
 *    "Usar mi cuenta como empresa" or another email.
 *  - demo (/unirse?demo=1, or a demo team's "demo-…" link): the same screens with sample data; nothing
 *    is sent and Supabase is never called.
 * Token hygiene: the token only goes to previewInvite / acceptInvite and into the sign-in link's
 * `next`; it's never logged, stored or shown. The page sets referrer "no-referrer" and loads no
 * third-party scripts.
 */

function subscribeNothing() {
  return () => {};
}

/** location.search on the client; null while rendering on the server (the token never reaches it). */
function useSearch(): string | null {
  return useSyncExternalStore(subscribeNothing, () => window.location.search, () => null);
}

const NOOP_ACTIONS: JoinActions = {
  sendCode: async () => null,
  verifyCode: async () => null,
  changeEmail: () => {},
  join: () => {},
  useCompanyAccount: () => {},
  candidateOther: () => {},
  backToChoice: () => {},
  switchAccount: () => {},
  retry: () => {},
};

export function JoinTeam() {
  const search = useSearch();
  const params = useMemo(() => (search === null ? null : new URLSearchParams(search)), [search]);
  if (!params) return <JoinTeamScreen stage={{ kind: "loading" }} invite={null} actions={NOOP_ACTIONS} />;
  const token = params.get("t")?.trim() || null;
  if (params.get("demo") === "1" || token?.startsWith("demo-")) return <DemoJoin />;
  return <LiveJoin token={token} />;
}

/* ================================================================== live */

type Preview = TeamResult<InvitePreview | null>;

function LiveJoin({ token }: { token: string | null }) {
  const router = useRouter();
  const fire = useConfetti();
  const hydrated = useHydrated();
  const ready = useSessionReady();
  const loaded = useSessionLoaded();
  const sessionError = useLiveAuth((s) => s.sessionError);
  const mode = useApp((s) => s.mode);
  const signedIn = useApp((s) => s.signedIn);
  const onboarded = useApp((s) => s.onboarded);
  const role = useApp((s) => s.role);
  const name = useApp((s) => s.name);
  const userId = useApp((s) => s.userId);
  const storeEmail = useApp((s) => s.email);
  const setRole = useApp((s) => s.setRole);
  const { user } = useLiveUser();
  const my = useMyMembership();
  const live = mode === "live" && signedIn;
  const back = token ? invitePath(token) : "/unirse";

  // 1. Leave the demo, or a local onboarding draft: otherwise signing in would save that draft as a
  //    new business, and joining would then fail with "other_company".
  const leaving = hydrated && (mode === "demo" || (mode === null && onboarded));
  useEffect(() => {
    if (leaving) useApp.getState().exitDemo();
  }, [leaving]);

  // 2. The invite, read again whenever the account changes (emailMatches) or on "Intentar de nuevo".
  const [nonce, setNonce] = useState(0);
  const key = `${live ? (userId ?? "") : ""}#${nonce}`;
  const [read, setRead] = useState<{ key: string; r: Preview } | null>(null);
  const canRead = !!token && hydrated && ready && !leaving;
  useEffect(() => {
    if (!canRead || !token) return;
    let alive = true;
    void previewInvite(token).then((r) => {
      if (alive) setRead({ key, r });
    });
    return () => {
      alive = false;
    };
  }, [canRead, token, key]);

  const [codeTo, setCodeTo] = useState<string | null>(null);
  /** The last email a code went to: "Cambiar correo" starts from it. */
  const [lastEmail, setLastEmail] = useState("");
  const [override, setOverride] = useState<JoinStage | null>(null);
  const [other, setOther] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** Signed in from this page (a code was sent here): join as soon as the account is ready. */
  const autoJoin = useRef(false);
  const doneRef = useRef(false);

  // Routes stay mounted after navigating away (cacheComponents): coming back starts fresh.
  useLayoutEffect(() => {
    return () => {
      if (!doneRef.current) return;
      doneRef.current = false;
      setDone(false);
      setBusy(false);
      setOverride(null);
      setNonce((n) => n + 1);
    };
  }, []);

  const fresh = read?.key === key ? read.r : null;
  const shown = read?.r ?? null;
  const invite = shown && shown.error === undefined ? shown.data : null;
  const accountEmail = user?.email ?? (storeEmail || null);
  const otherCompany = my.membership && invite && my.membership.companyName !== invite.companyName ? my.membership.companyName : null;
  const alreadyMember = live && !!invite && my.membership?.companyName === invite.companyName;

  let stage: JoinStage;
  if (!token) stage = { kind: "missing" };
  else if (done) stage = { kind: "done" };
  else if (!shown) stage = { kind: "loading" };
  else if (shown.error !== undefined) stage = fresh ? { kind: "error", message: shown.error } : { kind: "loading" };
  else if (!invite) stage = { kind: "gone", reason: "not_found" };
  else if (override) stage = override;
  else if (invite.status !== "vigente") stage = { kind: "gone", reason: invite.status };
  else if (!live) stage = codeTo ? { kind: "code", email: codeTo } : { kind: "email" };
  else if (!loaded) stage = sessionError ? { kind: "error", message: sessionError } : { kind: "checking" };
  else if (!fresh || invite.emailMatches === null || my.status === "loading") stage = { kind: "checking" };
  else if (invite.emailMatches === false) stage = { kind: "wrong_email" };
  else if (otherCompany) stage = { kind: "other_company" };
  else if (role === "candidato" && onboarded) stage = { kind: other ? "candidate-other" : "candidate" };
  else stage = { kind: "join", askName: !name.trim() };

  async function join(nameArg?: string, asCompany = false) {
    if (!token || busy) return;
    setBusy(true);
    setProblem(null);
    const r = await acceptInvite(token, nameArg);
    if (r.error !== undefined) {
      setBusy(false);
      switch (r.code) {
        case "invite_expired":
          return setOverride({ kind: "gone", reason: "vencida" });
        case "invite_revoked":
          return setOverride({ kind: "gone", reason: "cancelada" });
        case "invite_used":
          return setOverride({ kind: "gone", reason: "usada" });
        case "invite_not_found":
          return setOverride({ kind: "gone", reason: "not_found" });
        case "wrong_email":
          return setOverride({ kind: "wrong_email" });
        case "other_company":
          return setOverride({ kind: "other_company" });
        case "limit":
          return setOverride({ kind: "limit", message: r.error });
        case "email_unconfirmed":
          return setOverride({ kind: "unconfirmed" });
        case "not_signed_in":
          // The session ended under us: sign in again on this same invite.
          await signOutEverywhere();
          window.location.href = back;
          return;
        default:
          return setProblem(r.error);
      }
    }
    if (r.data.profileRole === "candidato") {
      // An onboarded candidate account keeps its role in the database: it becomes a company account
      // only by choice. (Joining again is safe: accepting is idempotent for the same account.)
      if (!asCompany) {
        setBusy(false);
        setOther(false);
        return setOverride({ kind: "candidate" });
      }
      const w = await setRole("empresa"); // toasts its own error
      if (w.error) {
        setBusy(false);
        return setProblem(w.error);
      }
    }
    doneRef.current = true;
    setDone(true);
    fire({ colors: WORK_CONFETTI });
    toast.success(`¡Ya eres parte de ${r.data.companyName || invite?.companyName || "tu equipo"}!`);
    router.replace("/empresa");
  }

  // Signed in from this page with nothing left to ask: join right away (no extra tap).
  const ready2join = stage.kind === "join" && !stage.askName;
  useEffect(() => {
    if (!ready2join || !autoJoin.current) return;
    autoJoin.current = false;
    void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the account is ready
  }, [ready2join]);

  const actions: JoinActions = {
    async sendCode(email) {
      if (live) {
        setBusy(true);
        setProblem(null);
      }
      const err = await sendCode("email", email, "empresa", back);
      setBusy(false);
      if (err) {
        if (live) setProblem(err);
        return err;
      }
      toast.success(`Te enviamos un correo a ${email}.`);
      if (live) setOverride({ kind: "code", email });
      else {
        autoJoin.current = true;
        setLastEmail(email);
        setCodeTo(email);
      }
      return null;
    },
    async verifyCode(code) {
      const email = stage.kind === "code" ? stage.email : "";
      const err = await verifyCode("email", email, code);
      if (err) return err;
      if (live) {
        // Confirming the email of the account already signed in: now join.
        setOverride(null);
        void join();
      } else autoJoin.current = true;
      return null;
    },
    changeEmail: () => setCodeTo(null),
    join: (n) => void join(n),
    useCompanyAccount: () => void join(undefined, true),
    candidateOther: () => setOther(true),
    backToChoice: () => setOther(false),
    async switchAccount() {
      setBusy(true);
      await signOutEverywhere();
      window.location.href = back;
    },
    retry() {
      if (stage.kind === "limit") return void join();
      setOverride(null);
      setProblem(null);
      setNonce((n) => n + 1);
      if (sessionError) void loadSession();
    },
  };

  return (
    <JoinTeamScreen
      stage={stage}
      invite={invite}
      actions={actions}
      signedIn={live}
      accountEmail={live ? accountEmail : null}
      otherCompany={otherCompany}
      alreadyMember={alreadyMember}
      busy={busy}
      problem={problem}
      defaultEmail={lastEmail}
      passwordHref={`/entrar?next=${encodeURIComponent(back)}`}
      homeHref={live ? (role === "empresa" ? "/empresa" : "/inicio") : "/"}
    />
  );
}

/* ================================================================== demo */

/** The demo team's reclutador (see @/lib/team demo): the sample invite is hers. */
const SAMPLE_EMAIL = "lupita.garza@ejemplo.com";

/** Same masking as the database's mask_email(): "lu•••@ejemplo.com". */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? `${email.slice(0, Math.min(2, at))}•••@${email.slice(at + 1)}` : "•••";
}

const DAY = 24 * 60 * 60 * 1000;

function DemoJoin() {
  const hydrated = useHydrated();
  const demoEmpresa = useApp((s) => s.mode === "demo" && s.role === "empresa");
  if (!hydrated) return <JoinTeamScreen stage={{ kind: "loading" }} invite={null} actions={NOOP_ACTIONS} />;
  return demoEmpresa ? <DemoFromTeam /> : <DemoWalk />;
}

/** In the business demo: show the invite the demo dueño just made (or the sample one). */
function DemoFromTeam() {
  const team = useTeam();
  const owner = useApp((s) => s.name);
  const business = useApp((s) => s.business);
  const pending = team.invites.find((i) => !i.expired) ?? null;
  const locations = business?.locations ?? COMPANY_BY_ID[DEMO_COMPANY_ID].locations;
  const invite: InvitePreview | null = pending
    ? {
        status: "vigente",
        companyName: business?.name ?? COMPANY_BY_ID[DEMO_COMPANY_ID].name,
        role: pending.role,
        branchNames: pending.branchIds ? pending.branchIds.map((id) => locations.find((b) => b.id === id)?.name ?? "Sucursal") : null,
        inviterName: owner || "Mariana",
        emailHint: maskEmail(pending.email),
        expiresAt: pending.expiresAt,
        emailMatches: null,
      }
    : null;
  return <DemoWalk invite={invite} email={pending?.email} inDemo />;
}

function DemoWalk({ invite: given, email, inDemo = false }: { invite?: InvitePreview | null; email?: string; inDemo?: boolean }) {
  const router = useRouter();
  const fire = useConfetti();
  const owner = useApp((s) => s.name);
  const [sample] = useState<InvitePreview>(() => {
    const company = COMPANY_BY_ID[DEMO_COMPANY_ID];
    return {
      status: "vigente",
      companyName: company.name,
      role: "reclutador",
      branchNames: [company.locations.find((b) => b.id === DEMO_RECRUITER_BRANCH)?.name ?? "CEDIS Santa Mónica"],
      inviterName: (inDemo && owner) || "Mariana",
      emailHint: maskEmail(SAMPLE_EMAIL),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY).toISOString(),
      emailMatches: null,
    };
  });
  const invite = given ?? sample;
  const fromTeam = !!given; // an invite the demo dueño made (not the sample reclutador)
  const [stage, setStage] = useState<JoinStage>({ kind: "email" });
  const timer = useRef<number | null>(null);
  const finished = useRef(false);
  // Routes stay mounted after navigating away (cacheComponents): coming back starts the walk over.
  useLayoutEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (!finished.current) return;
      finished.current = false;
      setStage({ kind: "email" });
    };
  }, []);

  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  function finish() {
    finished.current = true;
    setStage({ kind: "done" });
    fire({ colors: WORK_CONFETTI });
    toast.success(fromTeam ? `Demo: así entra ${email ?? "tu invitado"} a tu equipo.` : `¡Ya eres parte de ${invite.companyName}!`);
    timer.current = window.setTimeout(() => {
      if (fromTeam) {
        router.replace("/empresa/equipo");
        return;
      }
      // The sample is Lupita's invite: open the business demo as her (reclutador, CEDIS Santa Mónica).
      if (!inDemo) useApp.getState().enterDemo("empresa");
      setDemoViewAs(DEMO_RECRUITER_ID);
      router.replace("/empresa");
    }, 1400);
  }

  const actions: JoinActions = {
    ...NOOP_ACTIONS,
    async sendCode(to) {
      await wait(450);
      toast.success(`Demo: haz como que te llegó un código a ${to}.`);
      setStage({ kind: "code", email: to });
      return null;
    },
    async verifyCode() {
      await wait(450);
      finish();
      return null;
    },
    changeEmail: () => setStage({ kind: "email" }),
  };

  return (
    <JoinTeamScreen
      stage={stage}
      invite={invite}
      actions={actions}
      demo
      defaultEmail={email ?? SAMPLE_EMAIL}
      passwordHref={null}
      homeHref={inDemo ? "/empresa" : "/"}
    />
  );
}
