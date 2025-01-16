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

  // 1.5 Check for conflicts (same trackId and globalIndex)
  // Use double nested loop to check all combinations of keyframes
  // This catches conflicts even if the keyframes aren't adjacent after sorting
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      if (
        copy[i].trackId === copy[j].trackId &&
        copy[i].globalIndex === copy[j].globalIndex
      ) {
        throw new Error("Cycle or conflict: same trackId and globalIndex");
      }
    }
  }

  // 2. Group by globalIndex
  const result: Keyframe<T>[][] = [];
  let currentGroup: Keyframe<T>[] = [];
  let currentIndex = -1;

  for (const kf of copy) {
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
