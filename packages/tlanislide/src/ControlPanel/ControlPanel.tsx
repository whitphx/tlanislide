import {
  useEditor,
  track,
  stopEventPropagation,
  createShapeId,
  uniqueId,
  type Atom,
} from "tldraw";
import {
  getOrderedSteps,
  runStep,
  getKeyframe,
  attachKeyframe,
  keyframeToJsonObject,
  type Keyframe,
  FrameBatch,
  getFramesFromFrameBatches,
  getFrame,
  frameToJsonObject,
  getFrameBatches,
  getAllFrames,
  Frame,
} from "../models";
import { insertOrderedTrackItem } from "../ordered-track-item";
import { KeyframeTimeline } from "../KeyframeTimeline";
import styles from "./ControlPanel.module.scss";
import { SlideShapeType } from "../SlideShapeUtil";

export function makeControlPanel(atoms: {
  $currentStepIndex: Atom<number>;
  $presentationMode: Atom<boolean>;
}) {
  const ControlPanel = track(() => {
    const { $currentStepIndex, $presentationMode } = atoms;

    const currentStepIndex = $currentStepIndex.get();

    const editor = useEditor();
    const steps = getOrderedSteps(editor);

    const frames = getAllFrames(editor);
    const frameBatches = getFrameBatches(frames);

    const selectedShapes = editor.getSelectedShapes();
    const selectedFrameShapes = selectedShapes.filter(
      (shape) => getFrame(shape) != null,
    );
    const selectedNotFrameShapes = selectedShapes.filter(
      (shape) => getFrame(shape) == null && shape.type !== SlideShapeType,
    );

    const handleFrameChange = (newFrame: Frame) => {
      const shape = editor
        .getCurrentPageShapes()
        .find((shape) => getFrame(shape)?.id === newFrame.id);
      if (shape == null) {
        return;
      }

      editor.updateShape({
        ...shape,
        meta: {
          frame: frameToJsonObject(newFrame),
        },
      });
    };

    const handleFrameBatchesChange = (newFrameBatches: FrameBatch[]) => {
      const newFrames = getFramesFromFrameBatches(newFrameBatches);

      const allShapes = editor.getCurrentPageShapes();

      const updateShapePartials = allShapes.map((shape) => {
        const newFrame = newFrames.find(
          (newFrame) => newFrame.id === getFrame(shape)?.id,
        );
        if (newFrame == null) {
          return {
            ...shape,
            meta: {
              ...shape.meta,
              frame: undefined,
            },
          };
        }

        return {
          ...shape,
          meta: {
            ...shape.meta,
            frame: frameToJsonObject(newFrame),
          },
        };
      });

      editor.updateShapes(updateShapePartials);
    };

    const handleFrameSelect = (frameId: string) => {
      const allShapes = editor.getCurrentPageShapes();
      const targetShapes = allShapes.filter(
        (shape) => getFrame(shape)?.id === frameId,
      );
      editor.select(...targetShapes);
    };

    if ($presentationMode.get()) {
      return null;
    }

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
          frameBatches={frameBatches}
          onFrameBatchesChange={handleFrameBatchesChange}
          onFrameChange={handleFrameChange}
          currentStepIndex={currentStepIndex}
          onStepSelect={(i) => {
            const res = runStep(editor, steps, i);
            if (res) {
              $currentStepIndex.set(i);
            }
          }}
          selectedFrameIds={selectedFrameShapes.map(
            (shape) => getFrame(shape)!.id,
          )}
          onFrameSelect={handleFrameSelect}
          showAttachKeyframeButton={selectedNotFrameShapes.length > 0}
          requestAttachKeyframe={() => {
            selectedNotFrameShapes.forEach((shape) => {
              if (shape.type !== SlideShapeType) {
                attachKeyframe(editor, shape.id, { type: "shapeAnimation" });
              }
            });
          }}
          requestKeyframeAddAfter={(prevKeyframe) => {
            const allShapes = editor.getCurrentPageShapes();
            const prevShape = allShapes.find(
              (shape) => getKeyframe(shape)?.id === prevKeyframe.id,
            );
            if (prevShape == null) {
              return;
            }

            const newKeyframe = {
              id: uniqueId(),
              type: "keyframe",
              globalIndex: 0, // NOTE: This will be recalculated later.
              trackId: prevKeyframe.trackId,
              data: {
                type: prevKeyframe.data.type,
                duration: 1000,
              },
            } satisfies Keyframe;
            const newFrameBatch: FrameBatch = {
              id: newKeyframe.id,
              globalIndex: newKeyframe.globalIndex,
              trackId: newKeyframe.trackId,
              data: [newKeyframe],
            };

            const newShapeId = createShapeId();

            editor.run(
              () => {
                editor.createShape({
                  ...prevShape,
                  id: newShapeId,
                  x: prevShape.x + 100,
                  y: prevShape.y + 100,
                  meta: {
                    frame: keyframeToJsonObject(newKeyframe),
                  },
                });
                editor.select(newShapeId);

                const newFrameBatches = insertOrderedTrackItem(
                  frameBatches,
                  newFrameBatch,
                  prevKeyframe.globalIndex + 1,
                );
                handleFrameBatchesChange(newFrameBatches);
              },
              { history: "ignore" },
            );
          }}
        />
      </div>
    );
  });

  return ControlPanel;
}
