import {
  useEditor,
  track,
  stopEventPropagation,
  createShapeId,
  uniqueId,
} from "tldraw";
import {
  getGlobalFrames,
  $currentFrameIndex,
  $presentationMode,
  runFrame,
  getKeyframe,
  attachKeyframe,
  KeyframeData,
  getAllKeyframes,
  keyframeToJsonObject,
} from "./models";
import { Keyframe } from "./keyframe";
import { KeyframeTimeline } from "./KeyframeTimeline";

export const FramesPanel = track(() => {
  const currentFrameIndex = $currentFrameIndex.get();

  const editor = useEditor();
  const frames = getGlobalFrames(editor);

  const allKeyframes = getAllKeyframes(editor);

  const selectedShapes = editor.getSelectedShapes();
  const keyframeShapes = selectedShapes.filter(
    (shape) => getKeyframe(shape) != null
  );
  const notKeyframeShapes = selectedShapes.filter(
    (shape) => getKeyframe(shape) == null
  );

  return (
    <div
      style={{
        pointerEvents: "all",
      }}
      onPointerDown={(e) => stopEventPropagation(e)}
    >
      <ol>
        {frames.map((frame, i) => {
          const isCurrent = i === currentFrameIndex;
          return (
            <li key={i}>
              {isCurrent ? (
                "*"
              ) : (
                <button
                  onClick={() => {
                    $currentFrameIndex.set(i);
                    runFrame(editor, frame);
                  }}
                >
                  [ ]
                </button>
              )}
              {JSON.stringify(frame)}
            </li>
          );
        })}
      </ol>
      <div>
        <label>
          Presentation Mode
          <input
            type="checkbox"
            checked={$presentationMode.get()}
            onChange={(e) => {
              $presentationMode.set(e.target.checked);
            }}
          />
        </label>

        {keyframeShapes.length > 0 && (
          <button
            onClick={() => {
              keyframeShapes.forEach((shape) => {
                const keyframe = getKeyframe(shape);
                if (keyframe == null) {
                  return;
                }

                // TODO: 現在のsuccessorのlocalBeforeをnewShapeIdに繋ぎかえる

                const newShapeId = createShapeId(uniqueId());
                const newKeyframe: Keyframe<KeyframeData> = {
                  id: newShapeId,
                  globalIndex: keyframe.globalIndex + 1,
                  localBefore: keyframe.id,
                  data: {},
                };

                editor.createShape({
                  ...shape,
                  id: newShapeId,
                  x: shape.x + 100,
                  y: shape.y + 100,
                  meta: {
                    keyframe: keyframeToJsonObject(newKeyframe),
                  },
                });
              });
            }}
          >
            Add next keyframe shape(s) to selected shape(s)
          </button>
        )}
        {notKeyframeShapes.length > 0 && (
          <button
            onClick={() => {
              notKeyframeShapes.forEach((shape) => {
                attachKeyframe(editor, shape.id);
              });
            }}
          >
            Attach keyframe(s) to selected shape(s)
          </button>
        )}
      </div>

      <KeyframeTimeline
        ks={allKeyframes}
        onKeyframesChange={(newKeyframes) => {
          const allShapes = editor.getCurrentPageShapes();

          const updateShapePartials = newKeyframes.map((newKeyframe) => {
            const shape = allShapes.find(
              (shape) => getKeyframe(shape)?.id === newKeyframe.id
            );
            if (shape == null) {
              return null;
            }

            return {
              ...shape,
              meta: {
                ...shape.meta,
                keyframe: keyframeToJsonObject(newKeyframe),
              },
            };
          });
          editor.updateShapes(updateShapePartials);
        }}
      />
    </div>
  );
});
