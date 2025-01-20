export interface OrderedTrackItem<T = unknown> {
  id: string;
  globalIndex: number;
  trackId: string;
  data: T;
}

// A group of items with the same globalIndex.
export type ItemGroup<T> = OrderedTrackItem<T>[];

/**
 * getGlobalOrder:
 * OrderedTrackItem[]をコピーし、(1) 同じtrackId内で globalIndex の大小 ⇒ a->b,
 * (2) 全体で a.globalIndex < b.globalIndex ⇒ a->b
 * の2種類のエッジをDAGに追加し、トポロジカルソート。
 * サイクルあれば例外。最後に "globalIndex" ごとにまとめた2次元配列で返す。
 */
export function getGlobalOrder<T>(
  items: OrderedTrackItem<T>[],
): ItemGroup<T>[] {
  // 1. Copy & sort by globalIndex
  const copy = items.map((item) => ({ ...item }));
  copy.sort((a, b) => a.globalIndex - b.globalIndex);

  // 2. Early conflict detection using double nested loop
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

  // 3. DAG construction for topological sort
  const graph = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const item of copy) {
    graph.set(item.id, []);
    indeg.set(item.id, 0);
  }

  // 3.1 Add edges for same trackId with ascending globalIndex
  for (let i = 0; i < copy.length; i++) {
    for (let j = i + 1; j < copy.length; j++) {
      const a = copy[i],
        b = copy[j];
      if (a.trackId === b.trackId && a.globalIndex < b.globalIndex) {
        graph.get(a.id)!.push(b.id);
        indeg.set(b.id, indeg.get(b.id)! + 1);
      }
    }
  }

  // 3.2 Add edges for global ordering by globalIndex
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

  // 4. Topological sort
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
    throw new Error("Cycle or conflict: topological sort failed");
  }

  // 5. Group by globalIndex
  const byId = new Map<string, OrderedTrackItem<T>>();
  for (const c of copy) byId.set(c.id, c);

  const visited = new Set<string>();
  const result: ItemGroup<T>[] = [];
  let currentGroup: ItemGroup<T> = [];
  let currentIndex = -1;

  for (const id of sorted) {
    if (visited.has(id)) continue;
    visited.add(id);
    const item = byId.get(id)!;
    if (item.globalIndex !== currentIndex) {
      currentGroup = [];
      result.push(currentGroup);
      currentIndex = item.globalIndex;
    }
    currentGroup.push(item);
  }
  return result;
}

export function reassignGlobalIndexInplace<T>(globalOrder: ItemGroup<T>[]) {
  let gIndex = 0;
  for (const group of globalOrder) {
    if (group.length === 0) continue;
    for (const item of group) {
      item.globalIndex = gIndex;
    }
    gIndex++;
  }
}

export function moveItemPreservingLocalOrder<T>(
  items: OrderedTrackItem<T>[],
  targetId: string,
  newIndex: number,
  type: "at" | "after",
): OrderedTrackItem<T>[] {
  if (items.length <= 1) return items;

  const globalOrder = getGlobalOrder(items);

  const oldIndex = globalOrder.findIndex((group) =>
    group.some((k) => k.id === targetId),
  );
  if (oldIndex === -1) return items;

  const target = globalOrder[oldIndex].find((k) => k.id === targetId);
  if (target == null) return items;

  if (type === "at" && oldIndex === newIndex) return items;

  const isForward = oldIndex <= newIndex;

  let newGlobalOrder: ItemGroup<T>[] = [];
  if (isForward) {
    newGlobalOrder = globalOrder.slice(0, oldIndex); // [0, oldIndex) are not affected.

    newGlobalOrder.push(globalOrder[oldIndex].filter((k) => k.id !== targetId)); // Remove target

    const pushedOutItems: OrderedTrackItem<T>[] = [];
    for (let i = oldIndex + 1; i <= newIndex; i++) {
      const updatedItemGroup: ItemGroup<T> = [];
      globalOrder[i].forEach((k) => {
        if (k.trackId === target.trackId) {
          pushedOutItems.push(k);
        } else {
          updatedItemGroup.push(k);
        }
      });
      newGlobalOrder.push(updatedItemGroup);
    }

    if (type === "at") {
      newGlobalOrder[newGlobalOrder.length - 1].push(target);
    } else if (type === "after") {
      newGlobalOrder.push([target]);
    }

    pushedOutItems.forEach((k) => {
      newGlobalOrder.push([k]);
    });

    newGlobalOrder.push(...globalOrder.slice(newIndex + 1));
  } else {
    const targetIndex = type === "at" ? newIndex : newIndex + 1;
    newGlobalOrder = globalOrder.slice(0, targetIndex); // [0, targetIndex) are not affected.

    const pushedOutItems: OrderedTrackItem<T>[] = [];
    const affectedItemGroups: ItemGroup<T>[] = [];
    for (let i = oldIndex - 1; i >= targetIndex; i--) {
      const updatedItemGroup: ItemGroup<T> = [];
      globalOrder[i].forEach((k) => {
        if (k.trackId === target.trackId) {
          pushedOutItems.unshift(k);
        } else {
          updatedItemGroup.push(k);
        }
      });
      affectedItemGroups.unshift(updatedItemGroup);
    }

    newGlobalOrder.push(...pushedOutItems.map((k) => [k]));

    if (type === "at") {
      affectedItemGroups[0].push(target);
    } else if (type === "after") {
      affectedItemGroups.unshift([target]);
    }
    newGlobalOrder.push(...affectedItemGroups);

    newGlobalOrder.push(globalOrder[oldIndex].filter((k) => k.id !== targetId));

    newGlobalOrder.push(...globalOrder.slice(oldIndex + 1));
  }

  reassignGlobalIndexInplace(newGlobalOrder);
  return newGlobalOrder.flat();
}

export function insertOrderedTrackItem<T>(
  items: OrderedTrackItem<T>[],
  newItem: OrderedTrackItem<T>,
  globalIndex: number,
): OrderedTrackItem<T>[] {
  const globalOrder = getGlobalOrder(items);

  const newGlobalOrder = [
    ...globalOrder.slice(0, globalIndex),
    [newItem],
    ...globalOrder.slice(globalIndex),
  ];
  reassignGlobalIndexInplace(newGlobalOrder);
  return newGlobalOrder.flat();
}
