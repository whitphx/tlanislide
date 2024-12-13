import { atom, type Editor } from "tldraw";
import { PresentationFlow, type ComputedFrame } from "./presentation-flow";

export const $presentationFlow = new PresentationFlow();

export const $currentFrameIndex = atom<number>("current frame index", 0);

export interface RunFrameOption {
  skipAnime?: boolean;
}
export function runFrame(
  editor: Editor,
  frameSteps: ComputedFrame,
  options?: RunFrameOption
) {
  const { skipAnime = false } = options ?? {};

  const cameraStep = frameSteps.find((step) => step.type === "camera");
  if (cameraStep) {
    const bounds = editor.getShapePageBounds(cameraStep.shapeId);
    if (!bounds) {
      return;
    }

    editor.zoomToBounds(bounds, {
      ...cameraStep.zoomToBoundsParams,
      animation: skipAnime
        ? undefined
        : cameraStep.zoomToBoundsParams.animation,
    });
  }
}
