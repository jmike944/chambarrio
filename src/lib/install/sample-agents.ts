/*
 * Real-world user agents (2026) for each install path: the detection test (scratch) and the dev-only
 * ?plataforma=<key> preview switch (lib/install/client) use them. Not shipped to production pages.
 */
export const SAMPLE_AGENTS: Record<string, { ua: string; touch?: number }> = {
  "android-chrome": {
    ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36",
    touch: 5,
  },
  samsung: {
    ua: "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A155M) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/136.0.0.0 Mobile Safari/537.36",
    touch: 5,
  },
  "android-firefox": { ua: "Mozilla/5.0 (Android 14; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0", touch: 5 },
  "android-facebook": {
    ua: "Mozilla/5.0 (Linux; Android 14; moto g84 5G Build/U1TC34.38; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/530.0.0.47.66;IABMV/1;]",
    touch: 5,
  },
  "android-instagram": {
    ua: "Mozilla/5.0 (Linux; Android 13; SM-A145M Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 Instagram 401.0.0.48.79 Android (33/13; 300dpi; 720x1600; samsung; SM-A145M; a14; mt6769; es_MX; 801153117)",
    touch: 5,
  },
  "android-tiktok": {
    ua: "Mozilla/5.0 (Linux; Android 13; 22111317G Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 trill_2023904050 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/39.4.5 ByteLocale/es-MX BytedanceWebview/d8a21c6",
    touch: 5,
  },
  ios27: {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.1 Mobile/15E148 Safari/604.1",
    touch: 5,
  },
  ios26: {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Mobile/15E148 Safari/604.1",
    touch: 5,
  },
  ios18: {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
    touch: 5,
  },
  "ios-chrome": {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/157.0.7469.25 Mobile/15E148 Safari/604.1",
    touch: 5,
  },
  "ios-facebook": {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/530.0.0.38.104;FBBV/812345678;FBDV/iPhone15,4;FBMD/iPhone;FBSN/iOS;FBSV/26.1;FBSS/3;FBID/phone;FBLC/es_LA;FBOP/5;FBRV/0;IABMV/1]",
    touch: 5,
  },
  "ios-instagram": {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E254 Instagram 424.1.0.31.54 (iPhone18,4; iOS 26_4_1; es_MX; es-MX; scale=3.00; 1290x2796; IABMV/1; 812345678) NW/3 Safari/604.1",
    touch: 5,
  },
  "ios-tiktok": {
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 musical_ly_41.9.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/es Region/MX",
    touch: 5,
  },
  ipad: {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
    touch: 5,
  },
  mac: {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
    touch: 0,
  },
  "desktop-chrome": {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
    touch: 0,
  },
};
