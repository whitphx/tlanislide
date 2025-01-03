import { getGlobalOrder, type Keyframe } from "../keyframe";
import type { KeyframeData } from "../models";

export interface Track {
  id: string;
  type: KeyframeData["type"];
}

export type KeyframeUIData = Keyframe<KeyframeData> & { localIndex: number };

export function calcKeyframeUIData(ks: Keyframe<KeyframeData>[]) {
  const orderedSteps = getGlobalOrder(ks);
  const stepsUIData: KeyframeUIData[][] = [];
  const tracksMap: Record<
    string,
    { type: KeyframeData["type"]; keyframeCount: number }
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
