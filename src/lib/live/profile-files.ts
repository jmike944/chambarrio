"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { trackWrite, useApp } from "@/lib/store";
import { MSG, saveProfile, type WriteResult } from "./api";
import { onLive } from "./events";

/*
 * The candidate's own photo and CV.
 *  - live: private buckets "avatars" (jpeg/png/webp ≤ 2 MB) and "cvs" (pdf ≤ 5 MB), files under
 *    "<user id>/…". Upload (XHR, so there's real progress) → profiles.avatar_path / cv_path → delete
 *    the old object. Previews use short-lived signed URLs (the owner may read their own folder).
 *  - demo: nothing leaves the device. The photo becomes a small data-URL thumbnail in the store,
 *    the CV an in-memory object URL (gone after a reload: "en el demo no guardamos archivos").
 * Every action toasts its own errors (like the store actions) and resolves { error? }.
 */

export type FileKind = "avatar" | "cv";
export type UploadStage = "preparando" | "subiendo" | "guardando";
export type UploadProgress = (p: { stage: UploadStage; /** 0–1 */ pct: number }) => void;

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_ACCEPT = AVATAR_TYPES.join(",");
export const CV_ACCEPT = "application/pdf,.pdf";
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const CV_MAX_BYTES = 5 * 1024 * 1024;
/** Longest side of the uploaded photo. */
export const AVATAR_MAX_PX = 1024;
/** Photos bigger than this aren't even decoded (a phone camera shot is ~3–8 MB). */
const AVATAR_RAW_MAX_BYTES = 25 * 1024 * 1024;
/** Demo thumbnail kept in localStorage. */
const DEMO_THUMB_PX = 384;

const SIGNED_TTL_S = 3600;
/** Re-sign a preview link older than this. */
const SIGNED_FRESH_MS = 50 * 60 * 1000;

export const FILE_MSG = {
  avatarType: "Sube una foto en JPG, PNG o WebP.",
  avatarHuge: "Esa foto pesa demasiado. Elige otra o toma una nueva.",
  avatarHeavy: "No pudimos dejar tu foto en menos de 2 MB. Prueba con otra.",
  avatarDecode: "No pudimos abrir esa foto. Prueba con otra en JPG o PNG.",
  cvType: "Tu CV debe ser un archivo PDF.",
  cvHeavy: "Tu CV pesa más de 5 MB. Guárdalo más ligero (por ejemplo, sin fotos) e intenta de nuevo.",
  cvMissing: "No encontramos tu CV. Súbelo otra vez.",
  noUser: MSG.session,
} as const;

// ------------------------------------------------------------------ image processing

const supportsWebpCanvas = (() => {
  let cached: boolean | null = null;
  return () => {
    if (cached !== null) return cached;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      cached = c.toDataURL("image/webp").startsWith("data:image/webp");
    } catch {
      cached = false;
    }
    return cached;
  };
})();

