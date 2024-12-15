import { track, useEditor, stopEventPropagation } from "tldraw";
import { $currentFrameIndex } from "./frame";
import { $presentationFlow, runFrame } from "./frame";

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
    </div>
  );
});
