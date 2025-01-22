import { getGlobalOrder, OrderedTrackItem } from "../ordered-track-item";
import type {
  Keyframe,
  FrameAction,
  SubFrame,
  FrameBatch,
  Frame,
} from "../models";

export type KeyframeUIData<T extends FrameAction = FrameAction> =
  Keyframe<T> & {
    trackIndex: number;
  };
export type SubFrameUIData<T extends FrameAction = FrameAction> =
  SubFrame<T> & {
    trackIndex: number;
  };
export type FrameUIData<T extends FrameAction = FrameAction> =
  | KeyframeUIData<T>
  | SubFrameUIData<T>;
export type UIBatchedFrames<T extends FrameAction = FrameAction> = [
  KeyframeUIData<T>,
  ...SubFrameUIData<T>[],
];
export type UIFrameBatch<T extends FrameAction = FrameAction> =
  OrderedTrackItem<UIBatchedFrames<T>>;

export type FrameBatchUIData = UIFrameBatch & { localIndex: number };

export interface Track {
  id: string;
  type: FrameAction["type"];
  // frames: Frame[];
  frameBatches: FrameBatchUIData[];
}

export function calcFrameBatchUIData(frameBatches: FrameBatch[]) {
  const orderedSteps = getGlobalOrder(frameBatches);
  const stepsUIData: FrameBatchUIData[][] = [];
  const tracksMap: Record<
    string,
    {
      type: FrameAction["type"];
      frameBatches: FrameBatchUIData[];
      frames: Frame[];
    }
  > = {};
  orderedSteps.forEach((stepFrameBatches, stepIndex) => {
    const frameBatchUIDatas: FrameBatchUIData[] = [];
    for (const frameBatch of stepFrameBatches) {
      const [keyframe, ...subFrames] = frameBatch.data;
      tracksMap[frameBatch.trackId] = tracksMap[frameBatch.trackId] ?? {
        type: keyframe.action.type,
        frameBatches: [],
        frames: [],
      };
      const frameBatchUIData: FrameBatchUIData = {
        ...frameBatch,
        globalIndex: stepIndex, // Recalculate globalIndex for each step to make this field trustworthy
        localIndex: tracksMap[frameBatch.trackId].frameBatches.length,
        data: [
          {
            ...keyframe,
            trackIndex: tracksMap[frameBatch.trackId].frames.length,
          },
          ...subFrames.map((subFrame, index) => ({
            ...subFrame,
            trackIndex: tracksMap[frameBatch.trackId].frames.length + index + 1,
          })),
        ],
      };
      frameBatchUIDatas.push(frameBatchUIData);
      tracksMap[frameBatch.trackId].frameBatches.push(frameBatchUIData);
      tracksMap[frameBatch.trackId].frames.push(keyframe, ...subFrames);
    }
    stepsUIData.push(frameBatchUIDatas);
  });

  const tracks: Track[] = Object.entries(tracksMap).map(
    ([
      trackId,
      {
        type,
        frameBatches,
        // frames,
      },
    ]) => ({
      id: trackId,
      type,
      frameBatches,
      // frames,
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
