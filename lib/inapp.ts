/*
  Google refuses OAuth inside apps' built-in browsers (WhatsApp, Instagram
  and friends), and those browsers also lose or replay the sign-in cookie.
  Spot them from the user agent so we can send people to a real browser
  before they hit Google's error. Apps that don't name themselves are
  caught by the generic WebView markers; any that slip past still land on
  /me's retry note.
*/

const APPS: [RegExp, string][] = [
  [/WhatsApp/i, "WhatsApp"],
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB/i, "Facebook"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Snapchat/i, "Snapchat"],
  [/musical_ly|BytedanceWebview|TikTok/i, "TikTok"],
  [/Twitter/i, "X"],
  [/\bLine\//i, "LINE"],
  [/Telegram/i, "Telegram"],
];

/** The app whose built-in browser this is, "this app" if unnamed, or null. */
export function inAppBrowser(ua: string): string | null {
  for (const [re, name] of APPS) if (re.test(ua)) return name;
  // Android WebView marks itself "; wv)".
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return "this app";
  // iOS: every real browser (Safari, Chrome, Firefox, Edge) says "Safari/";
  // a bare WKWebView doesn't.
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) {
    return "this app";
  }
  return null;
}

export function isAndroid(ua: string): boolean {
  return /Android/i.test(ua);
}

/** Opens the same page in Chrome from an Android in-app browser. */
export function chromeIntentUrl(href: string): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
