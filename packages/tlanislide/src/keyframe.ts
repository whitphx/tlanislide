import { JsonObject } from "tldraw"

/**
 * Keyframeインターフェース:
 * - TはJsonObjectを継承する型で、Keyframeが保持する任意のデータ
 * - Union-Find用のufParentId, ufRank
 * - globalAfterEqClasses: 等価クラス間の順序
 * - localBefore: 局所順序での直前のKeyframe ID (なければnull)
 */
export interface Keyframe<T extends JsonObject = JsonObject> {
  id: string;
  ufParentId: string;
  ufRank: number;
  globalAfterEqClasses: string[];
  localBefore: string | null;
  data: T;
}

/** Keyframe作成 */
export function createKeyframe<T extends JsonObject>(id: string, data: T): Keyframe<T> {
  return {
    id,
    ufParentId: id,
    ufRank: 0,
    globalAfterEqClasses: [],
    localBefore: null,
    data
  };
}

/** Union-Find 関連 **/
function ufFind<T extends JsonObject>(ks: Keyframe<T>[], x: Keyframe<T>): Keyframe<T> {
  if (x.ufParentId === x.id) return x;
  const p = ks.find(k => k.id === x.ufParentId);
  if (!p) return x;
  const root = ufFind(ks, p);
  x.ufParentId = root.id;
  return root;
}

function ufUnion<T extends JsonObject>(ks: Keyframe<T>[], a: Keyframe<T>, b: Keyframe<T>): Keyframe<T>[] {
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
export function addGlobalLess<T extends JsonObject>(ks: Keyframe<T>[], idA: string, idB: string): Keyframe<T>[] {
  const newKs = ks.map(k => ({ ...k }));
  const a = newKs.find(k => k.id === idA)!;
  const b = newKs.find(k => k.id === idB)!;

  const rootA = ufFind(newKs, a);
  const rootB = ufFind(newKs, b);

  if (rootA.id === rootB.id) {
    // 同一eqクラスで<は矛盾
    return newKs;
  }

  const rootAObj = newKs.find(k => k.id === rootA.id)!;
  rootAObj.globalAfterEqClasses = Array.from(new Set([...rootAObj.globalAfterEqClasses, rootB.id]));
  return newKs;
}

export function addGlobalEqual<T extends JsonObject>(ks: Keyframe<T>[], idA: string, idB: string): Keyframe<T>[] {
  const a = ks.find(k => k.id === idA)!;
  const b = ks.find(k => k.id === idB)!;
  return ufUnion(ks, a, b);
}

/** 局所順序操作: a < b を定義する場合、b.localBefore = a.id */
export function addLocalRelation<T extends JsonObject>(ks: Keyframe<T>[], idA: string, idB: string): Keyframe<T>[] {
  const newKs = ks.map(k => ({ ...k }));
  const a = newKs.find(k => k.id === idA)!;
  const b = newKs.find(k => k.id === idB)!;
  b.localBefore = a.id; // bの前任をaに設定
  return newKs;
}

/** 局所順序での前要素取得（直接の前任のみ） */
export function getLocalPredecessors<T extends JsonObject>(ks: Keyframe<T>[], idA: string): string[] {
  const kf = ks.find(x => x.id === idA)!;
  return kf.localBefore ? [kf.localBefore] : [];
}

/** 局所順序での後要素取得:
* localBeforeからは直接後任は分からないので、すべてのKeyframeをチェックし、
* localBeforeがidAのものを集める。
*/
export function getLocalSuccessors<T extends JsonObject>(ks: Keyframe<T>[], idA: string): string[] {
  return ks.filter(x => x.localBefore === idA).map(x => x.id);
}

/** 全体順序取得 **/
export function getGlobalOrder<T extends JsonObject>(ks: Keyframe<T>[]): Keyframe<T>[][] {
  const clone = ks.map(k => ({ ...k }));
  const rootMap: Map<string, Keyframe<T>[]> = new Map();
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
export function addKeyframe<T extends JsonObject>(ks: Keyframe<T>[], newId: string, data: T): Keyframe<T>[] {
  const newK = createKeyframe(newId, data);
  return [...ks, newK];
}

export function removeKeyframe<T extends JsonObject>(ks: Keyframe<T>[], targetId: string): Keyframe<T>[] {
  return ks.filter(x => x.id !== targetId);
}

/** Keyframeを全体順序中で移動する関数 (ヒューリスティック)
* 局所順序整合を保つため、最小限の修正を加える。
*/
export function moveKeyframe<T extends JsonObject>(ks: Keyframe<T>[], targetId: string, newIndex: number): Keyframe<T>[] {
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

  const mainKF = targetKF;
  let changed = true;
  while (changed) {
    changed = false;
    // 再計算用に一時的にKeyframe配列化
    const tempMap = new Map(filtered.map(k => [k.id, k]));
    // ローカル順序違反検出: a< b なら b.localBefore = a.id
    // aがbより後に来てはいけない
    for (let b of filtered) {
      if (b.localBefore) {
        const a = tempMap.get(b.localBefore);
        if (a) {
          const iA = filtered.indexOf(a);
          const iB = filtered.indexOf(b);
          if (iA > iB) {
            // 違反修正: mainKFは極力動かさない
            if (a.id === mainKF.id) {
              // bをaの直後へ
              filtered.splice(iB, 1);
              const iA2 = filtered.indexOf(a);
              filtered.splice(iA2 + 1, 0, b);
            } else if (b.id === mainKF.id) {
              // aをbの前へ
              filtered.splice(iA, 1);
              const iB2 = filtered.indexOf(b);
              filtered.splice(iB2, 0, a);
            } else {
              // main関与なし、bをaの後へ
              filtered.splice(iB, 1);
              const iA2 = filtered.indexOf(a);
              filtered.splice(iA2 + 1, 0, b);
            }
            changed = true;
            break;
          }
        }
      }
    }
  }

  const result = filtered.map(f => {
    const orig = newKs.find(x => x.id === f.id)!;
    return { ...orig };
  });
  return result;
}

/** 新規追加関数:
* 1. Keyframeが局所順序関係において先頭かどうかを判定する関数
*    - 先頭: localBeforeがnullの場合、そのKeyframeは先頭要素
*      （局所順序が定義されていなくても単独要素とみなせるので先頭=localBefore===null）
*/
export function isHead<T extends JsonObject>(kf: Keyframe<T>): boolean {
  return kf.localBefore === null;
}

/** 2. Keyframeが局所順序関係において末尾かどうかを判定する関数
*    - 末尾: このKeyframeをlocalBeforeに持つKeyframeが存在しない場合が末尾
*    - 局所順序が無い(=単体)の場合、もちろん末尾でもある
*/
export function isTail<T extends JsonObject>(ks: Keyframe<T>[], kf: Keyframe<T>): boolean {
  // kfをlocalBeforeに持つKeyframeが無ければ末尾
  return !ks.some(x => x.localBefore === kf.id);
}
