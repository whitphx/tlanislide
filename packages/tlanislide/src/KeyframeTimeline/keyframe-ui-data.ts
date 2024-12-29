import { getGlobalOrder, type Keyframe } from "../keyframe";
import type { KeyframeData } from "../models";

export interface Track {
  id: string;
  type: KeyframeData["type"];
}

export type KeyframeUIData = Keyframe<KeyframeData> & { localIndex: number };

export function calcKeyframeUIData(
  ks: Keyframe<KeyframeData>[],
) {
  const globalFrames = getGlobalOrder(ks);
  const globalFramesUIData: KeyframeUIData[][] = [];
  const tracksMap: Record<
    string,
    { type: KeyframeData["type"]; keyframeCount: number }
  > = {};
  for (const frame of globalFrames) {
    const frameUIData: KeyframeUIData[] = [];
    for (const keyframe of frame) {
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
    globalFramesUIData.push(frameUIData);
  }

  const tracks: Track[] = Object.entries(tracksMap).map(
    ([trackId, { type }]) => ({
      id: trackId,
      type,
    })
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

  return { globalFrames: globalFramesUIData, tracks };
}
