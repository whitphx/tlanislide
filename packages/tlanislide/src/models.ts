import { EASINGS, atom, createShapeId, uniqueId } from "tldraw";
import type { Editor, JsonObject, TLShape, TLShapeId } from "tldraw";
import { addGlobalEqual, addGlobalLess, addLocalRelation, createKeyframe, getGlobalOrder, Keyframe } from "./keyframe";

export const $presentationMode = atom<boolean>("presentation mode", false);

export const $currentFrameIndex = atom<number>("current frame index", 0);

export interface KeyframeData extends JsonObject {
  duration?: number;
  easing?: keyof typeof EASINGS;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keyframe -> JsonObject
export function keyframeToJsonObject<T extends JsonObject>(kf: Keyframe<T>): JsonObject {
  const { id, ufParentId, ufRank, globalAfterEqClasses, localBefore, data } = kf;
  const obj = { id, ufParentId, ufRank, globalAfterEqClasses, localBefore, data } satisfies JsonObject;
  return obj;
}

// unknown -> Keyframe<JsonObject>
function isKeyframe(obj: unknown): obj is Keyframe<JsonObject> {
  if (
    typeof obj === 'object' && obj !== null &&
    !Array.isArray(obj)
  ) {
    const o = obj as { [key: string]: unknown };
    return (
      typeof o.id === 'string' &&
      typeof o.ufParentId === 'string' &&
      typeof o.ufRank === 'number' &&
      Array.isArray(o.globalAfterEqClasses) && o.globalAfterEqClasses.every(v => typeof v === 'string') &&
      (o.localBefore === null || typeof o.localBefore === 'string') &&
      typeof o.data === 'object' && o.data !== null && !Array.isArray(o.data)
    );
  }
  return false;
}

// JsonObject -> Keyframe<T>
export function jsonObjectToKeyframe<T extends JsonObject>(
  obj: unknown,
  validateData?: (data: JsonObject) => data is T
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
  throw new Error("Given input is not a valid Keyframe.");
}

export function attachKeyframe(editor: Editor, shapeId: TLShapeId, keyframeData: KeyframeData = {}) {
  const keyframe = createKeyframe<KeyframeData>(shapeId, keyframeData);

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
  })
}

export function getKeyframe(shape: TLShape): Keyframe | undefined {
  return isJsonObject(shape.meta.keyframe) ? jsonObjectToKeyframe(shape.meta.keyframe) : undefined;
}

export function getAllKeyframes(editor: Editor): Keyframe[] {
  const shapes = editor.getCurrentPageShapes();
  return shapes.map(getKeyframe).filter((keyframe) => keyframe != null);
}

export function getGlobalFrames(editor: Editor): Keyframe[][] {
  const keyframes = getAllKeyframes(editor);
  return getGlobalOrder(keyframes);
}

function manipulateKeyframes(editor: Editor, manipulator: (keyframes: Keyframe[]) => Keyframe[]) {
  // TODO: 現在、全てのShapeからキーフレームの集合を取り出し、その集合に対して操作をし、結果を書き戻している。必要なShapeだけに絞る。
  const allShapes = editor.getCurrentPageShapes();
  const keyframes = allShapes.map(getKeyframe).filter((keyframe) => keyframe != null);

  const newKeyframes = manipulator(keyframes);

  const updateShapePartials = newKeyframes.map((newKeyframe) => {
    const shape = allShapes.find((shape) => getKeyframe(shape)?.id === newKeyframe.id);
    if (shape == null) {
      return null;
    }

    return {
      ...shape,
      meta: {
        ...shape.meta,
        keyframe: keyframeToJsonObject(newKeyframe),
      },
    }
  });
  editor.updateShapes(updateShapePartials);
}

export function addTrackRelation(editor: Editor, shapeId: TLShapeId, successorShapeId: TLShapeId) {
  // TODO: 現在、全てのShapeからキーフレームの集合を取り出し、その集合に対して操作をし、結果を書き戻している。必要なShapeだけに絞る。
  manipulateKeyframes(editor, (keyframes) => addLocalRelation(keyframes, shapeId, successorShapeId));
}

export function addSimultaneousFrameRelation(editor: Editor, shapeId: TLShapeId, simultaneousShapeId: TLShapeId) {
  // TODO: 現在、全てのShapeからキーフレームの集合を取り出し、その集合に対して操作をし、結果を書き戻している。必要なShapeだけに絞る。
  manipulateKeyframes(editor, (keyframes) => addGlobalEqual(keyframes, shapeId, simultaneousShapeId));
}

export function addFrameRelation(editor: Editor, earlierShapeId: TLShapeId, laterShapeId: TLShapeId) {
  // TODO: 現在、全てのShapeからキーフレームの集合を取り出し、その集合に対して操作をし、結果を書き戻している。必要なShapeだけに絞る。
  manipulateKeyframes(editor, (keyframes) => addGlobalLess(keyframes, earlierShapeId, laterShapeId));
}

export function runFrame(editor: Editor, globalFrame: Keyframe<KeyframeData>[]) {
  const keyframes = getAllKeyframes(editor);

  globalFrame.forEach((keyframe) => {
    const predecessorKeyframeId = keyframe.localBefore;
    if (predecessorKeyframeId == null) {
      return;
    }
    const predecessorKeyframe = keyframes.find((keyframe) => keyframe.id === predecessorKeyframeId);
    if (predecessorKeyframe == null) {
      return;
    }

    const shape = editor.getShape(keyframe.id as TLShapeId);  // TODO: ShapeIdとKeyframe.idを別にする？
    const predecessorShape = editor.getShape(predecessorKeyframe.id as TLShapeId);
    if (shape == null || predecessorShape == null) {
      return;
    }

    editor.updateShape({
      id: shape.id,
      type: shape.id,
      meta: {
        ...shape.meta,
        hiddenDuringAnimation: true,
      }
    })

    const { duration = 0, easing = "easeInCubic" } = keyframe.data;
    const immediate = duration === 0;

    // Create and manipulate a temporary shape for animation
    const animeShapeId = createShapeId(uniqueId());
    editor.createShape({
      ...predecessorShape,
      id: animeShapeId,
      type: shape.type,
      meta: undefined,
    });
    editor.animateShape({
      ...shape,
      id: animeShapeId,
      meta: undefined,
    }, {
      immediate,
      animation: {
        duration,
        easing: EASINGS[easing],
      }
    });
    setTimeout(() => {
      editor.deleteShape(animeShapeId);

      editor.updateShape({
        id: shape.id,
        type: shape.id,
        meta: {
          ...shape.meta,
          hiddenDuringAnimation: false,
        }
      })
    }, duration);
  });
}
