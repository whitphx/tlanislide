import { describe, it, expect } from "vitest"
import { getNextGlobalIndex } from "./models"

describe("getNextGlobalIndex", () => {
  it("should return 0 when there are no keyframes", () => {
    expect(getNextGlobalIndex([])).toBe(0)
  })

  it("should return the next index when there are keyframes", () => {
    expect(
      getNextGlobalIndex([
        { id: "0", trackId: "a", globalIndex: 0, data: {} },
        { id: "1", trackId: "a", globalIndex: 1, data: {} },
        { id: "2", trackId: "a", globalIndex: 2, data: {} },
      ])
    ).toBe(3)
  })
});
