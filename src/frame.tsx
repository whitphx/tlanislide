import {
  atom,
  createShapeId,
  JsonObject,
  TLShapeId,
  type Editor,
} from "tldraw";
import {
  ComputedFrame,
  PresentationFlow,
  ShapeSequenceId,
} from "./presentation-flow";

export const $presentationFlow = new PresentationFlow();

export const $presentationMode = atom<boolean>("presentation mode", false);

export const $currentFrameIndex = atom<number>("current frame index", 0);

export interface AnimeDataMeta extends JsonObject {
  anime: {
    type: "presentation" | "edit";
    sequenceId: ShapeSequenceId;
    index: number | "initial";
  };
}

function createSequenceShapeId(sequenceId: ShapeSequenceId): TLShapeId {
  return createShapeId(`Sequence:${sequenceId}`);
}

export function renderInitialShapes(editor: Editor) {
  Object.entries($presentationFlow.state.sequences).forEach(
    ([sequenceId, sequence]) => {
      if (sequence.type === "camera") {
        return;
      }

      const initialShape = sequence.initialShape;
      const animeShapeId = createSequenceShapeId(sequenceId);

      const animeShape = editor.getShape(animeShapeId);
      const meta: AnimeDataMeta = {
        anime: {
          type: "presentation",
          sequenceId,
          index: "initial",
        },
      };
      if (animeShape == null) {
        editor.createShape({
          ...initialShape,
          id: animeShapeId,
          meta,
        });
      } else {
        editor.updateShape({
          ...initialShape,
          id: animeShapeId,
          meta,
        });
      }
    }
  );
}

export interface RunFrameOption {
  skipAnime?: boolean;
}
export function runFrame(
  editor: Editor,
  frame: ComputedFrame,
  options?: RunFrameOption
) {
  Object.entries(frame).forEach(([sequenceId, stepPosition]) => {
    const sequence = $presentationFlow.state.sequences[sequenceId];
    if (sequence == null) {
      return;
    }

    if (sequence.type === "camera") {
      const cameraStep = sequence.steps[stepPosition.index];
      const skipAnime = stepPosition.type === "after" || options?.skipAnime;
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
    } else if (sequence.type === "shape") {
      if (stepPosition.type === "at") {
        const curStep = sequence.steps[stepPosition.index];
        const prevShape =
          stepPosition.index > 0
            ? sequence.steps[stepPosition.index - 1].shape
            : sequence.initialShape;

        const animeShapeId = createSequenceShapeId(sequenceId);

        const meta: AnimeDataMeta = {
          anime: {
            type: "presentation",
            sequenceId,
            index: stepPosition.index,
          },
        };

        // Ensure the previous shape exists
        const animeShape = editor.getShape(animeShapeId);
        if (animeShape == null) {
          editor.createShape({
            ...prevShape,
            id: animeShapeId,
            meta,
          });
        } else {
          editor.updateShape({
            ...prevShape,
            id: animeShapeId,
            meta,
          });
        }

        // Trigger the animation
        editor.animateShape(
          {
            ...animeShape,
            ...curStep.shape,
            props: {
              ...animeShape?.props,
              ...curStep.shape.props,
            },
            meta: {
              ...animeShape?.meta,
              ...curStep.shape.meta,
            },
            id: animeShapeId,
          },
          curStep.animateShapeOpts
        );
      } else if (stepPosition.type === "after") {
        const curShape =
          stepPosition.index >= 0
            ? sequence.steps[stepPosition.index].shape
            : sequence.initialShape;
        const animeShapeId = createSequenceShapeId(sequenceId);
        // Ensure the current shape exists
        const animeShape = editor.getShape(animeShapeId);

        const meta: AnimeDataMeta = {
          anime: {
            type: "presentation",
            sequenceId,
            index: stepPosition.index >= 0 ? stepPosition.index : "initial",
          },
        };

        if (animeShape == null) {
          editor.createShape({
            ...curShape,
            id: animeShapeId,
            meta,
          });
        } else {
          editor.updateShape({
            ...curShape,
            id: animeShapeId,
            meta,
          });
        }
      }
    }
  });
}
