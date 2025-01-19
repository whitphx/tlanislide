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

export interface FrameBase {
  id: string;
  type: string;
}
export interface Keyframe<T extends FrameAction = FrameAction>
  extends FrameBase {
  type: "keyframe";
  globalIndex: OrderedTrackItem["globalIndex"];
  trackId: OrderedTrackItem["trackId"];
  action: T;
}
export interface SubFrame<T extends FrameAction = FrameAction>
  extends FrameBase {
  type: "subFrame";
  prevFrameId: Frame["id"];
  action: T;
}
export type Frame<T extends FrameAction = FrameAction> =
  | Keyframe<T>
  | SubFrame<T>;

type BatchedFrames<T extends FrameAction = FrameAction> = [
  Keyframe<T>,
  ...SubFrame<T>[],
];

export type FrameBatch<T extends FrameAction = FrameAction> = OrderedTrackItem<
  BatchedFrames<T>
>;

export function keyframeToJsonObject(kf: Keyframe): JsonObject {
  const { id, type, globalIndex, trackId, action } = kf;
  const obj = { id, type, globalIndex, trackId, action } satisfies JsonObject;
  return obj;
}

export function subFrameToJsonObject(sf: SubFrame): JsonObject {
  const { id, type, prevFrameId, action } = sf;
  const obj = { id, type, prevFrameId, action } satisfies JsonObject;
  return obj;
}

export function frameToJsonObject(frame: Frame): JsonObject {
  if (frame.type === "keyframe") {
    return keyframeToJsonObject(frame);
  } else if (frame.type === "subFrame") {
    return subFrameToJsonObject(frame);
  }
  // @ts-expect-error This should never happen
  throw new Error(`Invalid frame type: ${frame.type}`);
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
    "type" in obj &&
    obj.type === "keyframe" &&
    "globalIndex" in obj &&
    "trackId" in obj &&
    "action" in obj &&
    isFrameAction(obj.action)
  );
}

export function jsonObjectToKeyframe(obj: unknown): Keyframe {
  if (isKeyframe(obj)) {
    return { ...obj };
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
    "type" in obj &&
    obj.type === "subFrame" &&
    "prevFrameId" in obj &&
    "action" in obj &&
    isFrameAction(obj.action)
  );
}

function jsonObjectToSubFrame(obj: unknown): SubFrame {
  if (isSubFrame(obj)) {
    return { ...obj };
  }
  throw new Error(
    `Given input is not a valid SubFrame. ${JSON.stringify(obj)}`,
  );
}

function getAllKeyframes(editor: Editor): Keyframe[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.map(getKeyframe).filter((keyframe) => keyframe != null);
}

export function getNextGlobalIndexFromKeyframes(keyframes: Keyframe[]): number {
  const globalIndexes = keyframes.map((kf) => kf.globalIndex);
  return globalIndexes.length > 0 ? Math.max(...globalIndexes) + 1 : 0;
}

export function getNextGlobalIndex(editor: Editor): number {
  return getNextGlobalIndexFromKeyframes(getAllKeyframes(editor));
}

export function attachKeyframe(
  editor: Editor,
  shapeId: TLShapeId,
  frameAction: FrameAction,
) {
  const keyframe: Keyframe = {
    id: shapeId,
    type: "keyframe",
    globalIndex: getNextGlobalIndex(editor),
    trackId: uniqueId(),
    action: frameAction,
  };

  const shape = editor.getShape(shapeId);
  if (shape == null) {
    return;
  }
  editor.updateShape({
    id: shapeId,
    type: shape.type,
    meta: {
      frame: keyframeToJsonObject(keyframe),
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
      frame: undefined,
    },
  });
}

export function getFrame(shape: TLShape): Frame | undefined {
  return getKeyframe(shape) ?? getSubFrame(shape);
}

