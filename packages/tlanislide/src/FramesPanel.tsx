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
import styles from "./FramesPanel.module.scss";

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

  const handleKeyframeSelect = (keyframeId: string) => {
    const allShapes = editor.getCurrentPageShapes();
    const targetShapes = allShapes.filter(
      (shape) => getKeyframe(shape)?.id === keyframeId
    );
    editor.select(...targetShapes);
  };

  return (
    <div
      className={styles.panelContainer}
      // NOTE: pointerEvents: "all" and stopEventPropagation are needed to make this UI clickable on the tldraw app.
      style={{
        pointerEvents: "all",
      }}
      onPointerDown={(e) => stopEventPropagation(e)}
    >
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
        currentFrameIndex={currentFrameIndex}
        onFrameSelect={(i) => {
          $currentFrameIndex.set(i);
          runFrame(editor, frames[i]);
        }}
        selectedKeyframeIds={selectedKeyframeShapes.map(
          (kf) => getKeyframe(kf)!.id
        )}
        onKeyframeSelect={handleKeyframeSelect}
        requestKeyframeAddAfter={(prevKeyframe) => {
          const allShapes = editor.getCurrentPageShapes();
          const prevShape = allShapes.find(
            (shape) => getKeyframe(shape)?.id === prevKeyframe.id
          );
          if (prevShape == null) {
            return;
          }

          const newKeyframe = {
            id: uniqueId(),
            globalIndex: prevKeyframe.globalIndex + 1,
            localBefore: prevKeyframe.id,
            data: {
              duration: 1000,
            },
          } satisfies Keyframe<KeyframeData>;

          const newShapeId = createShapeId();

          editor.run(
            () => {
              editor.createShape({
                ...prevShape,
                id: newShapeId,
                x: prevShape.x + 100,
                y: prevShape.y + 100,
                meta: {
                  keyframe: keyframeToJsonObject(newKeyframe),
                },
              });
              editor.select(newShapeId);

              const newKeyframes = insertKeyframeLocalAfter(
                allKeyframes,
                newKeyframe
              );
              handleKeyframesChange(newKeyframes);
            },
            { history: "ignore" }
          );
        }}
      />
    </div>
  );
});
