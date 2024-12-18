import { type Editor, type TLShape, type TLShapeId, atom, createShapeId, uniqueId } from "tldraw";
import { addGlobalEqual, addGlobalLess, addLocalRelation, createKeyframe, getGlobalOrder, getLocalPredecessors, Keyframe } from "./keyframe";

export const $presentationMode = atom<boolean>("presentation mode", false);

export const $currentFrameIndex = atom<number>("current frame index", 0);

export function attachKeyframe(editor: Editor, shapeId: TLShapeId) {
  const keyframe = createKeyframe(shapeId);

  const shape = editor.getShape(shapeId);
  if (shape == null) {
    return;
  }
  editor.updateShape({
    id: shapeId,
    type: shape.type,
    meta: {
      keyframe,
    },
  })
}

export function getKeyframe(shape: TLShape): Keyframe | undefined {
  return shape.meta.keyframe as Keyframe;
}

export function getGlobalFrames(editor: Editor): Keyframe[][] {
  const shapes = editor.getCurrentPageShapes();
  const keyframes = shapes.map(getKeyframe).filter((keyframe) => keyframe != null);
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
        keyframe: newKeyframe,
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

export function runFrame(editor: Editor, globalFrame: Keyframe[]) {
  const allShapes = editor.getCurrentPageShapes();
  const keyframes = allShapes.map(getKeyframe).filter((keyframe) => keyframe != null);

  globalFrame.forEach((keyframe) => {
    const predecessorKeyframeIds = getLocalPredecessors(keyframes, keyframe.id);  // TODO: 1つに制約する
    const predecessorKeyframeId = predecessorKeyframeIds[0];
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

    const duration = 1000;  // TODO: Make configurable

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
      animation: {
        duration,
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
