import { track, useEditor, stopEventPropagation } from "tldraw";
import { $currentFrameIndex } from "./frame";
import { $presentationFlow } from "./frame";

export const FramePanel = track(() => {
  const editor = useEditor();
  const selectedShapes = editor.getSelectedShapes();
  const selectedShapeIds = selectedShapes.map((shape) => shape.id);

  const frames = $presentationFlow.getFrames();

  const currentFrameIndex = $currentFrameIndex.get();
  return (
    <div
      style={{
        pointerEvents: "all",
      }}
      onPointerDown={(e) => stopEventPropagation(e)}
    >
      {frames.map((frameSteps, i) => {
        const shapeIds = frameSteps.map((step) => step.shapeId);
        const isSelected = shapeIds.some((shapeId) =>
          selectedShapeIds.includes(shapeId)
        );

        const isCurrent = i === currentFrameIndex;

        return (
          <button
            key={i} // TODO: Use a unique key
            onClick={() => {
              $currentFrameIndex.set(i);
              const cameraStep = frameSteps.find(
                (step) => step.type === "camera"
              );
              if (cameraStep) {
                const bounds = editor.getShapePageBounds(cameraStep.shapeId);
                if (!bounds) {
                  return;
                }

                editor.zoomToBounds(bounds, cameraStep.zoomToBoundsParams);
              }
            }}
            style={{
              color: isSelected ? "red" : "black",
              fontWeight: isCurrent ? "bold" : "normal",
            }}
          >
            Frame {i + 1}
          </button>
        );
      })}
    </div>
  );
});
