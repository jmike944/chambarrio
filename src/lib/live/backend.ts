"use client";

import { applyLiveSnapshot, useApp, waitForPendingWrites } from "@/lib/store";
import * as api from "./api";
import type { ApplicationStatus } from "@/lib/data/types";
import type { JobInput, JobStatus, Result, WriteResult } from "./api";
import { useLiveAuth } from "./auth-state";
import { emitLive } from "./events";

/*
 * Live backend for screens. Every function returns { error?: string } (Spanish, ready for a toast)
 * and never throws. Prefer the store actions for anything the store holds (profile, home, saved,
 * applications, business, branches): they update the UI optimistically and roll back on error.
 * The raw functions re-exported here do NOT touch the store.
 */

export type {
  AvatarWriteResult,
  BusinessInput,
  CompanyPatch,
  ExperienceInput,
  LiveExperience,
  JobInput,
  JobStatus,
  LiveApplicant,
  LiveCompany,
  LiveSessionData,
  MyJob,
  ProfilePatch,
  Result,
  WriteResult,
} from "./api";
export {
  MSG,
  addBranch,
  apply,
  createBusiness,
  deleteExperience,
  fetchCatalog,
  fetchJob,
  fetchMyJobs,
  friendlyError,
  insertExperience,
  listApplicants,
  removeBranch,
  saveAvatarConfig,
  saveProfile,
  setHome,
  toggleSaved,
  updateBranch,
  updateCompany,
  updateExperience,
  withdraw,
} from "./api";

let sessionFlight: Promise<WriteResult> | null = null;

/**
 * Loads the signed-in user's profile, applications, saved vacancies and company into the store.
 * Called by <LiveSession/> on sign-in / page load; call it yourself for pull-to-refresh.
 * If the visitor finished onboarding before having an account, that draft is pushed first.
 */
export function loadSession(): Promise<WriteResult> {
  return (sessionFlight ??= runLoadSession().finally(() => {
    sessionFlight = null;
  }));
}

async function runLoadSession(): Promise<WriteResult> {
  const s0 = useApp.getState();
  if (s0.mode !== "live" || !s0.userId) return {};
  const userId = s0.userId;
  const stillMine = () => {
    const s = useApp.getState();
    return s.mode === "live" && s.userId === userId;
  };

  await waitForPendingWrites();
  let r = await api.fetchSessionData(userId);
  if (!stillMine()) return {};
  if (r.error === undefined && !r.data.profile.onboarded && useApp.getState().onboarded) {
    // Onboarding was finished locally (before the account existed, or the last push failed).
    const pushed = await useApp.getState().completeOnboarding(useApp.getState().role);
    if (!stillMine()) return {};
    if (!pushed.error) r = await api.fetchSessionData(userId);
  }
  if (!stillMine()) return {};
  if (r.error !== undefined) {
    useLiveAuth.setState({ sessionError: r.error });
    return { error: r.error };
  }
  applyLiveSnapshot(r.data);
  useLiveAuth.setState({ sessionLoaded: true, sessionError: undefined });
  return {};
}

function myCompanyId(): string | null {
  const s = useApp.getState();
  return s.mode === "live" ? (s.business?.id ?? null) : null;
}

/** Publishes a vacancy at one of my branches. Resolves with the new vacancy id. */
export async function publishJob(input: JobInput): Promise<Result<string>> {
  const companyId = myCompanyId();
  if (!companyId) return { error: api.MSG.noCompany };
  const r = await api.publishJob(companyId, input);
  if (r.error === undefined) emitLive("catalog", "myCompany");
  return r;
}

/** Edits one of my vacancies (any field of JobInput, including moving it to another branch). */
export async function updateJob(jobId: string, patch: Partial<JobInput>): Promise<WriteResult> {
  const r = await api.updateJob(jobId, patch);
  if (!r.error) emitLive("catalog", "myCompany");
  return r;
}

/** Pause / reopen / close one of my vacancies. */
export async function setJobStatus(jobId: string, status: JobStatus): Promise<WriteResult> {
  const r = await api.setJobStatus(jobId, status);
  if (!r.error) emitLive("catalog", "myCompany");
  return r;
}

/** The company moves an application along (vista → entrevista → contratada / cerrada). */
export async function setApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<WriteResult> {
  const r = await api.setApplicationStatus(applicationId, status);
  if (!r.error) emitLive("applicants", "myCompany");
  return r;
}