export function getKeyframe(shape: TLShape): Keyframe | undefined {
  return isJsonObject(shape.meta.frame) && shape.meta.frame.type === "keyframe"
    ? jsonObjectToKeyframe(shape.meta.frame)
    : undefined;
}

export function getSubFrame(shape: TLShape): SubFrame | undefined {
  return isJsonObject(shape.meta.frame) && shape.meta.frame.type === "subFrame"
    ? jsonObjectToSubFrame(shape.meta.frame)
    : undefined;
}

export function getAllFrames(editor: Editor): Frame[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.map(getFrame).filter((frame) => frame != null);
}

export function getFrameBatches(frames: Frame[]): FrameBatch[] {
  const keyframes: Keyframe[] = [];
  const subFrameConnections: Record<string, SubFrame> = {};
  for (const frame of frames) {
    if (frame.type === "keyframe") {
      keyframes.push(frame);
    } else if (frame.type === "subFrame") {
      subFrameConnections[frame.prevFrameId] = frame;
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

export function getFramesFromFrameBatches(frameBatches: FrameBatch[]): Frame[] {
  return frameBatches.flatMap((batch) => batch.data);
}

export function getOrderedSteps(editor: Editor): Step[] {
  const frames = getAllFrames(editor);
  const frameBatches = getFrameBatches(frames);
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
  return shapes.find((shape) => {
    const frame = getFrame(shape);
    return frame != null && frame.id === frameId;
  });
}

type NonEmptyArray<T> = [T, ...T[]];

async function runFrames(
  editor: Editor,
  frames: NonEmptyArray<Frame>,
  predecessorShape: TLShape | null,
): Promise<void> {
  for (const frame of frames) {
    const action = frame.action;

    const { duration = 0, easing = "easeInCubic" } = action;
    const immediate = duration === 0;

    const shape = getShapeByFrameId(editor, frame.id);
    if (shape == null) {
      throw new Error(`Shape not found for frame ${frame.id}`);
    }

    if (action.type === "cameraZoom") {
      const { inset = 0 } = action;

      editor.stopCameraAnimation();
      const bounds = editor.getShapePageBounds(shape);
      if (!bounds) {
        throw new Error(`Bounds not found for shape ${shape.id}`);
      }
      editor.selectNone();
      editor.zoomToBounds(bounds, {
        inset,
        immediate,
        animation: { duration, easing: EASINGS[easing] },
      });
    } else if (action.type === "shapeAnimation") {
      editor.selectNone();

      if (predecessorShape == null) {
        predecessorShape = shape;
        continue;
      }

      // Create and manipulate a temporary shape for animation
      const animeShapeId = createShapeId();
      editor.run(
        () => {
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
        },
        { history: "ignore", ignoreShapeLock: true },
      );

      setTimeout(() => {
        editor.run(
          () => {
            editor.deleteShape(animeShapeId);
          },
          { history: "ignore", ignoreShapeLock: true },
        );
      }, duration);
    }

    await new Promise((resolve) => setTimeout(resolve, duration));

    predecessorShape = shape;
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

    const frames = frameBatch.data;
    const frameShapes = frames
      .map((frame) => getShapeByFrameId(editor, frame.id))
      .filter((shape) => shape != null);

    editor.run(
      () => {
        for (const shape of frameShapes) {
          editor.updateShape({
            id: shape.id,
            type: shape.id,
            meta: {
              ...shape.meta,
              hiddenDuringAnimation: true,
            },
          });
        }
      },
      { history: "ignore", ignoreShapeLock: true },
    );

    runFrames(editor, frames, predecessorShape ?? null).finally(() => {
      editor.run(
        () => {
          for (const shape of frameShapes) {
            editor.updateShape({
              id: shape.id,
              type: shape.id,
              meta: {
                ...shape.meta,
                hiddenDuringAnimation: false,
              },
            });
          }
        },
        { history: "ignore", ignoreShapeLock: true },
      );
    });
  });

  return true;
}
