/*
 * Which phone, browser and in-app browser a visitor is in, from the user agent: enough to pick the
 * right install path. Pure and server-safe. Researched 2026-11 (Chrome 157, Safari 27):
 *  - Android Chrome (≈95% of Android in México) fires beforeinstallprompt: our button + Chrome's
 *    "Instalar" = two taps. Other Android browsers install from their menu.
 *  - iPhone has no install API at all: the steps go through Safari's share sheet, and they differ by
 *    Safari version (27: "Menú de página" ≡, 26: "Más" •••, ≤18: Compartir in the toolbar). Safari 26+
 *    freezes the OS in the UA ("iPhone OS 18_6"), so the version comes from "Version/NN".
 *  - In-app browsers (Facebook, Instagram, TikTok…) can't install at all: the visitor has to get to
 *    Chrome or Safari first. WhatsApp chat links open in the default browser, so WhatsApp is fine
 *    (only its business-button browser, WA4A/WAiOS, is in-app).
 * Tokens drift with app updates; anything unrecognized falls through to the plain browser path.
 */

export type OS = "android" | "ios" | "desktop";
export type Browser = "chrome" | "samsung" | "firefox" | "edge" | "opera" | "safari" | "other";
export type InApp =
  | "facebook"
  | "instagram"
  | "threads"
  | "tiktok"
  | "linkedin"
  | "twitter"
  | "snapchat"
  | "line"
  | "telegram"
  | "wechat"
  | "google"
  | "whatsapp"
  | "webview";

export type Platform = {
  os: OS;
  browser: Browser;
  /** The app whose built-in browser this is (null = a real browser). */
  inApp: InApp | null;
  /** Safari's major version on iOS (picks the steps), else null. */
  safari: number | null;
};

/** What to call each app in the copy ("Estás dentro de …"). */
export const IN_APP_NAME: Record<InApp, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  twitter: "X",
  snapchat: "Snapchat",
  line: "LINE",
  telegram: "Telegram",
  wechat: "WeChat",
  google: "la app de Google",
  whatsapp: "WhatsApp",
  webview: "otra app",
};

function inAppOf(ua: string, os: OS): InApp | null {
  if (/\bInstagram\b/.test(ua)) return "instagram";
  if (/\bBarcelona\b/.test(ua)) return "threads";
  // Facebook and Messenger send the same tokens on Android (FB_IAB/FB4A); iOS: FBAN/FBIOS.
  if (/\bFB_IAB\b|\bFBAN\/|\bFBAV\/|\bFB4A\b|\bFBIOS\b|\bMessenger(?:ForiOS|Lite)?\//.test(ua)) return "facebook";
  if (/musical_ly|Bytedance|\btrill_/i.test(ua)) return "tiktok";
  if (/LinkedInApp/.test(ua)) return "linkedin";
  if (/Twitter for iPhone|TwitterAndroid/.test(ua)) return "twitter";
  if (/Snapchat/.test(ua)) return "snapchat";
  if (/\bLine\//.test(ua)) return "line";
  if (/MicroMessenger\//.test(ua)) return "wechat";
  if (/\bGSA\//.test(ua)) return "google";
  if (/\b(?:WAiOS|WA4A)\//.test(ua)) return "whatsapp";
  // Generic catch-alls: an Android WebView marks itself "; wv)"; an iOS WKWebView has no "Safari/".
  if (os === "android" && /;\s?wv\)/.test(ua)) return "webview";
  if (os === "ios" && !/Safari\//.test(ua)) return "webview";
  return null;
}

/**
 * `maxTouchPoints` (client only) tells an iPad from a Mac: iPadOS Safari reports "Macintosh".
 * `telegram`: Telegram's in-app browser is only detectable on the client (window.TelegramWebview).
 */
export function detectPlatform(ua: string, opts: { maxTouchPoints?: number; telegram?: boolean } = {}): Platform {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (opts.maxTouchPoints ?? 0) > 1);
  const os: OS = ios ? "ios" : /Android/.test(ua) ? "android" : "desktop";

  let browser: Browser = "other";
  if (os === "ios") {
    if (/CriOS\//.test(ua)) browser = "chrome";
    else if (/FxiOS\//.test(ua)) browser = "firefox";
    else if (/EdgiOS\//.test(ua)) browser = "edge";
    else if (/OPiOS\/|OPT\//.test(ua)) browser = "opera";
    else if (/Version\/\d+.*Safari\//.test(ua)) browser = "safari";
  } else if (/SamsungBrowser\//.test(ua)) browser = "samsung";
  else if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/EdgA?\//.test(ua)) browser = "edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "opera";
  else if (/MiuiBrowser|HuaweiBrowser|HeyTapBrowser|UCBrowser|YaBrowser|VivoBrowser/.test(ua)) browser = "other";
  else if (/Chrome\//.test(ua)) browser = "chrome";
  else if (/Version\/\d+.*Safari\//.test(ua)) browser = "safari";

  const inApp = opts.telegram ? "telegram" : inAppOf(ua, os);
  const v = os === "ios" && browser === "safari" ? /Version\/(\d+)/.exec(ua) : null;
  return { os, browser, inApp, safari: v ? Number(v[1]) : null };
}

/** Which iPhone steps to show: Safari 27 (≡ page menu), 26 (••• more), or 18 and older (toolbar Share). */
export type IosSteps = "safari27" | "safari26" | "safari18" | "other";
export function iosSteps(p: Platform): IosSteps {
  if (p.browser !== "safari") return "other";
  if (p.safari !== null && p.safari >= 27) return "safari27";
  if (p.safari === 26) return "safari26";
  return "safari18";
}

/**
 * How to leave an in-app browser for a real one, if anything works there (undocumented, best effort;
 * as of 2026-11). Android: an intent:// link with no package opens the default browser from the Meta
 * apps, Telegram and LINE; anywhere else a plain WebView would load it as a page and show an error, so
 * those get only the manual steps. iOS: Instagram has its own extbrowser scheme; Facebook/Threads
 * honor x-safari-https only through window.open; LinkedIn, Telegram, LINE, the Google app and other
 * WKWebViews through a plain navigation (an unknown scheme leaves the page as it is). TikTok, X,
 * Snapchat and WeChat block every escape.
 */
const ANDROID_INTENT_OK: readonly InApp[] = ["facebook", "instagram", "threads", "telegram", "line"];
export type Escape = { kind: "href" | "open"; url: string } | null;

export function escapeUrl(p: Platform, target: URL): Escape {
  const app = p.inApp;
  if (!app || app === "tiktok" || app === "twitter" || app === "snapchat" || app === "wechat") return null;
  if (p.os === "android") {
    if (!ANDROID_INTENT_OK.includes(app)) return null;
    const fallback = new URL(target);
    fallback.searchParams.set("iab", "fallo");
    const path = target.pathname + target.search;
    return {
      kind: "href",
      url: `intent://${target.host}${path}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(fallback.toString())};end`,
    };
  }
  if (p.os === "ios") {
    if (app === "instagram") return { kind: "href", url: `instagram://extbrowser/?url=${encodeURIComponent(target.toString())}` };
    const safari = `x-safari-${target.toString()}`;
    return app === "facebook" || app === "threads" ? { kind: "open", url: safari } : { kind: "href", url: safari };
  }
  return null;
}

/** Whether a tap can try to leave this in-app browser (else: only the manual steps). */
export function canEscape(p: Platform): boolean {
  return escapeUrl(p, new URL("https://chambarrio.com/instalar")) !== null;
}
