import { describe, it, expect } from 'vitest'
import { Keyframe, getGlobalOrder, createKeyframe, getLocalPredecessors, getLocalSuccessors, addKeyframe, addGlobalEqual, addGlobalLess, moveKeyframe, addLocalRelation, removeKeyframe, isHead, isTail } from "./keyframe"

describe('Keyframe basic tests', () => {
  it('empty', () => {
    const ks: Keyframe[] = [];
    expect(getGlobalOrder(ks)).toEqual([]);
  });

  it('single keyframe', () => {
    let ks: Keyframe[] = [createKeyframe("k1")];
    expect(getGlobalOrder(ks)).toEqual([[ks[0]]]);
    expect(getLocalPredecessors(ks, "k1")).toEqual([]);
    expect(getLocalSuccessors(ks, "k1")).toEqual([]);
  });

  it('add/remove keyframe', () => {
    let ks: Keyframe[] = [];
    ks = addKeyframe(ks, "k1", {});
    ks = addKeyframe(ks, "k2", {});
    expect(ks.map(k => k.id)).toEqual(["k1", "k2"]);
    ks = removeKeyframe(ks, "k1");
    expect(ks.map(k => k.id)).toEqual(["k2"]);
  });

  it('global equal', () => {
    let ks = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3")];
    ks = addGlobalEqual(ks, "k1", "k2");
    const order = getGlobalOrder(ks);
    // 等価クラス {k1,k2} と {k3}
    // 順序は{[k1,k2],[k3]}または{[k3],[k1,k2]}になる可能性があるが、ここでは両方OK
    const eqClasses = order.map(arr => arr.map(kf => kf.id));
    expect(eqClasses.some(arr => arr.includes("k1") && arr.includes("k2"))).toBe(true);
  });

  it('global less with eq', () => {
    let ks = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3")];
    ks = addGlobalEqual(ks, "k1", "k2");
    ks = addGlobalLess(ks, "k1", "k3");
    const order = getGlobalOrder(ks);
    // (k1,k2)<k3
    expect(order.length).toBe(2);
    expect(order[0].map(k => k.id).sort()).toEqual(["k1", "k2"]);
    expect(order[1][0].id).toBe("k3");
  });

  it('local relation', () => {
    let ks = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3")];
    ks = addGlobalLess(ks, "k1", "k2");
    ks = addGlobalLess(ks, "k2", "k3");
    ks = addLocalRelation(ks, "k1", "k3");
    expect(getLocalSuccessors(ks, "k1")).toEqual(["k3"]);
    expect(getLocalPredecessors(ks, "k3")).toEqual(["k1"]);
  });
});

describe('moveKeyframe tests', () => {
  it('move no constraints', () => {
    let ks: Keyframe[] = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3")];
    ks = moveKeyframe(ks, "k3", 0);
    expect(ks.map(k => k.id)).toEqual(["k3", "k1", "k2"]);
  });

  it('move with local constraint', () => {
    let ks: Keyframe[] = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3")];
    ks = addLocalRelation(ks, "k1", "k3"); // k1<k3
    // move k3 to front
    ks = moveKeyframe(ks, "k3", 0);
    // k3が前だとk1<k3に違反、主はk3でpos0固定したいのでk1を前に動かす
    expect(ks.map(k => k.id)).toEqual(["k1", "k3", "k2"]);
  });

  it('complex local constraints move', () => {
    let ks = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3"), createKeyframe("k4")];
    ks = addLocalRelation(ks, "k1", "k2");
    ks = addLocalRelation(ks, "k2", "k3");
    ks = addLocalRelation(ks, "k1", "k4");
    // move k4 to index1
    ks = moveKeyframe(ks, "k4", 1);
    // initial naive: k1,k4,k2,k3
    // check constraints:
    // k1<k2 (k1@0, k2@2) OK
    // k2<k3 (k2@2, k3@3) OK
    // k1<k4 (k1@0, k4@1) OK
    // no violation, so result should be k1,k4,k2,k3
    expect(ks.map(k => k.id)).toEqual(["k1", "k4", "k2", "k3"]);
  });

  it('difficult constraint', () => {
    let ks = [createKeyframe("k1"), createKeyframe("k2"), createKeyframe("k3")];
    ks = addLocalRelation(ks, "k2", "k3"); // k2<k3
    // move k2 to index2
    // naive: k1,k3,k2 => violates k2<k3
    // main = k2 at pos2 だが修正で最小移動:
    // この実装例では主Keyframe完全固定が難しく、
    // 最終的にk1,k2,k3になる可能性大(主Keyframeがpos1に収まる)
    ks = moveKeyframe(ks, "k2", 2);
    expect(ks.map(k => k.id)).toEqual(["k1", "k2", "k3"]);
  });
});


