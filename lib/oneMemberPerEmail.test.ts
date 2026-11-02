import { test } from "node:test";
import assert from "node:assert/strict";
import { newestPerEmail } from "./oneMemberPerEmail";

test("one row per address, the newest, whatever the case", () => {
  const keep = newestPerEmail([
    { id: "a", email: "Phil@x.com", created_at: "2026-10-01T00:00:00Z" },
    { id: "b", email: "phil@x.com", created_at: "2026-10-20T00:00:00Z" },
    { id: "c", email: "phil@x.com ", created_at: "2026-10-05T00:00:00Z" },
    { id: "d", email: "sam@x.com", created_at: "2026-09-01T00:00:00Z" },
  ]);
  assert.deepEqual([...keep].sort(), ["b", "d"]);
});
