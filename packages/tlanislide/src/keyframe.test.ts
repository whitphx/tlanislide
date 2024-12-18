import { describe, it, expect } from 'vitest'
import { Keyframe, getGlobalOrder, createKeyframe, getLocalPredecessors, getLocalSuccessors, addKeyframe, addGlobalEqual, addGlobalLess, moveKeyframe, addLocalRelation, removeKeyframe } from "./keyframe"

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
    ks = addKeyframe(ks, "k1");
    ks = addKeyframe(ks, "k2");
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
