import { describe, expect, it, vi } from "vitest";
import { createDebouncedCallback } from "./debounce";

describe("createDebouncedCallback", () => {
  it("debounces query changes before firing", () => {
    vi.useFakeTimers();
    const calls: string[] = [];
    const debounced = createDebouncedCallback(250, (value: string) => {
      calls.push(value);
    });

    debounced.trigger("first");
    debounced.trigger("second");
    debounced.trigger("final");

    expect(calls).toEqual([]);

    vi.advanceTimersByTime(249);
    expect(calls).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(calls).toEqual(["final"]);

    debounced.cancel();
    vi.useRealTimers();
  });
});
