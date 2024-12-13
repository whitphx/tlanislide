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
  const shapeSteps = frameSteps.filter((step) => step.type === "shape");
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
  shapeSteps.forEach((step) => {
    const shape = editor.getShape(step.shapeId);
    if (shape == null) {
      return;
    }

    editor.animateShape(
      {
        ...step.animateShapeParams.partial,
        id: shape.id,
        type: shape.type,
      },
      {
        ...step.animateShapeParams.opts,
        animation: skipAnime
          ? { duration: 0 }
          : step.animateShapeParams.opts?.animation,
      }
    );
  });
}
