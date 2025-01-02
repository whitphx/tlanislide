import type { JsonObject } from "tldraw";

export interface Keyframe<T extends JsonObject> {
  id: string;
  globalIndex: number;
  trackId: string;
  data: T;
}

/**
 * getGlobalOrder:
 * Keyframe[]をコピーし、(1) 同じtrackId内で globalIndex の大小 ⇒ a->b,
 * (2) 全体で a.globalIndex < b.globalIndex ⇒ a->b
 * の2種類のエッジをDAGに追加し、トポロジカルソート。
 * サイクルあれば例外。最後に "globalIndex" ごとにまとめた2次元配列で返す。
 */
export function getGlobalOrder<T extends JsonObject>(
  ks: Keyframe<T>[],
): Keyframe<T>[][] {
  // 1. 複製 & globalIndex昇順でソート
  const copy = ks.map((k) => ({ ...k }));
  copy.sort((a, b) => a.globalIndex - b.globalIndex);

  // 2. DAG構築
  const graph = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const kf of copy) {
    graph.set(kf.id, []);
    indeg.set(kf.id, 0);
  }

  // 2.1 同じ trackId で a.globalIndex < b.globalIndex => a->b
  //     (線形な局所順序があるだけなら、a,bで a->bを張ればよい)
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      const a = copy[i],
        b = copy[j];
      // 同じ局所ID & a< b => a->b
      if (a.trackId === b.trackId && a.globalIndex < b.globalIndex) {
        graph.get(a.id)!.push(b.id);
        indeg.set(b.id, indeg.get(b.id)! + 1);
      }
    }
  }

  // 2.2 全体で a.globalIndex < b.globalIndex => a->b (オプション)
  //     ユーザー要件: "全体順序でも globalIndex 昇順を優先"
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      const a = copy[i],
        b = copy[j];
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

  // 4. globalIndex毎にまとめ
  const byId = new Map<string, Keyframe<T>>();
  for (const c of copy) byId.set(c.id, c);

  const visited = new Set<string>();
  const result: Keyframe<T>[][] = [];
  let currentGroup: Keyframe<T>[] = [];
  let currentIndex = -1;

  for (const id of sorted) {
    if (visited.has(id)) continue;
    visited.add(id);
    const kf = byId.get(id)!;
    if (kf.globalIndex !== currentIndex) {
      currentGroup = [];
      result.push(currentGroup);
      currentIndex = kf.globalIndex;
    }
    currentGroup.push(kf);
  }
  return result;
}

function reassignGlobalIndexInplace<T extends JsonObject>(
  globalOrder: Keyframe<T>[][],
) {
  let gIndex = 0;
  for (const group of globalOrder) {
    if (group.length === 0) continue;
    for (const kf of group) {
      kf.globalIndex = gIndex;
    }
    gIndex++;
  }
}

export function moveKeyframePreservingLocalOrder<T extends JsonObject>(
  ks: Keyframe<T>[],
  targetId: string,
  newIndex: number,
  type: "at" | "after",
): Keyframe<T>[] {
  if (ks.length <= 1) return ks;

  const globalOrder = getGlobalOrder(ks);

  const oldIndex = globalOrder.findIndex((group) =>
    group.some((k) => k.id === targetId),
  );
  if (oldIndex === -1) return ks;

  const target = globalOrder[oldIndex].find((k) => k.id === targetId);
  if (target == null) return ks;

  if (type === "at" && oldIndex === newIndex) return ks;

  const isForward = oldIndex <= newIndex;

  let newGlobalOrder: Keyframe<T>[][] = [];
  if (isForward) {
    newGlobalOrder = globalOrder.slice(0, oldIndex); // [0, oldIndex) are not affected.

    newGlobalOrder.push(globalOrder[oldIndex].filter((k) => k.id !== targetId)); // Remove target

    const pushedOutKfs: Keyframe<T>[] = [];
    for (let i = oldIndex + 1; i <= newIndex; i++) {
      const updatedGlobalFrame: Keyframe<T>[] = [];
      globalOrder[i].forEach((k) => {
        if (k.trackId === target.trackId) {
          pushedOutKfs.push(k);
        } else {
          updatedGlobalFrame.push(k);
        }
      });
      newGlobalOrder.push(updatedGlobalFrame);
    }

    if (type === "at") {
      newGlobalOrder[newGlobalOrder.length - 1].push(target);
    } else if (type === "after") {
      newGlobalOrder.push([target]);
    }

    pushedOutKfs.forEach((k) => {
      newGlobalOrder.push([k]);
    });

    newGlobalOrder.push(...globalOrder.slice(newIndex + 1));
  } else {
    const targetIndex = type === "at" ? newIndex : newIndex + 1;
    newGlobalOrder = globalOrder.slice(0, targetIndex); // [0, targetIndex) are not affected.

    const pushedOutKfs: Keyframe<T>[] = [];
    const affectedGlobalFrames: Keyframe<T>[][] = [];
    for (let i = oldIndex - 1; i >= targetIndex; i--) {
      const updatedGlobalFrame: Keyframe<T>[] = [];
      globalOrder[i].forEach((k) => {
        if (k.trackId === target.trackId) {
          pushedOutKfs.unshift(k);
        } else {
          updatedGlobalFrame.push(k);
        }
      });
      affectedGlobalFrames.unshift(updatedGlobalFrame);
    }

    newGlobalOrder.push(...pushedOutKfs.map((k) => [k]));

    if (type === "at") {
      affectedGlobalFrames[0].push(target);
    } else if (type === "after") {
      affectedGlobalFrames.unshift([target]);
    }
    newGlobalOrder.push(...affectedGlobalFrames);

    newGlobalOrder.push(globalOrder[oldIndex].filter((k) => k.id !== targetId));

    newGlobalOrder.push(...globalOrder.slice(oldIndex + 1));
  }

  reassignGlobalIndexInplace(newGlobalOrder);
  return newGlobalOrder.flat();
}

export function insertKeyframe<T extends JsonObject>(
  ks: Keyframe<T>[],
  newKeyframe: Keyframe<T>,
  globalIndex: number,
): Keyframe<T>[] {
  const globalOrder = getGlobalOrder(ks);

  const newGlobalOrder = [
    ...globalOrder.slice(0, globalIndex),
    [newKeyframe],
    ...globalOrder.slice(globalIndex),
  ];
  reassignGlobalIndexInplace(newGlobalOrder);
  return newGlobalOrder.flat();
}
