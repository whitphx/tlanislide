import type { JsonObject } from "tldraw"

/** Keyframe構造体 */
export interface Keyframe<T extends JsonObject> {
  id: string;
  globalIndex: number;       // 同時クラス (同順位)。歯抜けが生じうる。
  localBefore: string | null;  // 局所順序: b.localBefore=a => a < b
  data: T;
}
/** getGlobalOrder
 * Keyframe[]をコピーし、globalIndexとlocalBeforeを踏まえたトポロジカルソートを行い、
 * 2次元配列( [ [gIndex=0], [gIndex=1], ... ] )として返す。
 * サイクル検知すると例外を投げる。
 * ※ 大まかな実装。連番になっていないglobalIndexにも対応(例: 0,100,101,...)
 */
export function getGlobalOrder<T extends JsonObject>(
  ks: Keyframe<T>[]
): Keyframe<T>[][] {
  // 1. ソート(複製)
  const copy = ks.map(k => ({ ...k }));
  copy.sort((a, b) => a.globalIndex - b.globalIndex);

  // 2. DAG構築: a->b if
  //    (1) a.localBefore=b => b < a
  //    (2) a.globalIndex < b.globalIndex => a < b
  const graph = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const kf of copy) {
    graph.set(kf.id, []);
    indeg.set(kf.id, 0);
  }

  // localBefore => a< b
  // => b.localBefore=a => a->b
  for (const b of copy) {
    if (b.localBefore) {
      const aId = b.localBefore;
      graph.get(aId)!.push(b.id);
      indeg.set(b.id, indeg.get(b.id)! + 1);
    }
  }
  // globalIndex => if a.globalIndex < b.globalIndex => a->b
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      const a = copy[i], b = copy[j];
      if (a.globalIndex < b.globalIndex) {
        graph.get(a.id)!.push(b.id);
        indeg.set(b.id, indeg.get(b.id)! + 1);
      }
    }
  }

  // 3. トポロジカルソート
  const queue: string[] = [];
  for (const [id, deg] of indeg) {
    if (deg === 0) queue.push(id);
  }
  const sorted: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    sorted.push(u);
    for (const v of graph.get(u)!) {
      const d = indeg.get(v)! - 1;
      indeg.set(v, d);
      if (d === 0) {
        queue.push(v);
      }
    }
  }
  if (sorted.length < copy.length) {
    throw new Error("Cycle or conflict in getGlobalOrder");
  }

  // 4. globalIndex ごとにまとめ
  const mapById = new Map<string, Keyframe<T>>();
  for (const c of copy) mapById.set(c.id, c);

  const visited = new Set<string>();
  const result: Keyframe<T>[][] = [];
  let currentGroup: Keyframe<T>[] = [];
  let currentIndex = -1;

  for (const id of sorted) {
    if (visited.has(id)) continue;
    visited.add(id);
    const kf = mapById.get(id)!;
    if (kf.globalIndex !== currentIndex) {
      currentGroup = [];
      result.push(currentGroup);
      currentIndex = kf.globalIndex;
    }
    currentGroup.push(kf);
  }

  return result;
}

function reassignGlobalIndexInplace<T extends JsonObject>(globalOrder: Keyframe<T>[][]) {
  let globalIndex = 0
  globalOrder.forEach((group) => {
    if (group.length === 0) return;
    group.forEach((kf) => {
      kf.globalIndex = globalIndex;
    });
    globalIndex++;
  });
  return globalOrder;
}

