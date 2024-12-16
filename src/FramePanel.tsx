import { track, useEditor, stopEventPropagation } from "tldraw";
import {
  $currentFrameIndex,
  $presentationMode,
  AnimeDataMeta,
  runInitialFrame,
} from "./frame";
import { $presentationFlow, runFrame } from "./frame";
import { SlideShapeType } from "./SlideShapeUtil";
import { CAMERA_SEQUENCE_ID } from "./presentation-flow";

export const FramePanel = track(() => {
  const editor = useEditor();

  const frames = $presentationFlow.getFrames();

  const currentFrameIndex = $currentFrameIndex.get();
  return (
    <div
      style={{
        pointerEvents: "all",
      }}
      onPointerDown={(e) => stopEventPropagation(e)}
    >
      <ol>
        <li>
          <button
            onClick={() => {
              $currentFrameIndex.set("initial");
              runInitialFrame(editor);
            }}
            style={{
              fontWeight: currentFrameIndex === "initial" ? "bold" : "normal",
            }}
          >
            Initial state
          </button>
        </li>
        {frames.map((frame, i) => {
          const isCurrent = i === currentFrameIndex;

          return (
            <li
              key={i} // TODO: Use a unique key
            >
              <button
                onClick={() => {
                  $currentFrameIndex.set(i);
                  runFrame(editor, frame, { skipAnime: true });
                }}
                style={{
                  fontWeight: isCurrent ? "bold" : "normal",
                }}
              >
                Frame {i + 1}
              </button>
            </li>
          );
        })}
      </ol>
      <div>
        <button
          onClick={() => {
            const selectedShapes = editor
              .getSelectedShapes()
              .filter(
                (shape) =>
                  shape.type !== SlideShapeType && shape.meta?.anime == null
              );
            selectedShapes.forEach((shape) => {
              $presentationFlow.addShapeSequence(shape);
            });
            editor.deleteShapes(selectedShapes);
          }}
        >
          Animate the selected shape
        </button>
        <button
          onClick={() => {
            const selectedShapes = editor.getSelectedShapes();
            selectedShapes.forEach((shape) => {
              const animeMeta = shape.meta?.anime as
                | AnimeDataMeta["anime"]
                | undefined;
              if (animeMeta == null) {
                console.warn("Shape is not animated");
                return;
              }

              const newShape = { ...shape, x: shape.x + 100, y: shape.y + 100 };
              $presentationFlow.pushStep(animeMeta.sequenceId, {
                type: "shape",
                shape: newShape,
                animateShapeOpts: {
                  animation: {
                    duration: 1000,
                  },
                },
              });
            });
          }}
        >
          Add new animation to the selected shape
        </button>
        <button
          onClick={() => {
            const selectedSlideShapes = editor
              .getSelectedShapes()
              .filter((shape) => shape.type === SlideShapeType);
            selectedSlideShapes.forEach((slideShape) => {
              $presentationFlow.pushStep(CAMERA_SEQUENCE_ID, {
                type: "camera",
                shapeId: slideShape.id,
                zoomToBoundsParams: {
                  animation: {
                    duration: 1000,
                  },
                },
              });
            });
          }}
        >
          Add the selected slide as a new frame
        </button>
        <label>
          Presentation mode
          <input
            type="checkbox"
            checked={$presentationMode.get()}
            onChange={(e) => {
              $presentationMode.set(e.target.checked);
              if (currentFrameIndex === "initial") {
                runInitialFrame(editor);
              } else {
                runFrame(editor, frames[currentFrameIndex]);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
});
