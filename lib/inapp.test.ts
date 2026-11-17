/**
 * Run:  node lib/inapp.test.ts
 */
import assert from "node:assert/strict";
import { chromeIntentUrl, inAppBrowser } from "./inapp.ts";

const UA = {
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
  desktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]",
  whatsappAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1",
  unnamedAndroidWebView:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  unnamedIosWebView:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
};

// Real browsers are left alone.
assert.equal(inAppBrowser(UA.chromeAndroid), null);
assert.equal(inAppBrowser(UA.safariIos), null);
assert.equal(inAppBrowser(UA.chromeIos), null);
assert.equal(inAppBrowser(UA.desktop), null);

// Named apps.
assert.equal(inAppBrowser(UA.instagramIos), "Instagram");
assert.equal(inAppBrowser(UA.facebookAndroid), "Facebook");
assert.equal(inAppBrowser(UA.whatsappAndroid), "WhatsApp");

// Unnamed WebViews.
assert.equal(inAppBrowser(UA.unnamedAndroidWebView), "this app");
assert.equal(inAppBrowser(UA.unnamedIosWebView), "this app");

assert.equal(
  chromeIntentUrl("https://getgymrank.vercel.app/c/lnmiit?tab=squat"),
  "intent://getgymrank.vercel.app/c/lnmiit?tab=squat#Intent;scheme=https;package=com.android.chrome;end",
);

console.log("inapp: ok");
