import {
  useEditor,
  track,
  stopEventPropagation,
  createShapeId,
  uniqueId,
} from "tldraw";
import {
  getOrderedSteps,
  $currentStepIndex,
  $presentationMode,
  runStep,
  getKeyframe,
  attachKeyframe,
  KeyframeData,
  getAllKeyframes,
  keyframeToJsonObject,
} from "./models";
import { insertKeyframe, Keyframe } from "./keyframe";
import { KeyframeTimeline } from "./KeyframeTimeline";
import styles from "./FramesPanel.module.scss";
import { SlideShapeType } from "./SlideShapeUtil";

export const FramesPanel = track(() => {
  const currentStepIndex = $currentStepIndex.get();

  const editor = useEditor();
  const steps = getOrderedSteps(editor);

  const allKeyframes = getAllKeyframes(editor);

  const selectedShapes = editor.getSelectedShapes();
  const selectedKeyframeShapes = selectedShapes.filter(
    (shape) => getKeyframe(shape) != null
  );
  const selectedNotKeyframeShapes = selectedShapes.filter(
    (shape) => getKeyframe(shape) == null && shape.type !== SlideShapeType
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
      </div>

      <KeyframeTimeline
        ks={allKeyframes}
        onKeyframesChange={handleKeyframesChange}
        currentStepIndex={currentStepIndex}
        onStepSelect={(i) => {
          const res = runStep(editor, steps, i);
          if (res) {
            $currentStepIndex.set(i);
          }
        }}
        selectedKeyframeIds={selectedKeyframeShapes.map(
          (kf) => getKeyframe(kf)!.id
        )}
        onKeyframeSelect={handleKeyframeSelect}
        showAttachKeyframeButton={selectedNotKeyframeShapes.length > 0}
        requestAttachKeyframe={() => {
          selectedNotKeyframeShapes.forEach((shape) => {
            if (shape.type !== SlideShapeType) {
              attachKeyframe(editor, shape.id, { type: "shapeAnimation" });
            }
          });
        }}
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
            globalIndex: 0, // NOTE: This will be recalculated later.
            trackId: prevKeyframe.trackId,
            data: {
              type: prevKeyframe.data.type,
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

              const newKeyframes = insertKeyframe(
                allKeyframes,
                newKeyframe,
                prevKeyframe.globalIndex + 1
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
