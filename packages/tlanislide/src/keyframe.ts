import { JsonObject } from "tldraw"


export interface Keyframe extends JsonObject {
  id: string;
  ufParentId: string;
  ufRank: number;
  globalAfterEqClasses: string[];
  localAfter: string[];
}

export function createKeyframe(id: string): Keyframe {
  return {
    id,
    ufParentId: id,
    ufRank: 0,
    globalAfterEqClasses: [],
    localAfter: []
  };
}

/** Union-Find 関連 **/
function ufFind(ks: Keyframe[], x: Keyframe): Keyframe {
  if (x.ufParentId === x.id) return x;
  const p = ks.find(k => k.id === x.ufParentId);
  if (!p) return x;
  const root = ufFind(ks, p);
  x.ufParentId = root.id;
  return root;
}

function ufUnion(ks: Keyframe[], a: Keyframe, b: Keyframe): Keyframe[] {
  const newKs = ks.map(k => ({ ...k }));
  const a2 = newKs.find(k => k.id === a.id)!;
  const b2 = newKs.find(k => k.id === b.id)!;
  const rootA = ufFind(newKs, a2);
  const rootB = ufFind(newKs, b2);
  if (rootA.id === rootB.id) return newKs; // Already same set

  const newRootA = newKs.find(k => k.id === rootA.id)!;
  const newRootB = newKs.find(k => k.id === rootB.id)!;

  if (newRootA.ufRank < newRootB.ufRank) {
    newRootA.ufParentId = newRootB.id;
    newRootB.globalAfterEqClasses = Array.from(new Set([...newRootB.globalAfterEqClasses, ...newRootA.globalAfterEqClasses]));
  } else if (newRootA.ufRank > newRootB.ufRank) {
    newRootB.ufParentId = newRootA.id;
    newRootA.globalAfterEqClasses = Array.from(new Set([...newRootA.globalAfterEqClasses, ...newRootB.globalAfterEqClasses]));
  } else {
    newRootB.ufParentId = newRootA.id;
    newRootA.ufRank += 1;
    newRootA.globalAfterEqClasses = Array.from(new Set([...newRootA.globalAfterEqClasses, ...newRootB.globalAfterEqClasses]));
  }
  return newKs;
}

/** 全体順序関連操作 **/
export function addGlobalLess(ks: Keyframe[], idA: string, idB: string): Keyframe[] {
  const newKs = ks.map(k => ({ ...k }));
  const a = newKs.find(k => k.id === idA)!;
  const b = newKs.find(k => k.id === idB)!;

  const rootA = ufFind(newKs, a);
  const rootB = ufFind(newKs, b);

  if (rootA.id === rootB.id) {
    // 同一eqクラスで < は矛盾。
    return newKs;
  }

  const rootAObj = newKs.find(k => k.id === rootA.id)!;
  rootAObj.globalAfterEqClasses = Array.from(new Set([...rootAObj.globalAfterEqClasses, rootB.id]));
  return newKs;
}

export function addGlobalEqual(ks: Keyframe[], idA: string, idB: string): Keyframe[] {
  const a = ks.find(k => k.id === idA)!;
  const b = ks.find(k => k.id === idB)!;
  return ufUnion(ks, a, b);
}

/** 局所順序操作 **/
export function addLocalRelation(ks: Keyframe[], idA: string, idB: string): Keyframe[] {
  const newKs = ks.map(k => ({ ...k }));
  const a = newKs.find(k => k.id === idA)!;
  a.localAfter = Array.from(new Set([...a.localAfter, idB]));
  return newKs;
}

/** 局所順序取得 **/
// TODO: Predecessorsの取得の方が頻繁なので、逆向きの情報を持つ
export function getLocalPredecessors(ks: Keyframe[], idA: string): string[] {
  const target = ks.find(x => x.id === idA)!;
  return ks.filter(x => x.localAfter.includes(target.id)).map(x => x.id);
}

