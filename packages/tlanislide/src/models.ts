import { EASINGS, createShapeId, uniqueId } from "tldraw";
import type { Editor, JsonObject, TLShape, TLShapeId } from "tldraw";
import { getGlobalOrder, OrderedTrackItem } from "./ordered-track-item";

export interface FrameActionBase extends JsonObject {
  type: string;
}
export interface ShapeAnimationFrameAction extends FrameActionBase {
  type: "shapeAnimation";
  duration?: number;
  easing?: keyof typeof EASINGS;
}
export interface CameraZoomFrameAction extends FrameActionBase {
  type: "cameraZoom";
  inset?: number;
  duration?: number;
  easing?: keyof typeof EASINGS;
}
export type FrameAction = ShapeAnimationFrameAction | CameraZoomFrameAction;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type Keyframe<T extends FrameAction = FrameAction> = OrderedTrackItem<T>;

export function keyframeToJsonObject(kf: Keyframe): JsonObject {
  const { id, globalIndex, trackId, data } = kf;
  const obj = { id, globalIndex, trackId, data } satisfies JsonObject;
  return obj;
}

function isOrderedTrackItem<T extends JsonObject>(
  obj: unknown,
): obj is OrderedTrackItem<T> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    "id" in obj &&
    "globalIndex" in obj &&
    "trackId" in obj &&
    "data" in obj
  );
}

function isFrameAction(obj: unknown): obj is FrameAction {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    "type" in obj
  );
}

function isKeyframe(obj: unknown): obj is Keyframe {
  return isOrderedTrackItem(obj) && isFrameAction(obj.data);
}

export function jsonObjectToKeyframe(obj: unknown): Keyframe {
  if (isKeyframe(obj)) {
    return obj;
  }
  throw new Error(
    `Given input is not a valid Keyframe. ${JSON.stringify(obj)}`,
  );
}

export function getNextGlobalIndex(keyframes: Keyframe[]): number {
  const globalIndexes = keyframes.map((kf) => kf.globalIndex);
  return globalIndexes.length > 0 ? Math.max(...globalIndexes) + 1 : 0;
}

export function attachKeyframe(
  editor: Editor,
  shapeId: TLShapeId,
  frameAction: FrameAction,
) {
  const keyframe: Keyframe = {
    id: shapeId,
    globalIndex: getNextGlobalIndex(getAllKeyframes(editor)),
    trackId: uniqueId(),
    data: frameAction,
  };

  const shape = editor.getShape(shapeId);
  if (shape == null) {
    return;
  }
  editor.updateShape({
    id: shapeId,
    type: shape.type,
    meta: {
      keyframe: keyframeToJsonObject(keyframe),
    },
  });
}

export function detatchKeyframe(editor: Editor, shapeId: TLShapeId) {
  const shape = editor.getShape(shapeId);
  if (shape == null) {
    return;
  }
  editor.updateShape({
    id: shape.id,
    type: shape.type,
    meta: {
      keyframe: undefined,
    },
  });
}

export function getKeyframe(shape: TLShape): Keyframe | undefined {
  return isJsonObject(shape.meta.keyframe)
    ? jsonObjectToKeyframe(shape.meta.keyframe)
    : undefined;
}

export function getAllKeyframes(editor: Editor): Keyframe[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.map(getKeyframe).filter((keyframe) => keyframe != null);
}

export function getOrderedSteps(editor: Editor): Keyframe[][] {
  const keyframes = getAllKeyframes(editor);
  const globalOrder = getGlobalOrder(keyframes);
  return globalOrder;
}

export function getShapeFromKeyframeId(
  editor: Editor,
  keyframeId: string,
): TLShape | undefined {
  const shapes = editor.getCurrentPageShapes();
  return shapes.find((shape) => {
    const keyframe = getKeyframe(shape);
    return keyframe != null && keyframe.id === keyframeId;
  });
}

type Step = Keyframe[];
export function runStep(editor: Editor, steps: Step[], index: number): boolean {
  const step = steps[index];
  if (step == null) {
    return false;
  }
  step.forEach((keyframe) => {
    if (keyframe.data.type === "cameraZoom") {
      const shape = getShapeFromKeyframeId(editor, keyframe.id);
      if (shape == null) {
        return;
      }

      const { inset = 0, duration = 0, easing = "easeInCubic" } = keyframe.data;
      const immediate = duration === 0;

      editor.stopCameraAnimation();
      const bounds = editor.getShapePageBounds(shape);
      if (!bounds) return;
      editor.selectNone();
      editor.zoomToBounds(bounds, {
        inset,
        immediate,
        animation: { duration, easing: EASINGS[easing] },
      });
    } else if (keyframe.data.type === "shapeAnimation") {
      const predecessorKeyframe = steps
        .slice(0, keyframe.globalIndex)
        .reverse()
        .flat()
        .find((kf) => kf.trackId === keyframe.trackId);
      if (predecessorKeyframe == null) {
        return;
      }

      editor.selectNone();

      const shape = getShapeFromKeyframeId(editor, keyframe.id);
      if (shape == null) {
        return;
      }
      const predecessorShape = getShapeFromKeyframeId(
        editor,
        predecessorKeyframe.id,
      );
      if (predecessorShape == null) {
        return;
      }

      editor.run(
        () => {
          editor.updateShape({
            id: shape.id,
            type: shape.id,
            meta: {
              ...shape.meta,
              hiddenDuringAnimation: true,
            },
          });

          const { duration = 0, easing = "easeInCubic" } = keyframe.data;
          const immediate = duration === 0;

          // Create and manipulate a temporary shape for animation
          const animeShapeId = createShapeId();
          editor.createShape({
            ...predecessorShape,
            id: animeShapeId,
            type: shape.type,
            meta: undefined,
          });
          editor.animateShape(
            {
              ...shape,
              id: animeShapeId,
              meta: undefined,
            },
            {
              immediate,
              animation: {
                duration,
                easing: EASINGS[easing],
              },
            },
          );
          setTimeout(() => {
            editor.run(
              () => {
                editor.deleteShape(animeShapeId);

                editor.updateShape({
                  id: shape.id,
                  type: shape.id,
                  meta: {
                    ...shape.meta,
                    hiddenDuringAnimation: false,
                  },
                });
              },
              { history: "ignore", ignoreShapeLock: true },
            );
          }, duration);
        },
        { history: "ignore", ignoreShapeLock: true },
      );
    }
  });
  return true;
}