export function moveKeyframe<T extends JsonObject>(
  ks: Keyframe<T>[],
  targetId: string,
  newIndex: number,
  type: "at" | "after" = "at",
): Keyframe<T>[] {
  if (ks.length <= 1) return ks;

  const orgTarget = ks.find(k => k.id === targetId);
  if (!orgTarget) return ks;
  const target = { ...orgTarget };// immutable copy

  if (type === "at" && target.globalIndex === newIndex) return ks;

  const oldIndex = target.globalIndex;

  const isForward = (oldIndex <= newIndex);

  const globalOrder = getGlobalOrder(ks);
  let newGlobalOrder: Keyframe<T>[][] = [];
  if (isForward) {
    const childrenMap = new Map<string, string[]>();
    for (const kf of ks) {
      childrenMap.set(kf.id, []);
    }
    for (const kf of ks) {
      if (kf.localBefore) {
        childrenMap.get(kf.localBefore)!.push(kf.id);
      }
    }

    newGlobalOrder = globalOrder.slice(0, oldIndex);

    newGlobalOrder.push(globalOrder[oldIndex].filter(kf => kf.id !== target.id));

    let affectionSearchCurrIds = [target.id];
    const affectedChildrenIds: Set<string> = new Set()
    const affectedKfs: Keyframe<T>[] = []
    const visited: Set<string> = new Set();
    for (let i = oldIndex + 1; i <= newIndex; i++) {
      const newGlobalFrame: Keyframe<T>[] = [];

      affectionSearchCurrIds = affectionSearchCurrIds.filter(id => {
        const childStillNotVisited = childrenMap.get(id)!.some(childId => !visited.has(childId));
        return childStillNotVisited;
      });
      for (const cur of affectionSearchCurrIds) {
        childrenMap.get(cur)!.forEach(childId => {
          affectedChildrenIds.add(childId);
        });
      }
      globalOrder[i].forEach(kf => {
        if (affectedChildrenIds.has(kf.id)) {
          affectedKfs.push(kf);
          affectedChildrenIds.delete(kf.id);
          affectionSearchCurrIds.push(kf.id);
          visited.add(kf.id);
        } else {
          newGlobalFrame.push(kf);
        }
      });
      newGlobalOrder.push(newGlobalFrame);
    }

    if (type === "at") {
      newGlobalOrder[newGlobalOrder.length - 1].push(target);
    } else if (type === "after") {
      newGlobalOrder.push([target]);
    }

    affectedKfs.forEach(kf => {
      newGlobalOrder.push([kf]);
    });

    newGlobalOrder = newGlobalOrder.concat(globalOrder.slice(newIndex + 1));
  } else {
    const parentMap = new Map<string, string | null>();
    for (const kf of ks) {
      parentMap.set(kf.id, kf.localBefore);
    }

    const targetIndex = type === "at" ? newIndex : newIndex + 1
    newGlobalOrder = globalOrder.slice(0, targetIndex);

    let affectionSearchCurrId: string | null = target.id;
    const affectedKfs: Keyframe<T>[] = [];
    const affectedGlobalFrames: Keyframe<T>[][] = [];
    for (let i = oldIndex - 1; i >= targetIndex; i--) {
      const newGlobalFrame: Keyframe<T>[] = [];
      globalOrder[i].forEach(kf => {
        if (affectionSearchCurrId != null && kf.id === parentMap.get(affectionSearchCurrId)) {
          affectedKfs.unshift(kf);
          affectionSearchCurrId = kf.id;
        } else {
          newGlobalFrame.push(kf);
        }
      });
      affectedGlobalFrames.unshift(newGlobalFrame);
    }

    affectedKfs.forEach(kf => {
      newGlobalOrder.push([kf]);
    });

    if (type === "at") {
      affectedGlobalFrames[0].push(target);
    } else if (type === "after") {
      affectedGlobalFrames.unshift([target]);
    }
    newGlobalOrder = newGlobalOrder.concat(affectedGlobalFrames);

    newGlobalOrder.push(globalOrder[oldIndex].filter(kf => kf.id !== target.id));

    newGlobalOrder = newGlobalOrder.concat(globalOrder.slice(oldIndex + 1));
  }

  reassignGlobalIndexInplace(newGlobalOrder);

  return newGlobalOrder.flat();
}

export function insertKeyframeLocalAfter<T extends JsonObject>(
  ks: Keyframe<T>[],
  newKeyframe: Keyframe<T> & { localBefore: string },
): Keyframe<T>[] {
  const globalOrder = getGlobalOrder(ks);

  const newGlobalOrder: Keyframe<T>[][] = [];
  let localBeforeKf: Keyframe<T> | undefined = undefined;
  for (const group of globalOrder) {
    group.forEach(kf => {
      // SuccessorのlocalBeforeを差し替える
      if (localBeforeKf && kf.localBefore === localBeforeKf.id) {
        kf.localBefore = newKeyframe.id;
      }
    });

    newGlobalOrder.push(group);

    const localBeforeKfInThisGroup = group.find(kf => kf.id === newKeyframe.localBefore);
    if (localBeforeKfInThisGroup) {
      localBeforeKf = localBeforeKfInThisGroup;
      newGlobalOrder.push([newKeyframe]);
    }
  }
  reassignGlobalIndexInplace(newGlobalOrder);
  return newGlobalOrder.flat();
}

