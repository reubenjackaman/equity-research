// Anonymous usage counting (see backend/data/usage.py). Nothing is stored in the browser for this, and
// browsers that send "Do Not Track" or "Global Privacy Control" aren't counted (checked here and on the server).
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export type UsageEvent =
  | "view_home" | "view_company" | "view_market" | "view_learn" | "view_pitch_doc" | "view_shared_pitch" | "view_other"
  | "pitch_started" | "pitch_pdf" | "pitch_shared" | "pitch_copied";

const optedOut = () =>
  navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

export function track(event: UsageEvent, ticker = "") {
  if (optedOut()) return;
  const body = JSON.stringify({ event, ticker });
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {}
  fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}

const MARKET_PATHS = ["/wei", "/most", "/rates", "/eco", "/earnings", "/monitor", "/screener", "/help", "/game"];

/** Counts one page view each time the page (not just a tab within it) changes. */
export function usePageViews() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const company = pathname.match(/^\/company\/([^/]+)(\/pitch)?$/);
    if (pathname === "/") track("view_home");
    else if (company?.[2]) track(hash.includes("p=") ? "view_shared_pitch" : "view_pitch_doc", decodeURIComponent(company[1]).toUpperCase());
    else if (company) track("view_company", decodeURIComponent(company[1]).toUpperCase());
    else if (pathname === "/learn") track("view_learn");
    else if (MARKET_PATHS.includes(pathname)) track("view_market");
    else if (!pathname.endsWith("/tearsheet")) track("view_other");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