async function decodeImage(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF rotation of phone photos.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Resizes a photo so its longest side is ≤ maxPx and re-encodes it as WebP (JPEG where the browser
 * can't encode WebP), stepping the quality down until it fits `maxBytes`. Null when it can't.
 */
export async function compressImage(file: Blob, maxPx = AVATAR_MAX_PX, maxBytes = AVATAR_MAX_BYTES): Promise<Blob | null> {
  const img = await decodeImage(file);
  try {
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // White behind transparent PNGs (JPEG has no alpha).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, w, h);
    const type = supportsWebpCanvas() ? "image/webp" : "image/jpeg";
    for (const q of [0.86, 0.74, 0.62, 0.5]) {
      const blob = await canvasBlob(canvas, type, q);
      // Some browsers silently fall back to PNG for an unsupported type: retry as JPEG.
      if (blob && blob.type !== type) {
        const jpeg = await canvasBlob(canvas, "image/jpeg", q);
        if (jpeg && jpeg.size <= maxBytes) return jpeg;
        continue;
      }
      if (blob && blob.size <= maxBytes) return blob;
    }
    return null;
  } finally {
    img.close();
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const isAvatarType = (t: string) => (AVATAR_TYPES as readonly string[]).includes(t);

/** PDFs start with "%PDF-" (some Android pickers send an empty mime type). */
async function looksLikePdf(file: File): Promise<boolean> {
  if (file.type && file.type !== "application/pdf") return false;
  if (!file.type && !/\.pdf$/i.test(file.name)) return false;
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === "%PDF-";
  } catch {
    return file.type === "application/pdf";
  }
}

// ------------------------------------------------------------------ preview URLs (owner)

type Signed = { url: string; at: number; local?: boolean; /** Signing failed (missing file, offline): stop the spinner. */ failed?: boolean };
const usePreviewCache = create<{ urls: Record<string, Signed> }>()(() => ({ urls: {} }));
const signing = new Map<string, Promise<void>>();

function rememberUrl(path: string, url: string, local = false) {
  usePreviewCache.setState((s) => ({ urls: { ...s.urls, [path]: { url, at: Date.now(), local } } }));
}

function forgetUrl(path: string | null) {
  if (!path) return;
  const hit = usePreviewCache.getState().urls[path];
  if (hit?.local) URL.revokeObjectURL(hit.url);
  usePreviewCache.setState((s) => ({ urls: Object.fromEntries(Object.entries(s.urls).filter(([k]) => k !== path)) }));
}

onLive("reset", () => {
  for (const s of Object.values(usePreviewCache.getState().urls)) if (s.local) URL.revokeObjectURL(s.url);
  signing.clear();
  usePreviewCache.setState({ urls: {} }, true);
});

const bucketOf = (kind: FileKind) => (kind === "avatar" ? "avatars" : "cvs");

async function signPath(kind: FileKind, path: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.storage.from(bucketOf(kind)).createSignedUrl(path, SIGNED_TTL_S);
    return error || !data?.signedUrl ? null : data.signedUrl;
  } catch {
    return null;
  }
}

const usable = (hit: Signed | undefined): hit is Signed =>
  !!hit && !hit.failed && (!!hit.local || Date.now() - hit.at < SIGNED_FRESH_MS);

function ensureSigned(kind: FileKind, path: string) {
  // A failed entry is retried the next time a screen asks for it.
  if (usable(usePreviewCache.getState().urls[path])) return;
  if (signing.has(path)) return;
  const p = signPath(kind, path).then((url) => {
    signing.delete(path);
    if (url) rememberUrl(path, url);
    else usePreviewCache.setState((s) => ({ urls: { ...s.urls, [path]: { url: "", at: Date.now(), failed: true } } }));
  });
  signing.set(path, p);
}

/**
 * URL to preview the candidate's own photo / CV: live → a signed link (fetched on demand), demo →
 * the local thumbnail / object URL. `url` is null while loading or when there's no file (or, in the
 * demo, after a reload for the CV); `failed` is true when the link couldn't be signed.
 */
export function useOwnFileUrl(kind: FileKind): { url: string | null; path: string | null; failed?: boolean } {
  const mode = useApp((s) => s.mode);
  const path = useApp((s) => (kind === "avatar" ? s.avatarPath : s.cvPath));
  const demoAvatar = useApp((s) => s.demoAvatarUrl);
  const cached = usePreviewCache((s) => (path ? s.urls[path] : undefined));
  const live = mode === "live";

  useEffect(() => {
    if (live && path) ensureSigned(kind, path);
  }, [live, kind, path]);

  if (!path) return { url: null, path: null };
  if (!live) return { url: kind === "avatar" ? (demoAvatar ?? cached?.url ?? null) : (cached?.url ?? null), path };
  return { url: cached?.url || null, path, failed: !!cached?.failed };
}

/** Opens the candidate's own CV in a new tab (the tab opens at once so popup blockers allow it). */
export async function openOwnCv(): Promise<WriteResult> {
  const s = useApp.getState();
  const path = s.cvPath;
  if (!path) return fail(FILE_MSG.cvMissing);
  const hit = usePreviewCache.getState().urls[path];
  if (usable(hit)) {
    window.open(hit.url, "_blank", "noopener,noreferrer");
    return {};
  }
  if (s.mode !== "live") {
    toast("Tu CV de ejemplo", { description: "En el demo no guardamos archivos: el PDF solo se ve mientras no recargues." });
    return {};
  }
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  const url = await signPath("cv", path);
  if (!url) {
    tab?.close();
    return fail("No pudimos abrir tu CV. Intenta de nuevo.");
  }
  rememberUrl(path, url);
  if (tab) tab.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
  return {};
}

// ------------------------------------------------------------------ live upload

function fail(error: string): WriteResult {
  toast.error(error);
  return { error };
}

function storageError(status: number, body: string): string {
  const m = body.toLowerCase();
  if (status === 413 || m.includes("exceeded the maximum") || m.includes("too large")) return "El archivo es demasiado pesado.";
  if (m.includes("mime") || status === 415) return "Ese tipo de archivo no se permite.";
  if (status === 401 || m.includes("jwt")) return MSG.session;
  if (status === 403 || m.includes("row-level security") || m.includes("unauthorized")) return MSG.denied;
  return "No pudimos subir el archivo. Intenta de nuevo.";
}

/** Uploads with XMLHttpRequest (fetch has no upload progress). Never overwrites (x-upsert false). */
async function xhrUpload(bucket: string, path: string, body: Blob, contentType: string, onProgress: (pct: number) => void): Promise<WriteResult> {
  const sb = getSupabase();
  if (!sb || !SUPABASE_URL) return { error: MSG.unavailable };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: MSG.session };
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({});
      else resolve({ error: storageError(xhr.status, xhr.responseText ?? "") });
    };
    xhr.onerror = () => resolve({ error: MSG.offline });
    xhr.ontimeout = () => resolve({ error: "La subida tardó demasiado. Revisa tu conexión e intenta de nuevo." });
    xhr.send(body);
  });
}