/**
 * すべての局所順序ごとに、含まれるKeyframeを列挙し、
 * さらに全体順序の情報 (globalIndex) を付与して返す関数。
 *
 * - localBefore=null のKeyframe を「頭」として DFS/BFSで辿り、ローカルシーケンスを構築。
 * - 1つの「頭」から複数の後続Keyframeがあれば、分岐して複数シーケンスが生成される。
 * - 「頭」が存在しない(= localBefore != null のKeyframeだけ)だが、前任先が見つからない Keyframe は孤立扱いで単体列として返す。
 * - 全体順序は getGlobalOrder の結果に基づいて（あるいは Keyframe の globalIndex をそのまま使用）、
 *   Keyframeが持つ globalIndex を参照して付与する。
 *
 * 戻り値: { sequence: {kf: Keyframe<T>, globalIndex: number}[] }[]
 *   - sequenceは局所順序の並び (頭→末尾)
 *   - 各要素で Keyframe と そのKeyframeの globalIndex を返す
 */
interface SequenceItem<T extends JsonObject> { kf: Keyframe<T>; globalIndex: number };
type NonEmptyArray<T> = [T, ...T[]];
export function getAllLocalSequencesWithGlobalOrder<T extends JsonObject>(
  ks: Keyframe<T>[]
): { id: string; sequence: NonEmptyArray<SequenceItem<T>> }[] {
  // 1. getGlobalOrder で最終的な整合性を確かめておく（サイクル検出など）
  //    サイクルがある場合、ここで例外になる可能性
  const order2d = getGlobalOrder(ks); // 2次元 [ [kA, kB], [kC], ... ]
  reassignGlobalIndexInplace(order2d);

  // 1.1 flattenして keyframeId -> Keyframe のマップを作る
  const flattened = order2d.flat();
  const mapById = new Map<string, Keyframe<T>>();
  for (const kf of flattened) {
    mapById.set(kf.id, kf);
  }

  // 2. ローカル後続をたどるため、子リスト childMap を作る: parentId -> Keyframe[] ( = parent.localBefore == parentId ? )
  const childMap = new Map<string, Keyframe<T>[]>();
  for (const kf of flattened) {
    childMap.set(kf.id, []);
  }
  for (const kf of flattened) {
    if (kf.localBefore) {
      const parentId = kf.localBefore;
      if (childMap.has(parentId)) {
        childMap.get(parentId)!.push(kf);
      } else {
        childMap.set(parentId, [kf]);
      }
    }
  }

  // 3. 頭となるKeyframeを見つける ( localBefore === null )
  //    ただし頭が無いKeyframeでも、全くつながっていない場合は単体列として扱う
  const heads = flattened.filter(k => k.localBefore === null);

  const visited = new Set<string>();
  const results: { id: string; sequence: NonEmptyArray<SequenceItem<T>> }[] = [];

  /**
   * DFSでローカルシーケンスを辿る
   */
  function dfs(current: Keyframe<T>, path: NonEmptyArray<Keyframe<T>>) {
    visited.add(current.id);
    const children = childMap.get(current.id)!; // 後続
    if (children.length === 0) {
      // 末尾まで来た
      const sequence = path.map(kf => ({
        kf,
        globalIndex: kf.globalIndex
      })) as NonEmptyArray<SequenceItem<T>>;
      results.push({ sequence, id: sequence[0].kf.id });
    } else {
      // 分岐
      for (const c of children) {
        if (!visited.has(c.id)) {
          dfs(c, [...path, c]);
        } else {
          // すでに訪問済み => ループ? => 一応無視
        }
      }
    }
  }

  // 4. 頭から DFS してローカルシーケンス列を作る
  for (const head of heads) {
    dfs(head, [head]);
  }

  // 5. 頭がないが訪問されていないKeyframeがある場合、孤立列として追加
  for (const kf of flattened) {
    if (!visited.has(kf.id)) {
      // localBefore=nullじゃない、かつ childMap上でもどこにもつながっていない？
      // => 単独シーケンス
      results.push({
        sequence: [{
          kf,
          globalIndex: kf.globalIndex
        }],
        id: kf.id
      });
      visited.add(kf.id);
    }
  }

  return results;
}

/** 1. Keyframeが局所順序関係において先頭かどうかを判定する関数
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
