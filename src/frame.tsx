import {
  atom,
  createShapeId,
  JsonObject,
  TLShapeId,
  type Editor,
} from "tldraw";
import {
  CAMERA_SEQUENCE_ID,
  ComputedFrame,
  PresentationFlow,
  SequenceId,
  ShapeSequenceId,
} from "./presentation-flow";

export const $presentationFlow = new PresentationFlow();

export const $presentationMode = atom<boolean>("presentation mode", false);

export const $currentFrameIndex = atom<number | "initial">(
  "current frame index",
  "initial"
);

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

export function runInitialFrame(editor: Editor) {
  const sequenceIds = Object.keys(
    $presentationFlow.state.sequences
  ) as SequenceId[];
  sequenceIds.forEach((sequenceId) => {
    if (sequenceId === CAMERA_SEQUENCE_ID) {
      return;
    }
    const sequence = $presentationFlow.state.sequences[sequenceId];

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
  });
}

export interface RunFrameOption {
  skipAnime?: boolean;
}
export function runFrame(
  editor: Editor,
  frame: ComputedFrame,
  options?: RunFrameOption
) {
  const sequenceIds = Object.keys(frame) as SequenceId[];
  sequenceIds.forEach((sequenceId) => {
    const stepPosition = frame[sequenceId];

    if (sequenceId === CAMERA_SEQUENCE_ID) {
      const cameraSequence = $presentationFlow.state.sequences[sequenceId];
      const cameraStep = cameraSequence.steps[stepPosition.index];
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
    } else {
      const shapeSequence = $presentationFlow.state.sequences[sequenceId];
      if (shapeSequence == null) {
        return;
      }
      if (stepPosition.type === "at") {
        const curStep = shapeSequence.steps[stepPosition.index];
        const prevShape =
          stepPosition.index > 0
            ? shapeSequence.steps[stepPosition.index - 1].shape
            : shapeSequence.initialShape;

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
            ? shapeSequence.steps[stepPosition.index].shape
            : shapeSequence.initialShape;
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
