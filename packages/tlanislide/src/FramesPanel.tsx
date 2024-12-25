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
import { insertKeyframeLocalAfter, Keyframe } from "./keyframe";
import { KeyframeTimeline } from "./KeyframeTimeline";

export const FramesPanel = track(() => {
  const currentFrameIndex = $currentFrameIndex.get();

  const editor = useEditor();
  const frames = getGlobalFrames(editor);

  const allKeyframes = getAllKeyframes(editor);

  const selectedShapes = editor.getSelectedShapes();
  const selectedKeyframeShapes = selectedShapes.filter(
    (shape) => getKeyframe(shape) != null
  );
  const selectedNotKeyframeShapes = selectedShapes.filter(
    (shape) => getKeyframe(shape) == null
  );

  const handleKeyframesChange = (newKeyframes: Keyframe<KeyframeData>[]) => {
    const allShapes = editor.getCurrentPageShapes();

    const updateShapePartials = allShapes.map((shape) => {
      const newKeyframe = newKeyframes.find(
        (kf) => kf.id === getKeyframe(shape)?.id
      );
      if (newKeyframe == null) {
        return {
          ...shape,
          meta: {
            ...shape.meta,
            keyframe: undefined,
          },
        };
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
  };

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

        {selectedKeyframeShapes.length > 0 && (
          <button
            onClick={() => {
              let newKeyframes = allKeyframes;

              editor.run(
                () => {
                  selectedKeyframeShapes.forEach((shape) => {
                    const keyframe = getKeyframe(shape);
                    if (keyframe == null) {
                      return;
                    }

                    const newKeyframe = {
                      id: uniqueId(),
                      globalIndex: keyframe.globalIndex + 1,
                      localBefore: keyframe.id,
                      data: {
                        duration: 1000,
                      },
                    } satisfies Keyframe<KeyframeData>;
                    newKeyframes = insertKeyframeLocalAfter(
                      newKeyframes,
                      newKeyframe
                    );

                    editor.createShape({
                      ...shape,
                      id: createShapeId(),
                      x: shape.x + 100,
                      y: shape.y + 100,
                      meta: {
                        keyframe: keyframeToJsonObject(newKeyframe),
                      },
                    });
                  });

                  handleKeyframesChange(newKeyframes);
                },
                { history: "ignore" }
              );
            }}
          >
            Add next keyframe shape(s) to selected shape(s)
          </button>
        )}
        {selectedNotKeyframeShapes.length > 0 && (
          <button
            onClick={() => {
              selectedNotKeyframeShapes.forEach((shape) => {
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
        onKeyframesChange={handleKeyframesChange}
      />
    </div>
  );
});
