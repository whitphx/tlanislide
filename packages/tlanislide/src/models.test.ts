import { describe, it, expect } from "vitest";
import { getNextGlobalIndex } from "./models";
import type { Keyframe } from "./models";

function createMockKeyframe(
  id: string,
  trackId: string,
  globalIndex: number,
): Keyframe {
  return {
    id,
    type: "keyframe",
    trackId,
    globalIndex,
    data: {
      type: "shapeAnimation",
      duration: 1000,
    },
  } satisfies Keyframe;
}

describe("getNextGlobalIndex", () => {
  it("should return 0 when there are no keyframes", () => {
    expect(getNextGlobalIndex([])).toBe(0);
  });

  it("should return the next index when there are keyframes", () => {
    expect(
      getNextGlobalIndex([
        createMockKeyframe("0", "a", 0),
        createMockKeyframe("1", "a", 1),
        createMockKeyframe("2", "a", 2),
      ]),
    ).toBe(3);
  });
});
