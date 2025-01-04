import { describe, it, expect } from "vitest";
import type { JsonObject } from "tldraw";
import {
  Keyframe,
  getGlobalOrder,
  moveKeyframePreservingLocalOrder,
  insertKeyframe,
} from "./keyframe";

/**
 * Creates a Keyframe for testing.
 * The 'data' field is irrelevant to the ordering logic,
 * so we only assign a minimal placeholder object.
 */
function makeKF(
  id: string,
  globalIndex: number,
  trackId: string,
): Keyframe<JsonObject> {
  return {
    id,
    globalIndex,
    trackId,
    data: {},
  };
}

describe("Keyframe Implementation Tests", () => {
  /**
   * Section 1: getGlobalOrder
   * Tests that the function merges track-based local constraints
   * (Keyframes in the same track must be in ascending globalIndex order)
   * and the overall globalIndex ascending rule.
   */
  describe("getGlobalOrder", () => {
    it("should return an empty 2D array for an empty input", () => {
      const ks: Keyframe<JsonObject>[] = [];
      const res = getGlobalOrder(ks);
      expect(res).toEqual([]);
    });

    it("should handle a single Keyframe", () => {
      const ks = [makeKF("k1", 10, "A")];
      const res = getGlobalOrder(ks);
      expect(res).toHaveLength(1);
      expect(res[0]).toHaveLength(1);
      expect(res[0][0].id).toBe("k1");
      expect(res[0][0].globalIndex).toBe(10);
    });

    it("should group Keyframes by ascending globalIndex", () => {
      // Distinct globalIndex => each Keyframe ends up in its own group
      const ks = [
        makeKF("k1", 0, "A"),
        makeKF("k2", 5, "A"),
        makeKF("k3", 2, "B"),
      ];
      const res = getGlobalOrder(ks);
      // Expect sorted => (k1=0), (k3=2), (k2=5) => three groups
      expect(res).toHaveLength(3);
      expect(res[0][0].id).toBe("k1");
      expect(res[1][0].id).toBe("k3");
      expect(res[2][0].id).toBe("k2");
    });

    it("should allow multiple Keyframes in the same globalIndex group (distinct IDs)", () => {
      const ks = [
        makeKF("k1", 0, "A"),
        makeKF("k2", 0, "B"),
        makeKF("k3", 1, "A"),
      ];
      const res = getGlobalOrder(ks);
      // group0 => [k1,k2], group1 => [k3]
      expect(res).toHaveLength(2);
      expect(res[0]).toHaveLength(2);
      expect(res[1]).toHaveLength(1);
    });

    it("should handle multiple tracks with no conflicts", () => {
      // trackA => (k1=1, k2=3), trackB => (k3=0, k4=2)
      const ks = [
        makeKF("k1", 1, "A"),
        makeKF("k2", 3, "A"),
        makeKF("k3", 0, "B"),
        makeKF("k4", 2, "B"),
      ];
      const res = getGlobalOrder(ks);
      // => group0 => [k3], group1 => [k1], group2 => [k4], group3 => [k2]
      expect(res).toHaveLength(4);
      expect(res[0][0].id).toBe("k3");
      expect(res[1][0].id).toBe("k1");
      expect(res[2][0].id).toBe("k4");
      expect(res[3][0].id).toBe("k2");
    });

    it("should detect a conflict if two Keyframes have the same trackId and the same globalIndex", () => {
      // Same track => must form a strictly ascending chain by globalIndex
      // But here we have two Keyframes in track "A" both at globalIndex=2 => conflict
      const ks = [makeKF("k1", 2, "A"), makeKF("k2", 2, "A")];
      // This results in a local-edge a->b for a.globalIndex<b.globalIndex,
      // but they are equal => can't form an order => cycle or conflict
      // TODO: Fix this test - currently skipped due to failing assertion
      expect(() => getGlobalOrder(ks)).toThrowError("Cycle or conflict");
    });
  });

  /**
   * Section 2: moveKeyframePreservingLocalOrder
   * We confirm that Keyframes are moved with forward/backward logic
   * and that Keyframes in the same track get pushed out if needed.
   */
  describe("moveKeyframePreservingLocalOrder", () => {
    it("should do nothing if the target is not found or only one Keyframe exists", () => {
      const single = [makeKF("k1", 0, "A")];
      // not found
      const res1 = moveKeyframePreservingLocalOrder(single, "no-such", 2, "at");
      expect(res1).toEqual(single);
      // single => can't move
      const res2 = moveKeyframePreservingLocalOrder(single, "k1", 0, "at");
      expect(res2).toEqual(single);
    });

    it("should move a Keyframe forward (type='at')", () => {
      // group0 => [k1], group1 => [k2], group2 => [k3]
      const k1 = makeKF("k1", 0, "A");
      const k2 = makeKF("k2", 1, "A");
      const k3 = makeKF("k3", 2, "A");
      const ks = [k1, k2, k3];
      // Move k1 => newIndex=2 => "at"
      const after = moveKeyframePreservingLocalOrder(ks, "k1", 2, "at");
      // Check final => no conflict
      expect(() => getGlobalOrder(after)).not.toThrow();
    });

    it("should move a Keyframe backward (type='after')", () => {
      // group0 => [k1], group1 => [k2], group2 => [k3]
      const k1 = makeKF("k1", 0, "A");
      const k2 = makeKF("k2", 1, "A");
      const k3 = makeKF("k3", 2, "A");
      // Move k3 => newIndex=0 => "after"
      const after = moveKeyframePreservingLocalOrder(
        [k1, k2, k3],
        "k3",
        0,
        "after",
      );
      expect(() => getGlobalOrder(after)).not.toThrow();
    });

    it("should push out same-track Keyframes in between oldIndex..newIndex range", () => {
      // trackId="A" => k1=0, k2=1, k3=2
      // Move k1 =>2 => presumably k2,k3 get extracted and re-inserted
      const k1 = makeKF("k1", 0, "A");
      const k2 = makeKF("k2", 1, "A");
      const k3 = makeKF("k3", 2, "A");
      const ks = [k1, k2, k3];
      const after = moveKeyframePreservingLocalOrder(ks, "k1", 2, "at");
      expect(() => getGlobalOrder(after)).not.toThrow();
    });
  });

  /**
   * Section 3: insertKeyframe
   * We verify new Keyframes can be inserted at a certain globalIndex as a separate group,
   * then reindex and flatten.
   */
  describe("insertKeyframe", () => {
    it("should insert into an empty array at index=0", () => {
      const ks: Keyframe<JsonObject>[] = [];
      const newKF = makeKF("kN", 999, "A");
      const after = insertKeyframe(ks, newKF, 0);
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe("kN");
      // getGlobalOrder => group0 => [kN]
      expect(() => getGlobalOrder(after)).not.toThrow();
    });

    it("should insert into the middle of existing frames", () => {
      // group0 => [k1=0], group1 => [k2=1]
      // Insert => index=1 => new group in between => final => group0 => [k1], group1 => [newK], group2 => [k2]
      const k1 = makeKF("k1", 0, "A");
      const k2 = makeKF("k2", 1, "A");
      const ks = [k1, k2];
      const newKF = makeKF("kN", 10, "B");
      const after = insertKeyframe(ks, newKF, 1);
      // check final
      expect(() => getGlobalOrder(after)).not.toThrow();
      const frames = getGlobalOrder(after);
      expect(frames).toHaveLength(3);
      // The middle frame should contain kN
      expect(frames[1]).toHaveLength(1);
      expect(frames[1][0].id).toBe("kN");
    });

    it("should insert beyond existing frames", () => {
      // group0 => [k1=0]
      // Insert => index=10 => effectively appends => then reindex => group0 => [k1], group1 => [kN]
      const k1 = makeKF("k1", 0, "A");
      const ks = [k1];
      const newKF = makeKF("kN", 999, "A");
      const after = insertKeyframe(ks, newKF, 10);
      expect(() => getGlobalOrder(after)).not.toThrow();
      const frames = getGlobalOrder(after);
      expect(frames).toHaveLength(2);
      expect(frames[1][0].id).toBe("kN");
    });
  });
});
