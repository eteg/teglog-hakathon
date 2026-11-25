import { describe, expect, it } from "vitest";

import { runAttackBattery } from "@/lib/quality/attacks";

describe("attack battery (8.2)", () => {
  it("blocks 10 of 10", async () => {
    const report = await runAttackBattery();
    const failed = report.results.filter((r) => !r.blocked);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(report).toMatchObject({ blocked: 10, total: 10 });
  });
});
