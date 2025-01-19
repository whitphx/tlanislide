import { getGlobalOrder } from "../ordered-track-item";
import type { FrameAction, FrameBatch } from "../models";

export interface Track {
  id: string;
  type: FrameAction["type"];
}

export type FrameBatchUIData = FrameBatch & { localIndex: number };

export function calcFrameBatchUIData(frameBatches: FrameBatch[]) {
  const orderedSteps = getGlobalOrder(frameBatches);
  const stepsUIData: FrameBatchUIData[][] = [];
  const tracksMap: Record<
    string,
    { type: FrameAction["type"]; batchCount: number }
  > = {};
  for (const step of orderedSteps) {
    const frameBatchUIData: FrameBatchUIData[] = [];
    for (const batch of step) {
      tracksMap[batch.trackId] = tracksMap[batch.trackId] ?? {
        type: batch.data[0].type,
        batchCount: 0,
      };
      frameBatchUIData.push({
        ...batch,
        localIndex: tracksMap[batch.trackId].batchCount,
      });
      tracksMap[batch.trackId].batchCount++;
    }
    stepsUIData.push(frameBatchUIData);
  }

  const tracks: Track[] = Object.entries(tracksMap).map(
    ([trackId, { type }]) => ({
      id: trackId,
      type,
    }),
  );
  tracks.sort((a, b) => {
    // cameraZoom should be at the top
    if (a.type === "cameraZoom") {
      return -1;
    }
    if (b.type === "cameraZoom") {
      return 1;
    }
    return a.id.localeCompare(b.id); // TODO: Better sorting criteria?
  });

  return { steps: stepsUIData, tracks };
}
