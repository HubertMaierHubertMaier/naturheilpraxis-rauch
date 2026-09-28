import { describe, expect, it } from "vitest";
import { runOrderedAnalysisBatches } from "@/lib/orderedAnalysisBatches";

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("bounded document analysis", () => {
  it("runs at most two parts at once but saves them in source order", async () => {
    let active = 0;
    let maximum = 0;
    const committed: number[] = [];
    await runOrderedAnalysisBatches(0, 4, 2, async index => {
      active += 1;
      maximum = Math.max(maximum, active);
      await pause(index % 2 === 0 ? 15 : 2);
      active -= 1;
      return index;
    }, async (_index, result) => { committed.push(result); }, async () => { throw new Error("unexpected failure"); });
    expect(maximum).toBe(2);
    expect(committed).toEqual([0, 1, 2, 3]);
  });

  it("saves the first result while the second request is still running", async () => {
    let finishFirst!: (value: number) => void;
    let finishSecond!: (value: number) => void;
    const first = new Promise<number>(resolve => { finishFirst = resolve; });
    const second = new Promise<number>(resolve => { finishSecond = resolve; });
    const committed: number[] = [];
    const run = runOrderedAnalysisBatches(0, 2, 2, index => index === 0 ? first : second,
      async (_index, value) => { committed.push(value); }, async () => { throw new Error("unexpected failure"); });
    finishFirst(0);
    await pause(0);
    expect(committed).toEqual([0]);
    finishSecond(1);
    await run;
    expect(committed).toEqual([0, 1]);
  });

  it("keeps the completed prefix when a parallel part fails", async () => {
    const started: number[] = [];
    const committed: number[] = [];
    const failures: number[] = [];
    await expect(runOrderedAnalysisBatches(0, 5, 2, async index => {
      started.push(index);
      if (index === 1) throw new Error("Teil fehlgeschlagen");
      return index;
    }, async (index, result) => { committed.push(index, result); }, async index => {
      failures.push(index);
      throw new Error("gesicherter Zwischenstand");
    })).rejects.toThrow("gesicherter Zwischenstand");
    expect(started).toEqual([0, 1]);
    expect(committed).toEqual([0, 0]);
    expect(failures).toEqual([1]);
  });

  it("resumes at the saved part and does not repeat older parts", async () => {
    const processed: number[] = [];
    await runOrderedAnalysisBatches(2, 4, 2, async index => { processed.push(index); return index; },
      async () => {}, async () => { throw new Error("unexpected failure"); });
    expect(processed).toEqual([2, 3]);
  });
});