async function removeObject(kind: FileKind, path: string | null) {
  if (!path) return;
  const sb = getSupabase();
  try {
    await sb?.storage.from(bucketOf(kind)).remove([path]);
  } catch {
    // An orphaned file is harmless (private bucket); nothing to tell the user.
  }
}

/** Ensures one upload per kind at a time. */
const busy = new Set<FileKind>();

async function liveUpload(kind: FileKind, body: Blob, contentType: string, ext: string, onProgress?: UploadProgress): Promise<WriteResult> {
  const s = useApp.getState();
  const uid = s.userId;
  if (!uid) return fail(FILE_MSG.noUser);
  const gen = uid;
  const path = `${uid}/${kind}-${Date.now()}.${ext}`;
  const bucket = bucketOf(kind);
  onProgress?.({ stage: "subiendo", pct: 0 });
  const up = await xhrUpload(bucket, path, body, contentType, (pct) => onProgress?.({ stage: "subiendo", pct }));
  if (up.error) return fail(up.error);
  onProgress?.({ stage: "guardando", pct: 1 });
  const column = kind === "avatar" ? "avatar_path" : "cv_path";
  const saved = await saveProfile({ [column]: path });
  const now = useApp.getState();
  if (now.mode !== "live" || now.userId !== gen) {
    // Signed out / switched account mid-upload: leave nothing behind.
    if (saved.error) void removeObject(kind, path);
    return {};
  }
  if (saved.error) {
    void removeObject(kind, path);
    return fail(saved.error);
  }
  const old = kind === "avatar" ? now.avatarPath : now.cvPath;
  useApp.setState(kind === "avatar" ? { avatarPath: path } : { cvPath: path });
  // Preview right away from the bytes we already have.
  rememberUrl(path, URL.createObjectURL(body), true);
  if (old && old !== path) {
    forgetUrl(old);
    void removeObject(kind, old);
  }
  return {};
}

/** Fake progress for the demo (so the showcase feels like the real thing). */
async function fakeProgress(onProgress?: UploadProgress) {
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    onProgress?.({ stage: "subiendo", pct: i / steps });
    await new Promise((r) => setTimeout(r, 90));
  }
}

// ------------------------------------------------------------------ public actions

