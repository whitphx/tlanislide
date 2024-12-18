import { useEditor, track, stopEventPropagation } from "tldraw";
import {
  getGlobalFrames,
  $currentFrameIndex,
  $presentationMode,
  runFrame,
} from "./models";

export const FramesPanel = track(() => {
  const currentFrameIndex = $currentFrameIndex.get();

  const editor = useEditor();
  const frames = getGlobalFrames(editor);
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
      </div>
    </div>
  );
});
