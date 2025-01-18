import { getGlobalOrder } from "../keyframe";
import type { FrameAction, Keyframe } from "../models";

export interface Track {
  id: string;
  type: FrameAction["type"];
}

export type KeyframeUIData = Keyframe & { localIndex: number };

export function calcKeyframeUIData(kfs: Keyframe[]) {
  const orderedSteps = getGlobalOrder(kfs);
  const stepsUIData: KeyframeUIData[][] = [];
  const tracksMap: Record<
    string,
    { type: FrameAction["type"]; keyframeCount: number }
  > = {};
  for (const step of orderedSteps) {
    const frameUIData: KeyframeUIData[] = [];
    for (const keyframe of step) {
      tracksMap[keyframe.trackId] = tracksMap[keyframe.trackId] ?? {
        type: keyframe.data.type,
        keyframeCount: 0,
      };
      frameUIData.push({
        ...keyframe,
        localIndex: tracksMap[keyframe.trackId].keyframeCount,
      });
      tracksMap[keyframe.trackId].keyframeCount++;
    }
    stepsUIData.push(frameUIData);
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
