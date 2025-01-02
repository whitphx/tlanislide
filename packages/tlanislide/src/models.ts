import { EASINGS, createShapeId, uniqueId } from "tldraw";
import type { Editor, JsonObject, TLShape, TLShapeId } from "tldraw";
import { getGlobalOrder, Keyframe } from "./keyframe";

export interface KeyframeDataBase extends JsonObject {
  type: string;
}
export interface ShapeAnimationKeyframeData extends KeyframeDataBase {
  type: "shapeAnimation";
  duration?: number;
  easing?: keyof typeof EASINGS;
}
export interface CameraZoomKeyframeData extends KeyframeDataBase {
  type: "cameraZoom";
  inset?: number;
  duration?: number;
  easing?: keyof typeof EASINGS;
}
export type KeyframeData = ShapeAnimationKeyframeData | CameraZoomKeyframeData;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keyframe -> JsonObject
export function keyframeToJsonObject<T extends JsonObject>(
  kf: Keyframe<T>,
): JsonObject {
  const { id, globalIndex, trackId, data } = kf;
  const obj = { id, globalIndex, trackId, data } satisfies JsonObject;
  return obj;
}

// unknown -> Keyframe<JsonObject>
function isKeyframe(obj: unknown): obj is Keyframe<JsonObject> {
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    const o = obj as { [key: string]: unknown };
    return (
      typeof o.id === "string" &&
      typeof o.globalIndex === "number" &&
      typeof o.trackId === "string" &&
      typeof o.data === "object" &&
      o.data !== null &&
      !Array.isArray(o.data)
    );
  }
  return false;
}

// JsonObject -> Keyframe<T>
export function jsonObjectToKeyframe<T extends JsonObject>(
  obj: unknown,
  validateData?: (data: JsonObject) => data is T,
): Keyframe<T> {
  if (isKeyframe(obj)) {
    // objはKeyframe<JsonObject> まで絞り込まれた
    const data = obj.data;
    if (validateData && !validateData(data)) {
      throw new Error("`data` does not match the expected shape.");
    }
    // validateDataがない場合はT=JsonObjectとして返す
    return obj as Keyframe<T>;
  }
  throw new Error(
    `Given input is not a valid Keyframe. ${JSON.stringify(obj)}`,
  );
}

export function getNextGlobalIndex<T extends JsonObject>(
  keyframes: Keyframe<T>[],
): number {
  const globalIndexes = keyframes.map((kf) => kf.globalIndex);
  return globalIndexes.length > 0 ? Math.max(...globalIndexes) + 1 : 0;
}

export function attachKeyframe(
  editor: Editor,
  shapeId: TLShapeId,
  keyframeData: KeyframeData,
) {
  const keyframe: Keyframe<KeyframeData> = {
    id: shapeId,
    globalIndex: getNextGlobalIndex(getAllKeyframes(editor)),
    trackId: uniqueId(),
    data: keyframeData,
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

export function getKeyframe(
  shape: TLShape,
): Keyframe<KeyframeData> | undefined {
  return isJsonObject(shape.meta.keyframe)
    ? jsonObjectToKeyframe(shape.meta.keyframe)
    : undefined;
}

export function getAllKeyframes(editor: Editor): Keyframe<KeyframeData>[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.map(getKeyframe).filter((keyframe) => keyframe != null);
}

export function getOrderedSteps(editor: Editor): Keyframe<KeyframeData>[][] {
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

type Step = Keyframe<KeyframeData>[];
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