describe('Keyframe modified tests', () => {
  interface MyData extends JsonObject {
    foo: string;
  }
  it('single keyframe head and tail', () => {
    let ks: Keyframe<MyData>[] = [];
    ks = addKeyframe(ks, "k1", { foo: "bar" });
    const k1 = ks.find(x => x.id === "k1")!;
    // localBefore=null => head
    expect(isHead(k1)).toBe(true);
    // no successor => tail
    expect(isTail(ks, k1)).toBe(true);
  });

  it('chain of three keyframes', () => {
    let ks: Keyframe<MyData>[] = [];
    ks = addKeyframe(ks, "k1", { foo: "1" });
    ks = addKeyframe(ks, "k2", { foo: "2" });
    ks = addKeyframe(ks, "k3", { foo: "3" });
    // define local order k1 < k2, k2 < k3
    // means k2.localBefore = k1.id, k3.localBefore = k2.id
    ks = addLocalRelation(ks, "k1", "k2");
    ks = addLocalRelation(ks, "k2", "k3");
    const k1 = ks.find(x => x.id === "k1")!;
    const k2 = ks.find(x => x.id === "k2")!;
    const k3 = ks.find(x => x.id === "k3")!;

    // k1: localBefore=null => head
    expect(isHead(k1)).toBe(true);
    // k2: localBefore=k1 => not head
    expect(isHead(k2)).toBe(false);
    // k3: localBefore=k2 => not head
    expect(isHead(k3)).toBe(false);

    // tail check
    // k1 is referenced by k2.localBefore => not tail
    expect(isTail(ks, k1)).toBe(false);
    // k2 is referenced by k3 => not tail
    expect(isTail(ks, k2)).toBe(false);
    // k3 is not referenced by anyone => tail
    expect(isTail(ks, k3)).toBe(true);
  });

  it('branching successors', () => {
    let ks: Keyframe<MyData>[] = [];
    ks = addKeyframe(ks, "a", { foo: "A" });
    ks = addKeyframe(ks, "b", { foo: "B" });
    ks = addKeyframe(ks, "c", { foo: "C" });
    // a < b (b.localBefore = a)
    // a < c (c.localBefore = a)
    ks = addLocalRelation(ks, "a", "b");
    ks = addLocalRelation(ks, "a", "c");

    const a = ks.find(x => x.id === "a")!;
    const b = ks.find(x => x.id === "b")!;
    const c = ks.find(x => x.id === "c")!;

    // a: localBefore=null => head
    expect(isHead(a)).toBe(true);
    // b,c have localBefore=a => not head
    expect(isHead(b)).toBe(false);
    expect(isHead(c)).toBe(false);

    // tail check: b or c?
    // b and c are not referenced by anyone => both tail
    expect(isTail(ks, b)).toBe(true);
    expect(isTail(ks, c)).toBe(true);

    // a is referenced by b and c => not tail
    expect(isTail(ks, a)).toBe(false);
  });

  it('moveKeyframe still works with localBefore', () => {
    let ks: Keyframe<MyData>[] = [];
    ks = addKeyframe(ks, "k1", { foo: "1" });
    ks = addKeyframe(ks, "k2", { foo: "2" });
    ks = addKeyframe(ks, "k3", { foo: "3" });
    // k1 < k3
    ks = addLocalRelation(ks, "k1", "k3");
    // move k3 to front
    ks = moveKeyframe(ks, "k3", 0);
    // This would cause violation since k1<k3 but k3 is front
    // Heuristic tries to fix by moving k1 ahead of k3
    // final order: k1,k3,k2 probably
    expect(ks.map(k => k.id)).toEqual(["k1", "k3", "k2"]);
  });
});
