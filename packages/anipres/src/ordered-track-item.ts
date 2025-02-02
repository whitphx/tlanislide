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
        throw new Error(
          `Cycle or conflict: same trackId and globalIndex ${copy[i].id} and ${copy[j].id} (${copy[i].globalIndex}, ${copy[i].trackId}) and (${copy[j].globalIndex}, ${copy[j].trackId})`,
        );
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
