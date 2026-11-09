import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPath, deviceOf, liveNow, refHost, visitReport, type ViewRow } from "./visits";

test("paths: no query, no hash, ids hidden", () => {
  assert.equal(cleanPath("/check?utm_source=fb#x"), "/check");
  assert.equal(cleanPath("/account/bills/3f2a9c1e-1111-2222-3333-444455556666"), "/account/bills/:id");
  assert.equal(cleanPath("/"), "/");
  assert.equal(cleanPath("/pricing/"), "/pricing");
  assert.equal(cleanPath("https://evil.com/x"), null);
  assert.equal(cleanPath("//evil.com"), null);
  assert.equal(cleanPath("/<script>"), null);
});

test("referrer and device", () => {
  assert.equal(refHost("https://www.google.com/search?q=power", "utilo.com.au"), "google.com");
  assert.equal(refHost("https://l.facebook.com/l.php?u=x", "utilo.com.au"), "facebook.com");
  assert.equal(refHost("https://www.utilo.com.au/pricing", "www.utilo.com.au"), null);
  assert.equal(refHost("", "utilo.com.au"), null);
  assert.equal(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"), "phone");
  assert.equal(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablet");
  assert.equal(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"), "desktop");
});

test("landing pages, checks and pages viewed", () => {
  const v = (sid: string, path: string, t: string, first = false, ref: string | null = null): ViewRow => ({ created_at: `2026-11-02T0${t}:00Z`, sid, path, ref, device: "phone", first });
  const rows = [v("a", "/", "1", true, "google.com"), v("a", "/check", "2"), v("b", "/pricing", "1", true), v("c", "/", "3", true, "facebook.com"), v("c", "/pricing", "4")];
  const r = visitReport(rows, new Set(["a"]));
  assert.equal(r.visitors, 3);
  assert.equal(r.views, 5);
  assert.equal(r.startedCheck, 1);
  assert.deepEqual(r.landing[0], { path: "/", visitors: 2, checks: 1 });
  assert.deepEqual(r.pages.find((p) => p.path === "/pricing"), { path: "/pricing", views: 2, visitors: 2 });
  assert.equal(r.referrers.find((x) => x.host === "Direct or unknown")!.visitors, 1);
});

test("live: only tabs seen in the last two minutes", () => {
  const now = Date.parse("2026-11-02T05:00:00Z");
  const r = liveNow([
    { sid: "a", path: "/check", last_seen: "2026-11-02T04:59:30Z" },
    { sid: "b", path: "/check", last_seen: "2026-11-02T04:58:30Z" },
    { sid: "c", path: "/", last_seen: "2026-11-02T04:50:00Z" },
  ], now);
  assert.deepEqual(r, { count: 2, pages: [{ path: "/check", n: 2 }] });
});

test("time on site: check-ins add short gaps only", async () => {
  const { activeSecondsToAdd, timeReport, fmtDuration } = await import("./visits");
  const t0 = Date.parse("2026-11-09T00:00:00Z");
  assert.equal(activeSecondsToAdd(null, t0), 0);
  assert.equal(activeSecondsToAdd("2026-11-09T00:00:00Z", t0 + 45_000), 45);
  assert.equal(activeSecondsToAdd("2026-11-09T00:00:00Z", t0 + 80_000), 60); // capped
  assert.equal(activeSecondsToAdd("2026-11-09T00:00:00Z", t0 + 600_000), 0); // came back to a background tab
  const v = (sid: string, path: string, device = "phone") => ({ created_at: "2026-11-09T00:00:00Z", sid, path, ref: null, device, first: true });
  const r = timeReport(
    [{ sid: "a", active_seconds: 5 }, { sid: "b", active_seconds: 95 }, { sid: "c", active_seconds: 300 }, { sid: "zzz", active_seconds: 999 }],
    [v("a", "/"), v("b", "/"), v("c", "/gas", "desktop")],
    new Set(["c"]),
  );
  assert.equal(r.visits, 3); // zzz isn't in this period's views
  assert.equal(r.average, 133); assert.equal(r.median, 95);
  assert.equal(Math.round(r.quickExit * 100), 33);
  assert.equal(r.checkers, 300); assert.equal(r.others, 50);
  assert.equal(r.byLanding.get("/"), 50);
  assert.deepEqual(r.buckets.map((b) => b.visits), [1, 0, 0, 1, 1, 0]);
  assert.equal(fmtDuration(95), "1m 35s"); assert.equal(fmtDuration(42), "42s");
});