/** Photo: JPG/PNG/WebP → resized to ≤ 1024 px, ≤ 2 MB → avatars/<uid>/avatar-<ts>.<ext>. */
export async function uploadAvatar(file: File, onProgress?: UploadProgress): Promise<WriteResult> {
  if (busy.has("avatar")) return {};
  if (!isAvatarType(file.type)) return fail(FILE_MSG.avatarType);
  if (file.size > AVATAR_RAW_MAX_BYTES) return fail(FILE_MSG.avatarHuge);
  busy.add("avatar");
  const run = (async (): Promise<WriteResult> => {
    onProgress?.({ stage: "preparando", pct: 0 });
    let blob: Blob | null;
    try {
      blob = await compressImage(file);
    } catch {
      return fail(FILE_MSG.avatarDecode);
    }
    if (!blob) return fail(FILE_MSG.avatarHeavy);
    if (blob.size > AVATAR_MAX_BYTES) return fail(FILE_MSG.avatarHeavy);
    const type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    const ext = type === "image/webp" ? "webp" : "jpg";

    const s = useApp.getState();
    if (s.mode !== "live") {
      let thumb: string | null = null;
      try {
        const small = await compressImage(blob, DEMO_THUMB_PX, 120 * 1024);
        thumb = small ? await blobToDataUrl(small) : null;
      } catch {
        thumb = null;
      }
      await fakeProgress(onProgress);
      const path = `demo/avatar-${Date.now()}.${ext}`;
      const old = useApp.getState().avatarPath;
      forgetUrl(old);
      if (!thumb) rememberUrl(path, URL.createObjectURL(blob), true);
      useApp.setState({ avatarPath: path, demoAvatarUrl: thumb });
      return {};
    }
    return liveUpload("avatar", blob, type, ext, onProgress);
  })();
  try {
    return await trackWrite(run);
  } finally {
    busy.delete("avatar");
  }
}

/** CV: a PDF ≤ 5 MB → cvs/<uid>/cv-<ts>.pdf. Remembers the original file name on this device. */
export async function uploadCv(file: File, onProgress?: UploadProgress): Promise<WriteResult> {
  if (busy.has("cv")) return {};
  if (!(await looksLikePdf(file))) return fail(FILE_MSG.cvType);
  if (file.size > CV_MAX_BYTES) return fail(FILE_MSG.cvHeavy);
  busy.add("cv");
  const run = (async (): Promise<WriteResult> => {
    const name = file.name.slice(0, 120) || "CV.pdf";
    if (useApp.getState().mode !== "live") {
      await fakeProgress(onProgress);
      const path = `demo/cv-${Date.now()}.pdf`;
      forgetUrl(useApp.getState().cvPath);
      rememberUrl(path, URL.createObjectURL(file), true);
      useApp.setState({ cvPath: path, cvFileName: name });
      return {};
    }
    const r = await liveUpload("cv", file, "application/pdf", "pdf", onProgress);
    if (!r.error) useApp.setState({ cvFileName: name });
    return r;
  })();
  try {
    return await trackWrite(run);
  } finally {
    busy.delete("cv");
  }
}

/** Removes the photo or CV (profile column first, then the stored object). */
export async function removeProfileFile(kind: FileKind): Promise<WriteResult> {
  const s = useApp.getState();
  const path = kind === "avatar" ? s.avatarPath : s.cvPath;
  if (!path) return {};
  const clear = () =>
    useApp.setState(kind === "avatar" ? { avatarPath: null, demoAvatarUrl: null } : { cvPath: null, cvFileName: null });
  if (s.mode !== "live") {
    forgetUrl(path);
    clear();
    return {};
  }
  const run = (async (): Promise<WriteResult> => {
    const r = await saveProfile(kind === "avatar" ? { avatar_path: null } : { cv_path: null });
    if (r.error) return fail(r.error);
    const now = useApp.getState();
    if ((kind === "avatar" ? now.avatarPath : now.cvPath) === path) clear();
    forgetUrl(path);
    void removeObject(kind, path);
    return {};
  })();
  return trackWrite(run);
}
