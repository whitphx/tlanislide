import { describe, it, expect } from "vitest";
import {
  Keyframe,
  getGlobalOrder,
  moveKeyframePreservingLocalOrder,
  getAllLocalSequencesWithGlobalOrder,
  isHead,
  isTail
} from "./keyframe";
import type { JsonObject } from "tldraw";

// ユーティリティ: Keyframe生成
function mk<T extends JsonObject>(
  id: string,
  globalIndex: number,
  localBefore: string | null,
  data: T
): Keyframe<T> {
  return { id, globalIndex, localBefore, data };
}

interface MyData extends JsonObject {
  info: string;
}

describe("keyframe.ts tests", () => {

  //
  // === getGlobalOrder tests ===
  //
  describe("getGlobalOrder", () => {
    it("empty array => returns empty 2D", () => {
      const ks: Keyframe<MyData>[] = [];
      const res = getGlobalOrder(ks);
      expect(res).toEqual([]);
    });

    it("single keyframe => single group", () => {
      const ks = [mk("k1", 100, null, { info: "k1" })];
      const res = getGlobalOrder(ks);
      expect(res.length).toBe(1);
      expect(res[0].length).toBe(1);
      expect(res[0][0].id).toBe("k1");
    });

    it("no localBefore => just sort by globalIndex ascending", () => {
      const ks = [
        mk("k1", 2, null, { info: "k1" }),
        mk("k2", 0, null, { info: "k2" }),
        mk("k3", 5, null, { info: "k3" }),
      ];
      const res = getGlobalOrder(ks);
      expect(res.length).toBe(3);
      // group0 => gIndex=0 => [k2], group1 => gIndex=2 => [k1], group2 => gIndex=5 => [k3]
      expect(res[0][0].id).toBe("k2");
      expect(res[1][0].id).toBe("k1");
      expect(res[2][0].id).toBe("k3");
    });

    it("localBefore => cycle => throw error", () => {
      const ks = [
        mk("k1", 0, "k2", { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" }),
      ];
      // k1.localBefore=k2 => k2<k1, but k2.globalIndex>k1.globalIndex => conflict => also cycle
      expect(() => getGlobalOrder(ks)).toThrowError("Cycle or conflict");
    });

    it("localBefore => simple chain", () => {
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" }),
        mk("k3", 2, "k2", { info: "k3" })
      ];
      const res = getGlobalOrder(ks);
      // => group0 => [k1], group1 => [k2], group2 => [k3]
      expect(res.length).toBe(3);
      expect(res[0][0].id).toBe("k1");
      expect(res[1][0].id).toBe("k2");
      expect(res[2][0].id).toBe("k3");
    });

    it("multiple Keyframes in same globalIndex => no local conflict => same group", () => {
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 0, null, { info: "k2" }),
        mk("k3", 1, null, { info: "k3" })
      ];
      // k1,k2 both globalIndex=0 => same group
      // no local conflict => they remain in one group
      const res = getGlobalOrder(ks);
      expect(res.length).toBe(2);
      expect(res[0].length).toBe(2); // k1, k2
      expect(res[1].length).toBe(1); // k3
    });
  });


  //
  // === moveKeyframe tests ===
  //

  describe("moveKeyframe", () => {
    it("no op if single or not found", () => {
      // single => same
      const single = [mk("k1", 0, null, { info: "k1" })];
      const r1 = moveKeyframePreservingLocalOrder(single, "k1", 10);
      expect(r1).toEqual(single);

      const none = moveKeyframePreservingLocalOrder(single, "unknown", 0);
      expect(none).toEqual(single);
    });

    it("moving forward with no local conflict => success", () => {
      // k1=0, k2=1 => user move k1 => newIndex=2 => forward
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, null, { info: "k2" })
      ];
      const res = moveKeyframePreservingLocalOrder(ks, "k1", 2);
      // after reorder => 3 frames? Possibly => [[], [k2], [k1]] => reassign => group0 => [k2], group1 => [k1]
      // check final indexes => k2=0, k1=1 or so
      const k1 = res.find(x => x.id === "k1")!;
      const k2 = res.find(x => x.id === "k2")!;
      expect(k1.globalIndex).toBeGreaterThan(k2.globalIndex);
    });

    it("moving backward with local chain => oldIndex>newIndex", () => {
      // k1=0, k2=1, local => k2.localBefore="k1" => conflict?
      // user move k2=>0 => backward => we push frames => final => k1=0,k2=1
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" })
      ];
      const res = moveKeyframePreservingLocalOrder(ks, "k2", 0);
      const k1 = res.find(x => x.id === "k1")!;
      const k2 = res.find(x => x.id === "k2")!;
      // local => k2>k1 => => k2.index>k1.index => check
      expect(k2.globalIndex).toBeGreaterThan(k1.globalIndex);
    });

    it("child found in frames => push child => forward", () => {
      // k1->k2 => k2.localBefore="k1"
      // k3->k2 =>? Not directly but let's just see if child is found
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" }),
        mk("k3", 2, null, { info: "k3" })
      ];
      // move k1 => newIndex=2 => presumably k2 is child => we move k2 out => etc
      const res = moveKeyframePreservingLocalOrder(ks, "k1", 2);
      // check final => no local conflict => k2>k1
      const k2 = res.find(x => x.id === "k2")!;
      const k1 = res.find(x => x.id === "k1")!;
      expect(k2.globalIndex).toBeGreaterThan(k1.globalIndex);
    });

    it("big chain => partial push => no cycle", () => {
      // k1->k2->k3->k4 => localBefore => k2.k1, k3.k2, k4.k3
      // globalIndex => k1=0, k2=1, k3=2, k4=3
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" }),
        mk("k3", 2, "k2", { info: "k3" }),
        mk("k4", 3, "k3", { info: "k4" })
      ];
      // move k1 => newIndex=2 => forward => we push k2,k3 possibly => final => no conflict
      const res = moveKeyframePreservingLocalOrder(ks, "k1", 2);
      expect(() => getGlobalOrder(res)).not.toThrow();
      // check local => k2>k1 => k3>k2 => k4>k3
      const k2 = res.find(x => x.id === "k2")!;
      const k1 = res.find(x => x.id === "k1")!;
      expect(k2.globalIndex).toBeGreaterThan(k1.globalIndex);
    });
  });


  //
  // === getAllLocalSequencesWithGlobalOrder tests ===
  //
  describe("getAllLocalSequencesWithGlobalOrder", () => {
    it("empty => returns []", () => {
      const ks: Keyframe<MyData>[] = [];
      const res = getAllLocalSequencesWithGlobalOrder(ks);
      expect(res).toEqual([]);
    });

    it("single => single sequence", () => {
      const ks = [mk("k1", 0, null, { info: "k1" })];
      const res = getAllLocalSequencesWithGlobalOrder(ks);
      expect(res.length).toBe(1);
      expect(res[0].sequence.length).toBe(1);
      expect(res[0].sequence[0].kf.id).toBe("k1");
    });

    it("multiple no local => all isolated => multiple single seq", () => {
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, null, { info: "k2" }),
        mk("k3", 2, null, { info: "k3" })
      ];
      const res = getAllLocalSequencesWithGlobalOrder(ks);
      expect(res.length).toBe(3);
      // each is single chain
      const seqIds = res.map(r => r.sequence.map(x => x.kf.id));
      expect(seqIds).toContainEqual(["k1"]);
      expect(seqIds).toContainEqual(["k2"]);
      expect(seqIds).toContainEqual(["k3"]);
    });

    it("simple chain => single local seq", () => {
      // k1->k2->k3
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" }),
        mk("k3", 2, "k2", { info: "k3" })
      ];
      const res = getAllLocalSequencesWithGlobalOrder(ks);
      expect(res.length).toBe(1);
      expect(res[0].sequence.map(x => x.kf.id)).toEqual(["k1", "k2", "k3"]);
    });

    it("branching => multiple seq from single head", () => {
      // k1->k2, k1->k3 => local => k2.localBefore="k1", k3.localBefore="k1"
      const ks = [
        mk("k1", 0, null, { info: "k1" }),
        mk("k2", 1, "k1", { info: "k2" }),
        mk("k3", 1, "k1", { info: "k3" })
      ];
      const res = getAllLocalSequencesWithGlobalOrder(ks);
      expect(res.length).toBe(2);
      // e.g. [ { sequence:[k1,k2] }, { sequence:[k1,k3] } ]
      const seqIds = res.map(r => r.sequence.map(x => x.kf.id).join(","));
      expect(seqIds).toContain("k1,k2");
      expect(seqIds).toContain("k1,k3");
    });
  });


  //
  // === isHead / isTail tests ===
  //
  describe("isHead & isTail", () => {
    const k1 = mk("k1", 0, null, { info: "k1" });
    const k2 = mk("k2", 1, "k1", { info: "k2" });
    const k3 = mk("k3", 2, "k2", { info: "k3" });
    const arr = [k1, k2, k3];

    it("isHead => localBefore===null => k1 only", () => {
      expect(isHead(k1)).toBe(true);
      expect(isHead(k2)).toBe(false);
      expect(isHead(k3)).toBe(false);
    });

    it("isTail => no child => k3 only", () => {
      expect(isTail(arr, k1)).toBe(false);
      expect(isTail(arr, k2)).toBe(false);
      expect(isTail(arr, k3)).toBe(true);
    });

    it("isolated => isHead & isTail => both true", () => {
      const k4 = mk("k4", 10, null, { info: "k4" });
      // localBefore=null, no one references k4 => head & tail
      expect(isHead(k4)).toBe(true);
      expect(isTail(arr.concat(k4), k4)).toBe(true);
    });
  });


  //
  // === Combining tests with parameterization (example) ===
  //
  // ここでは一例として、moveKeyframeのforward/backwardをパラメタライズ
  // さらにlocal chainの深さを変えてテストするなど、様々なパターンを網羅
  describe.each([
    { desc: "forward: short chain", chain: ["k1->k2"], forward: true },
    { desc: "backward: short chain", chain: ["k1->k2"], forward: false },
    { desc: "forward: 3 chain", chain: ["k1->k2", "k2->k3"], forward: true },
    { desc: "backward: 3 chain", chain: ["k1->k2", "k2->k3"], forward: false },
  ])("Param: $desc", ({ chain, forward }) => {
    it("should move target and not break local order", () => {
      // 例: chain=[k1->k2, k2->k3], forward=true => k1=0,k2=1,k3=2 => move k1 =>2 => ...
      // build from chain
      // "k1->k2" => k2.localBefore="k1"
      // we assume chain is linear => set indexes 0,1,2,...
      const ids = new Set<string>();
      const edges: Array<[string, string]> = [];
      chain.forEach((link) => {
        // e.g "k1->k2"
        const [head, tail] = link.split("->");
        ids.add(head); ids.add(tail);
        edges.push([head, tail]);
      });
      // assign indexes in insertion order
      let idx = 0;
      const mapData = new Map<string, number>();
      for (const id of ids) {
        mapData.set(id, idx++);
      }
      // build Keyframe
      const arr: Keyframe<MyData>[] = [...ids].map(id => {
        return mk(id, mapData.get(id)!, null, { info: id });
      });
      // set localBefore
      edges.forEach(([h, t]) => {
        const tailKf = arr.find(x => x.id === t)!;
        tailKf.localBefore = h;
      });

      // move target => either first or last in chain
      // forward => move the first => last
      // backward => move the last => 0
      if (forward) {
        const firstId = arr[0].id; // e.g. k1
        const newIdx = arr.length - 1; // last
        const res = moveKeyframePreservingLocalOrder(arr, firstId, newIdx);
        // check
        expect(() => getGlobalOrder(res)).not.toThrow();
      } else {
        const lastId = arr[arr.length - 1].id;
        const res = moveKeyframePreservingLocalOrder(arr, lastId, 0);
        expect(() => getGlobalOrder(res)).not.toThrow();
      }
    });
  });

});
