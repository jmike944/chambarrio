/*
 * Hiring pipeline: one import for client components.
 *   import { useMyPipelines, usePipelineSummary, scheduleInterview, fmtDayTime, STEP_META } from "@/lib/pipeline";
 * Server components: import the pure helpers from their files instead ("@/lib/pipeline/time",
 * "/steps", "/places", "/ics", "/transitions") — the hooks below are client-only.
 * API reference: see the pipeline-api.md handed to the UI agents.
 */
export type {
  ApplicationPipeline,
  InterviewDetails,
  PipelineActor,
  PipelineEvent,
  PipelineEventChange,
  PipelineSummary,
  RecruiterNote,
  TeamActor,
} from "@/lib/data/types";

// Candidate side
export { refreshMyPipelines, useMyPipeline, useMyPipelines, withdrawApplication } from "./candidate";
export type { MyPipelineResult, MyPipelinesResult } from "./candidate";

// Company side
export {
  addNote,
  countSteps,
  decline,
  deleteNote,
  hire,
  markSeen,
  pipelineActions,
  reopen,
  restoreNote,
  scheduleInterview,
  upcomingInterviews,
  useApplicationPipeline,
  usePipelineSummary,
  withPipelineStatus,
} from "./recruiter";
export type { ApplicationPipelineResult, PipelineActions, PipelineCounts, PipelineSummaryResult } from "./recruiter";

// Rules, copy, validation
export {
  DEFAULT_DECLINE_MESSAGE,
  DEFAULT_UNHIRE_MESSAGE,
  MAIN_STEPS,
  MESSAGE_TEMPLATES,
  PIPELINE_LIMITS,
  PIPELINE_STEPS,
  RESCHEDULE_NOTICE,
  STEP_META,
  UNHIRE_COPY,
  DECLINE_UNDO_MS,
  canWithdraw,
  eventChange,
  isClosed,
  isWithdrawn,
  recruiterCan,
  stepMeta,
  stepOf,
  trackIndex,
  wasHiredBeforeClose,
} from "./steps";
export type { MainStep, PipelineStep, StepMeta } from "./steps";
export { PIPELINE_MSG, declineUndoable, transition, validateInterview, validateMessage, validateNote } from "./transitions";
export type { InterviewInput } from "./transitions";

// Time (always America/Monterrey, es-MX)
export {
  MTY_TZ,
  addDaysToKey,
  capitalize,
  defaultInterviewInput,
  fmtDate,
  fmtDateLong,
  fmtDayTime,
  fmtDayTimeLong,
  fmtRelative,
  fmtTime,
  fromZonedInput,
  isPast,
  isSameMtyDay,
  mtyDateKey,
  mtyDayDiff,
  mtyInstant,
  mtyWall,
  nextWorkdayAt,
  relativeDayWord,
  toMs,
  toZonedInput,
  todayInputKey,
} from "./time";
export type { DateInput, MtyWall, ZonedInput } from "./time";
export { useNow } from "./use-now";

// Places & calendar
export { defaultInterviewPlace, directionsLink, mapsLink } from "./places";
export { buildInterviewIcs, downloadIcs, formatPhoneMx, icsBlob, icsDataUrl, icsFileName, icsObjectUrl } from "./ics";
export type { InterviewIcsInput } from "./ics";
export { interviewIcsFor } from "./ics-for";
