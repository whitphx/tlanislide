import {
  atom,
  createShapeId,
  EASINGS,
  JsonObject,
  TLCameraMoveOptions,
  TLShape,
  TLShapeId,
  type Editor,
} from "tldraw";
import {
  CAMERA_SEQUENCE_ID,
  ComputedFrame,
  JSONSerializableTLCameraMoveOptions,
  PresentationFlow,
  RelativeStepIndex,
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

export function getAnimeMeta(
  shape: TLShape
): AnimeDataMeta["anime"] | undefined {
  return shape.meta?.anime as AnimeDataMeta["anime"] | undefined;
}

function deserializeTLCameraMoveOptions(
  options: JSONSerializableTLCameraMoveOptions
): TLCameraMoveOptions {
  return {
    ...options,
    animation: options.animation
      ? {
          ...options.animation,
          easing:
            options.animation.easing &&
            EASINGS[options.animation.easing as keyof typeof EASINGS],
        }
      : undefined,
  };
}

function createSequenceShapeId(sequenceId: ShapeSequenceId): TLShapeId {
  return createShapeId(`Sequence:${sequenceId}`);
}

export interface RunFrameOption {
  skipAnime?: boolean;
}

export function runCurrentFrame(editor: Editor, options?: RunFrameOption) {
  const currentFrameIndex = $currentFrameIndex.get();
  if (currentFrameIndex === "initial") {
    runInitialFrame(editor);
  } else {
    const frame = $presentationFlow.getFrames()[currentFrameIndex];
    runFrame(editor, frame, options);
  }
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

export function runFrame(
  editor: Editor,
  frame: ComputedFrame,
  options?: RunFrameOption
) {
  const sequenceIds = Object.keys(frame) as SequenceId[];
  sequenceIds.forEach((sequenceId) => {
    const stepPosition = frame[sequenceId];

    if (sequenceId === CAMERA_SEQUENCE_ID) {
      if (stepPosition.index === "initial") {
        return;
      }
      const cameraSequence = $presentationFlow.state.sequences[sequenceId];
      const cameraStep = cameraSequence.steps[stepPosition.index];
      const skipAnime = stepPosition.type === "after" || options?.skipAnime;
      const bounds = editor.getShapePageBounds(cameraStep.shapeId);
      if (!bounds) {
        return;
      }

      const zoomToBoundsParams = deserializeTLCameraMoveOptions(
        cameraStep.zoomToBoundsParams
      );
      if (skipAnime) {
        zoomToBoundsParams.animation = undefined;
      }
      editor.zoomToBounds(bounds, zoomToBoundsParams);
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
            ? deserializeTLCameraMoveOptions(curStep.animateShapeOpts)
            : undefined
        );
      } else if (stepPosition.type === "after") {
        const curShape =
          stepPosition.index === "initial"
            ? shapeSequence.initialShape
            : shapeSequence.steps[stepPosition.index].shape;
        const animeShapeId = createSequenceShapeId(sequenceId);
        // Ensure the current shape exists
        const animeShape = editor.getShape(animeShapeId);

        const meta: AnimeDataMeta = {
          anime: {
            type: "presentation",
            sequenceId,
            index: stepPosition.index,
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
