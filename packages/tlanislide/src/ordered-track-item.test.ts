import { describe, it, expect } from "vitest";
import {
  OrderedTrackItem,
  getGlobalOrder,
  moveItemPreservingLocalOrder,
  insertOrderedTrackItem,
} from "./ordered-track-item";

/**
 * Creates an OrderedTrackItem for testing.
 * The 'data' field is irrelevant to the ordering logic,
 * so we only assign a minimal placeholder object.
 */
function makeItem(
  id: string,
  globalIndex: number,
  trackId: string,
): OrderedTrackItem {
  return {
    id,
    globalIndex,
    trackId,
    data: {},
  };
}

describe("OrderedTrackItem Implementation Tests", () => {
  /**
   * Section 1: getGlobalOrder
   * Tests that the function merges track-based local constraints
   * (OrderedTrackItems in the same track must be in ascending globalIndex order)
   * and the overall globalIndex ascending rule.
   */
  describe("getGlobalOrder", () => {
    it("should return an empty 2D array for an empty input", () => {
      const items: OrderedTrackItem[] = [];
      const res = getGlobalOrder(items);
      expect(res).toEqual([]);
    });

    it("should handle a single OrderedTrackItem", () => {
      const items = [makeItem("k1", 10, "A")];
      const res = getGlobalOrder(items);
      expect(res).toHaveLength(1);
      expect(res[0]).toHaveLength(1);
      expect(res[0][0].id).toBe("k1");
      expect(res[0][0].globalIndex).toBe(10);
    });

    it("should group OrderedTrackItems by ascending globalIndex", () => {
      // Distinct globalIndex => each OrderedTrackItem ends up in its own group
      const items = [
        makeItem("k1", 0, "A"),
        makeItem("k2", 5, "A"),
        makeItem("k3", 2, "B"),
      ];
      const res = getGlobalOrder(items);
      // Expect sorted => (k1=0), (k3=2), (k2=5) => three groups
      expect(res).toHaveLength(3);
      expect(res[0][0].id).toBe("k1");
      expect(res[1][0].id).toBe("k3");
      expect(res[2][0].id).toBe("k2");
    });

    it("should allow multiple OrderedTrackItems in the same globalIndex group (distinct IDs)", () => {
      const items = [
        makeItem("k1", 0, "A"),
        makeItem("k2", 0, "B"),
        makeItem("k3", 1, "A"),
      ];
      const res = getGlobalOrder(items);
      // group0 => [k1,k2], group1 => [k3]
      expect(res).toHaveLength(2);
      expect(res[0]).toHaveLength(2);
      expect(res[1]).toHaveLength(1);
    });

    it("should handle multiple tracks with no conflicts", () => {
      // trackA => (k1=1, k2=3), trackB => (k3=0, k4=2)
      const items = [
        makeItem("k1", 1, "A"),
        makeItem("k2", 3, "A"),
        makeItem("k3", 0, "B"),
        makeItem("k4", 2, "B"),
      ];
      const res = getGlobalOrder(items);
      // => group0 => [k3], group1 => [k1], group2 => [k4], group3 => [k2]
      expect(res).toHaveLength(4);
      expect(res[0][0].id).toBe("k3");
      expect(res[1][0].id).toBe("k1");
      expect(res[2][0].id).toBe("k4");
      expect(res[3][0].id).toBe("k2");
    });

    it("should detect a conflict if two OrderedTrackItems have the same trackId and the same globalIndex", () => {
      // Same track => must form a strictly ascending chain by globalIndex
      // But here we have two OrderedTrackItems in track "A" both at globalIndex=2 => conflict
      const items = [makeItem("k1", 2, "A"), makeItem("k2", 2, "A")];
      expect(() => getGlobalOrder(items)).toThrowError("Cycle or conflict");
    });

    it("should detect a conflict in non-adjacent OrderedTrackItems with same trackId/index", () => {
      // This test verifies that the conflict detection works even when the conflicting
      // OrderedTrackItems are not adjacent after sorting by globalIndex
      const items = [
        makeItem("k1", 2, "A"),
        makeItem("k3", 3, "B"),
        makeItem("k2", 2, "A"),
      ];
      expect(() => getGlobalOrder(items)).toThrowError("Cycle or conflict");
    });
  });

  /**
   * Section 2: moveOrderedTrackItemPreservingLocalOrder
   * We confirm that OrderedTrackItems are moved with forward/backward logic
   * and that OrderedTrackItems in the same track get pushed out if needed.
   */
  describe("moveOrderedTrackItemPreservingLocalOrder", () => {
    it("should do nothing if the target is not found or only one OrderedTrackItem exists", () => {
      const single = [makeItem("k1", 0, "A")];
      // not found
      const res1 = moveItemPreservingLocalOrder(single, "no-such", 2, "at");
      expect(res1).toEqual(single);
      // single => can't move
      const res2 = moveItemPreservingLocalOrder(single, "k1", 0, "at");
      expect(res2).toEqual(single);
    });

    it("should move an OrderedTrackItem forward (type='at')", () => {
      // group0 => [k1], group1 => [k2], group2 => [k3]
      const k1 = makeItem("k1", 0, "A");
      const k2 = makeItem("k2", 1, "A");
      const k3 = makeItem("k3", 2, "A");
      const items = [k1, k2, k3];
      // Move k1 => newIndex=2 => "at"
      const after = moveItemPreservingLocalOrder(items, "k1", 2, "at");
      // Check final => no conflict
      expect(() => getGlobalOrder(after)).not.toThrow();
    });

    it("should move an OrderedTrackItem backward (type='after')", () => {
      // group0 => [k1], group1 => [k2], group2 => [k3]
      const k1 = makeItem("k1", 0, "A");
      const k2 = makeItem("k2", 1, "A");
      const k3 = makeItem("k3", 2, "A");
      // Move k3 => newIndex=0 => "after"
      const after = moveItemPreservingLocalOrder(
        [k1, k2, k3],
        "k3",
        0,
        "after",
      );
      expect(() => getGlobalOrder(after)).not.toThrow();
    });

    it("should push out same-track OrderedTrackItems in between oldIndex..newIndex range", () => {
      // trackId="A" => k1=0, k2=1, k3=2
      // Move k1 =>2 => presumably k2,k3 get extracted and re-inserted
      const k1 = makeItem("k1", 0, "A");
      const k2 = makeItem("k2", 1, "A");
      const k3 = makeItem("k3", 2, "A");
      const items = [k1, k2, k3];
      const after = moveItemPreservingLocalOrder(items, "k1", 2, "at");
      expect(() => getGlobalOrder(after)).not.toThrow();
    });
  });

  /**
   * Section 3: insertOrderedTrackItem
   * We verify new OrderedTrackItems can be inserted at a certain globalIndex as a separate group,
   * then reindex and flatten.
   */
  describe("insertOrderedTrackItem", () => {
    it("should insert into an empty array at index=0", () => {
      const items: OrderedTrackItem[] = [];
      const newItem = makeItem("kN", 999, "A");
      const after = insertOrderedTrackItem(items, newItem, 0);
      expect(after).toHaveLength(1);
      expect(after[0].id).toBe("kN");
      // getGlobalOrder => group0 => [kN]
      expect(() => getGlobalOrder(after)).not.toThrow();
    });

    it("should insert into the middle of existing frames", () => {
      // group0 => [k1=0], group1 => [k2=1]
      // Insert => index=1 => new group in between => final => group0 => [k1], group1 => [newK], group2 => [k2]
      const k1 = makeItem("k1", 0, "A");
      const k2 = makeItem("k2", 1, "A");
      const items = [k1, k2];
      const newItem = makeItem("kN", 10, "B");
      const after = insertOrderedTrackItem(items, newItem, 1);
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
      const k1 = makeItem("k1", 0, "A");
      const items = [k1];
      const newItem = makeItem("kN", 999, "A");
      const after = insertOrderedTrackItem(items, newItem, 10);
      expect(() => getGlobalOrder(after)).not.toThrow();
      const frames = getGlobalOrder(after);
      expect(frames).toHaveLength(2);
      expect(frames[1][0].id).toBe("kN");
    });
  });
});
