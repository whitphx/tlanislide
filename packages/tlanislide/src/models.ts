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

export interface Keyframe<T extends FrameAction = FrameAction> {
  id: string;
  globalIndex: OrderedTrackItem["globalIndex"];
  trackId: OrderedTrackItem["trackId"];
  data: T; // TODO: Rename to `action`
}
export interface SubFrame<T extends FrameAction = FrameAction> {
  id: string;
  prevFrameId: Frame["id"];
  data: T; // TODO: Rename to `action`
}

type Frame<T extends FrameAction = FrameAction> = Keyframe<T> | SubFrame<T>;
type BatchedFrames<T extends FrameAction = FrameAction> = [
  Keyframe<T>,
  ...SubFrame<T>[],
];

export type FrameBatch<T extends FrameAction = FrameAction> = OrderedTrackItem<
  BatchedFrames<T>
>;

export function keyframeToJsonObject(kf: Keyframe): JsonObject {
  const { id, globalIndex, trackId, data } = kf;
  const obj = { id, globalIndex, trackId, data } satisfies JsonObject;
  return obj;
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
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    "id" in obj &&
    "globalIndex" in obj &&
    "trackId" in obj &&
    "data" in obj &&
    isFrameAction(obj.data)
  );
}

export function jsonObjectToKeyframe(obj: unknown): Keyframe {
  if (isKeyframe(obj)) {
    return obj;
  }
  throw new Error(
    `Given input is not a valid Keyframe. ${JSON.stringify(obj)}`,
  );
}

function isSubFrame(obj: unknown): obj is SubFrame {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    "id" in obj &&
    "prevFrameId" in obj &&
    "data" in obj &&
    isFrameAction(obj.data)
  );
}

function jsonObjectToSubFrame(obj: unknown): SubFrame {
  if (isSubFrame(obj)) {
    return obj;
  }
  throw new Error(
    `Given input is not a valid SubFrame. ${JSON.stringify(obj)}`,
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

function getSubFrame(shape: TLShape): SubFrame | undefined {
  return isJsonObject(shape.meta.subFrame)
    ? jsonObjectToSubFrame(shape.meta.subFrame)
    : undefined;
}

export function getAllKeyframes(editor: Editor): Keyframe[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.map(getKeyframe).filter((keyframe) => keyframe != null);
}

export function getAllFrameBatches(editor: Editor): FrameBatch[] {
  const shapes = editor.getCurrentPageShapes();

  const keyframes: Keyframe[] = [];
  const subFrameConnections: Record<string, SubFrame> = {};
  for (const shape of shapes) {
    const keyframe = getKeyframe(shape);
    const subFrame = getSubFrame(shape);
    if (keyframe != null) {
      keyframes.push(keyframe);
    }
    if (subFrame != null) {
      subFrameConnections[subFrame.prevFrameId] = subFrame;
    }
  }

  const frameBatches: FrameBatch[] = [];
  for (const keyframe of keyframes) {
    const subFrames: SubFrame[] = [];
    let prevFrameId = keyframe.id;
    while (prevFrameId != null) {
      const subFrame = subFrameConnections[prevFrameId];
      if (subFrame != null) {
        subFrames.push(subFrame);
        prevFrameId = subFrame.id;
      } else {
        break;
      }
    }

    frameBatches.push({
      id: keyframe.id,
      globalIndex: keyframe.globalIndex,
      trackId: keyframe.trackId,
      data: [keyframe, ...subFrames],
    });
  }

  return frameBatches;
}

export function getOrderedSteps(editor: Editor): Step[] {
  const frameBatches = getAllFrameBatches(editor);
  return getGlobalOrder(frameBatches);
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

export function getShapeByFrameId(
  editor: Editor,
  frameId: Frame["id"],
): TLShape | undefined {
  const shapes = editor.getCurrentPageShapes();
  // TODO: フィールド名を統一
  const shapeWithKeyframe = shapes.find((shape) => {
    const keyframe = getKeyframe(shape);
    return keyframe != null && keyframe.id === frameId;
  });
  if (shapeWithKeyframe != null) {
    return shapeWithKeyframe;
  }
  const shapeWithSubFrame = shapes.find((shape) => {
    const subFrame = getSubFrame(shape);
    return subFrame != null && subFrame.id === frameId;
  });
  return shapeWithSubFrame;
}

type NonEmptyArray<T> = [T, ...T[]];

function runAction(
  editor: Editor,
  frames: NonEmptyArray<Frame>,
  predecessorShape: TLShape | null,
) {
  const frame = frames[0];
  const action = frame.data;
  if (action.type === "cameraZoom") {
    const shape = getShapeByFrameId(editor, frame.id);
    if (shape == null) {
      return;
    }

    const { inset = 0, duration = 0, easing = "easeInCubic" } = action;
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
    setTimeout(() => {
      const nextFrame = frames.at(1);
      if (nextFrame) {
        runAction(editor, [nextFrame, ...frames.slice(2)], shape);
      }
    }, duration);
  } else if (action.type === "shapeAnimation") {
    editor.selectNone();

    if (predecessorShape == null) {
      return;
    }

    const shape = getShapeByFrameId(editor, frame.id);
    if (shape == null) {
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

        const { duration = 0, easing = "easeInCubic" } = action;
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

          const nextFrame = frames.at(1);
          if (nextFrame) {
            runAction(editor, [nextFrame, ...frames.slice(2)], shape);
          }
        }, duration);
      },
      { history: "ignore", ignoreShapeLock: true },
    );
  }
}

type Step = FrameBatch[];
export function runStep(editor: Editor, steps: Step[], index: number): boolean {
  const step = steps[index];
  if (step == null) {
    return false;
  }

  step.forEach((frameBatch) => {
    const predecessorFrameBatch = steps
      .slice(0, frameBatch.globalIndex)
      .reverse()
      .flat()
      .find((fb) => fb.trackId === frameBatch.trackId);
    const predecessorLastFrame = predecessorFrameBatch?.data.at(-1);
    const predecessorShape =
      predecessorLastFrame != null
        ? getShapeByFrameId(editor, predecessorLastFrame.id)
        : null;
    runAction(editor, frameBatch.data, predecessorShape ?? null);
  });

  return true;
}
