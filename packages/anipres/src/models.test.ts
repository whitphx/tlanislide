import { describe, it, expect } from "vitest";
import { getNextGlobalIndexFromCueFrames } from "./models";
import type { CueFrame } from "./models";

function createMockCueFrame(
  id: string,
  trackId: string,
  globalIndex: number,
): CueFrame {
  return {
    id,
    type: "cue",
    trackId,
    globalIndex,
    action: {
      type: "shapeAnimation",
      duration: 1000,
    },
  } satisfies CueFrame;
}

describe("getNextGlobalIndex", () => {
  it("should return 0 when there are no cueFrames", () => {
    expect(getNextGlobalIndexFromCueFrames([])).toBe(0);
  });

  it("should return the next index when there are cueFrames", () => {
    expect(
      getNextGlobalIndexFromCueFrames([
        createMockCueFrame("0", "a", 0),
        createMockCueFrame("1", "a", 1),
        createMockCueFrame("2", "a", 2),
      ]),
    ).toBe(3);
  });
});
