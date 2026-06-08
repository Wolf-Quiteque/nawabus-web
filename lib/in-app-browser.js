export function getUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || navigator.vendor || "";
}

export function isRestrictedInAppBrowser() {
  const userAgent = getUserAgent();
  return /Instagram|FBAN|FBAV|FB_IAB|FB4A|FBIOS|Messenger/i.test(userAgent);
}

export function getInAppBrowserName() {
  const userAgent = getUserAgent();
  if (/Instagram/i.test(userAgent)) return "Instagram";
  if (/Messenger/i.test(userAgent)) return "Messenger";
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(userAgent)) return "Facebook";
  return "app";
}

export function buildExternalBrowserUrl(url) {
  if (typeof window === "undefined") return url;

  const absoluteUrl = new URL(url, window.location.href).toString();
  const parsed = new URL(absoluteUrl);
  const userAgent = getUserAgent();

  if (/Android/i.test(userAgent)) {
    return `intent://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}#Intent;scheme=${parsed.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(absoluteUrl)};end`;
  }

  if (/CriOS|Chrome/i.test(userAgent)) {
    return absoluteUrl.replace(/^https?:\/\//, parsed.protocol === "https:" ? "googlechromes://" : "googlechrome://");
  }

  return absoluteUrl;
}

export async function copyLinkToClipboard(url) {
  if (typeof window === "undefined") return false;

  const absoluteUrl = new URL(url, window.location.href).toString();
  try {
    await navigator.clipboard.writeText(absoluteUrl);
    return true;
  } catch {
    return false;
  }
}

export function openExternalBrowser(url) {
  if (typeof window === "undefined") return;
  window.location.href = buildExternalBrowserUrl(url);
}