export function getLocalSuccessors(ks: Keyframe[], idA: string): string[] {
  const target = ks.find(x => x.id === idA)!;
  return [...target.localAfter];
}

/** 全体順序取得 **/
export function getGlobalOrder(ks: Keyframe[]): Keyframe[][] {
  const clone = ks.map(k => ({ ...k }));
  const rootMap: Map<string, Keyframe[]> = new Map();
  for (let x of clone) {
    const r = ufFind(clone, x);
    if (!rootMap.has(r.id)) rootMap.set(r.id, []);
    rootMap.get(r.id)!.push(x);
  }

  const graph: Map<string, string[]> = new Map();
  const indeg: Map<string, number> = new Map();
  for (let rootId of rootMap.keys()) {
    const rootKF = clone.find(k => k.id === rootId)!;
    graph.set(rootId, rootKF.globalAfterEqClasses.slice());
    for (let nxt of rootKF.globalAfterEqClasses) {
      indeg.set(nxt, (indeg.get(nxt) ?? 0) + 1);
    }
    if (!indeg.has(rootId)) indeg.set(rootId, 0);
  }

  const queue: string[] = [];
  for (let [k, v] of indeg) {
    if (v === 0) queue.push(k);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    for (let w of (graph.get(u) || [])) {
      indeg.set(w, indeg.get(w)! - 1);
      if (indeg.get(w) === 0) queue.push(w);
    }
  }

  return order.map(rid => rootMap.get(rid) || []);
}

/** Keyframe追加・削除 **/
export function addKeyframe(ks: Keyframe[], newId: string): Keyframe[] {
  const newK = createKeyframe(newId);
  return [...ks, newK];
}

export function removeKeyframe(ks: Keyframe[], targetId: string): Keyframe[] {
  return ks.filter(x => x.id !== targetId);
}


/** Keyframe移動機能
* 主KeyframeをnewIndexへ移動し、局所順序整合をとるヒューリスティック。
*/
export function moveKeyframe(ks: Keyframe[], targetId: string, newIndex: number): Keyframe[] {
  let newKs = ks.map(k => ({ ...k }));
  const order2d = getGlobalOrder(newKs);
  const linearOrder = order2d.flat();
  const targetKF = linearOrder.find(k => k.id === targetId);
  if (!targetKF) return newKs;

  // remove targetKF from linearOrder
  const filtered = linearOrder.filter(k => k.id !== targetId);
  // clamp
  const pos = Math.max(0, Math.min(newIndex, filtered.length));
  filtered.splice(pos, 0, targetKF);

  // ローカル順序チェック＆修正
  const mainKF = targetKF;
  let changed = true;
  while (changed) {
    changed = false;
    const constraints: { a: Keyframe, b: Keyframe }[] = [];
    for (let kf of filtered) {
      for (let succId of kf.localAfter) {
        const a = kf;
        const b = filtered.find(x => x.id === succId)!;
        constraints.push({ a, b });
      }
    }
    for (let { a, b } of constraints) {
      const iA = filtered.indexOf(a);
      const iB = filtered.indexOf(b);
      if (iA > iB) {
        // violation: need iA < iB
        // mainKFはできる限り動かさない
        if (a.id === mainKF.id) {
          // move b after a
          filtered.splice(iB, 1);
          const iA2 = filtered.indexOf(a);
          filtered.splice(iA2 + 1, 0, b);
        } else if (b.id === mainKF.id) {
          // move a before b
          filtered.splice(iA, 1);
          const iB2 = filtered.indexOf(b);
          filtered.splice(iB2, 0, a);
        } else {
          // mainKF関与無し、bをaの直後へ
          filtered.splice(iB, 1);
          const iA2 = filtered.indexOf(a);
          filtered.splice(iA2 + 1, 0, b);
        }
        changed = true;
        break;
      }
    }
  }

  // 最終的な並び
  const result = filtered.map(f => {
    const orig = newKs.find(x => x.id === f.id)!;
    return { ...orig };
  });
  return result;
}
