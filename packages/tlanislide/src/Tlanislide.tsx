import {
  Tldraw,
  useIsToolSelected,
  useTools,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  computed,
  uniqueId,
  react,
  track,
  useAtom,
  useValue,
} from "tldraw";
import type {
  TLUiOverrides,
  TLComponents,
  Editor,
  TLShape,
  TldrawProps,
  TLStoreSnapshot,
  TLEditorSnapshot,
} from "tldraw";
import "tldraw/tldraw.css";

import { SlideShapeType, SlideShapeUtil } from "./SlideShapeUtil";
import { SlideShapeTool } from "./SlideShapeTool";
import { makeControlPanel } from "./ControlPanel";
import { ReadonlyOverlay } from "./ReadonlyOverlay";
import { createModeAwareDefaultComponents } from "./mode-aware-components";
import {
  getOrderedSteps,
  runStep,
  cueFrameToJsonObject,
  getFrame,
  getAllFrames,
  getNextGlobalIndex,
  type CameraZoomFrameAction,
  type CueFrame,
  type SubFrame,
  reconcileShapeDeletion,
} from "./models";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

const customShapeUtils = [SlideShapeUtil];
const customTools = [SlideShapeTool];

// We use atoms as it's Tldraw's design,
// but we also need to manage these states per instance of Tlanislide component
// and isolate different instances from each other.
// This hook is used to create such per-instance atoms.
function usePerInstanceAtoms() {
  const $stepHotkeyEnabled = useAtom("steps hotkeys are enabled", true);
  const $presentationModeHotkeyEnabled = useAtom(
    "presentation mode hotkey is enabled",
    true,
  );
  const $presentationMode = useAtom<boolean>("presentation mode", false);
  const $currentStepIndex = useAtom<number>("current step index", 0);

  return useMemo(() => {
    return {
      $stepHotkeyEnabled,
      $presentationModeHotkeyEnabled,
      $presentationMode,
      $currentStepIndex,
    };
  }, [
    $stepHotkeyEnabled,
    $presentationModeHotkeyEnabled,
    $presentationMode,
    $currentStepIndex,
  ]);
}
type PerInstanceAtoms = ReturnType<typeof usePerInstanceAtoms>;

const makeUiOverrides = ({
  $stepHotkeyEnabled,
  $presentationModeHotkeyEnabled,
  $currentStepIndex,
  $presentationMode,
}: PerInstanceAtoms): TLUiOverrides => {
  return {
    actions(editor, actions) {
      const $steps = computed("ordered steps", () => getOrderedSteps(editor));

      actions["next-step"] = {
        id: "next-step",
        label: "Next Step",
        kbd: "right",
        onSelect() {
          if (!$stepHotkeyEnabled.get()) {
            return;
          }

          const steps = $steps.get();
          const currentStepIndex = $currentStepIndex.get();

          const nextStepIndex = currentStepIndex + 1;
          const res = runStep(editor, steps, nextStepIndex);
          if (!res) {
            return;
          }
          $currentStepIndex.set(nextStepIndex);
        },
      };

      actions["prev-step"] = {
        id: "prev-step",
        label: "Previous Step",
        kbd: "left",
        onSelect() {
          if (!$stepHotkeyEnabled.get()) {
            return;
          }

          const steps = $steps.get();
          const currentStepIndex = $currentStepIndex.get();

          const prevStepIndex = currentStepIndex - 1;
          const res = runStep(editor, steps, prevStepIndex);
          if (!res) {
            return;
          }
          $currentStepIndex.set(prevStepIndex);
        },
      };

      actions["toggle-presentation-mode"] = {
        id: "toggle-presentation-mode",
        label: "Toggle Presentation Mode",
        kbd: "p",
        onSelect() {
          if (!$presentationModeHotkeyEnabled.get()) {
            return;
          }

          $presentationMode.set(!$presentationMode.get());
        },
      };

      actions["exit-presentation-mode"] = {
        id: "exit-presentation-mode",
        label: "Exit Presentation Mode",
        kbd: "esc",
        onSelect() {
          if (!$presentationModeHotkeyEnabled.get()) {
            return;
          }

          // Only exit if we're already in presentation mode
          if ($presentationMode.get()) {
            $presentationMode.set(false);
          }
        },
      };

      return actions;
    },
    tools(editor, tools) {
      tools.slide = {
        id: SlideShapeTool.id,
        icon: "group",
        label: "Slide",
        kbd: "s",
        onSelect: () => editor.setCurrentTool(SlideShapeTool.id),
      };
      return tools;
    },
  };
};

const createComponents = ({
  $currentStepIndex,
  $presentationMode,
}: PerInstanceAtoms): TLComponents => {
  return {
    TopPanel: makeControlPanel({
      $currentStepIndex,
      $presentationMode,
    }),
    Toolbar: (props) => {
      const presentationMode = useValue($presentationMode);
      const tools = useTools();
      const isSlideToolSelected = useIsToolSelected(tools[SlideShapeTool.id]);
      return (
        !presentationMode && (
          <DefaultToolbar {...props}>
            <TldrawUiMenuItem
              {...tools[SlideShapeTool.id]}
              isSelected={isSlideToolSelected}
            />
            <DefaultToolbarContent />
          </DefaultToolbar>
        )
      );
    },
    KeyboardShortcutsDialog: (props) => {
      const tools = useTools();
      return (
        <DefaultKeyboardShortcutsDialog {...props}>
          <TldrawUiMenuItem {...tools[SlideShapeTool.id]} />
          <DefaultKeyboardShortcutsDialogContent />
        </DefaultKeyboardShortcutsDialog>
      );
    },
  };
};

interface InnerProps {
  onMount: TldrawProps["onMount"];
  snapshot?: TLEditorSnapshot | TLStoreSnapshot;
  perInstanceAtoms: PerInstanceAtoms;
}
const Inner = track((props: InnerProps) => {
  const { onMount, snapshot, perInstanceAtoms } = props;

  const handleMount = (editor: Editor) => {
    const stopHandlers: (() => void)[] = [];

    stopHandlers.push(
      editor.sideEffects.registerBeforeCreateHandler("shape", (shape) => {
        if (shape.type === SlideShapeType && shape.meta?.frame == null) {
          // Auto attach camera cueFrame to the newly created slide shape
          const orderedSteps = getOrderedSteps(editor);
          const lastCameraCueFrame = orderedSteps
            .reverse()
            .flat()
            .find((ab) => ab.data[0].action.type === "cameraZoom");
          const cueFrame: CueFrame<CameraZoomFrameAction> = {
            id: uniqueId(),
            type: "cue",
            globalIndex: orderedSteps.length,
            trackId: lastCameraCueFrame
              ? lastCameraCueFrame.trackId
              : uniqueId(),
            action: {
              type: "cameraZoom",
              duration: lastCameraCueFrame ? 1000 : 0,
            },
          };
          return {
            ...shape,
            meta: {
              ...shape.meta,
              frame: cueFrameToJsonObject(cueFrame),
            },
          };
        } else {
          // If the shape contains a frame, ensure that the frame is unique.
          // This is necessary e.g. when a shape is duplicated, the frame should not be duplicated.
          const frame = getFrame(shape);
          if (frame == null) {
            return shape;
          }

          const allFrames = getAllFrames(editor);
          const allFrameIds = allFrames.map((frame) => frame.id);
          if (allFrameIds.includes(frame.id)) {
            if (frame.type === "cue") {
              shape.meta.frame = {
                ...frame,
                id: uniqueId(),
                globalIndex: getNextGlobalIndex(editor),
              } satisfies CueFrame;
            } else if (frame.type === "sub") {
              shape.meta.frame = {
                ...frame,
                id: uniqueId(),
                prevFrameId: frame.id,
              } satisfies SubFrame;
            }
          }
          return shape;
        }
      }),
    );
    stopHandlers.push(
      editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
        reconcileShapeDeletion(editor, shape);
      }),
    );

    onMount?.(editor);

    return () => {
      stopHandlers.forEach((stopHandler) => stopHandler());
      editor.dispose();
    };
  };

  const determineShapeHidden = (shape: TLShape, editor: Editor): boolean => {
    const presentationMode = perInstanceAtoms.$presentationMode.get();
    const editMode = !presentationMode;
    const HIDDEN = true;
    const SHOW = false;
    if (editMode) {
      return SHOW;
    }

    if (shape.type === SlideShapeType) {
      return HIDDEN;
    }

    if (shape.meta?.hiddenDuringAnimation) {
      return HIDDEN;
    }

    const frame = getFrame(shape);
    if (frame == null) {
      // No animation frame is attached to this shape, so it should always be visible
      return SHOW;
    }

    const orderedSteps = getOrderedSteps(editor); // TODO: Cache
    const currentStepIndex = perInstanceAtoms.$currentStepIndex.get();

    // The last frame of a finished animation should always be visible
    if (frame.type === "cue") {
      const cueFrame = frame;
      const isFuture = cueFrame.globalIndex > currentStepIndex;
      if (isFuture) {
        return HIDDEN;
      }

      const lastBatchIncludingThisTrack = orderedSteps
        .slice(0, currentStepIndex + 1)
        .reverse()
        .flat()
        .find((ab) => ab.trackId === cueFrame.trackId);
      const isLatestPrevInTrack =
        lastBatchIncludingThisTrack &&
        lastBatchIncludingThisTrack.data.findIndex(
          (frame) => frame.id === cueFrame.id,
        ) ===
          lastBatchIncludingThisTrack.data.length - 1;
      if (isLatestPrevInTrack) {
        return SHOW;
      }
    } else if (frame.type === "sub") {
      const subFrame = frame;
      const thisBatch = orderedSteps
        .flat()
        .find((ab) => ab.data.some((frame) => frame.id === subFrame.id));
      if (thisBatch == null) {
        // This should never happen, but just in case
        return HIDDEN;
      }

      const isFuture = thisBatch.globalIndex > currentStepIndex;
      if (isFuture) {
        return HIDDEN;
      }

      const lastBatchIncludingThisTrack = orderedSteps
        .slice(0, currentStepIndex + 1)
        .reverse()
        .flat()
        .find((ab) => ab.trackId === thisBatch.trackId);
      const isLatestPrevInTrack =
        lastBatchIncludingThisTrack &&
        lastBatchIncludingThisTrack.data.findIndex(
          (frame) => frame.id === subFrame.id,
        ) ===
          lastBatchIncludingThisTrack.data.length - 1;
      if (isLatestPrevInTrack) {
        return SHOW;
      }
    }

    return HIDDEN;
  };

  return (
    <Tldraw
      onMount={handleMount}
      components={{
        ...createModeAwareDefaultComponents(perInstanceAtoms.$presentationMode),
        ...createComponents(perInstanceAtoms),
      }}
      overrides={makeUiOverrides(perInstanceAtoms)}
      shapeUtils={customShapeUtils}
      tools={customTools}
      isShapeHidden={determineShapeHidden}
      options={{
        maxPages: 1,
      }}
      snapshot={snapshot}
    >
      <ReadonlyOverlay // Prevent interactions with shapes in presentation mode. Tldraw's `readOnly` option is not used because it allows some ops like selecting shapes or editing text.
        $presentationMode={perInstanceAtoms.$presentationMode}
      />
    </Tldraw>
  );
});

// IMPORTANT: Memoization is necessary to prevent re-rendering of the entire Tldraw component tree and recreating the editor instance when the most outer `Tlanislide` component's props change, which typically happens when the current frame index changes in the parent component.
const MemoizedInner = React.memo(Inner);

export interface TlanislideProps {
  step?: number;
  onStepChange?: (newStep: number) => void;
  presentationMode?: boolean;
  onMount?: InnerProps["onMount"];
  snapshot?: InnerProps["snapshot"];
  startStep?: number;
}
export interface TlanislideRef {
  rerunStep: () => void;
}
export const Tlanislide = React.forwardRef<TlanislideRef, TlanislideProps>(
  (props, ref) => {
    const {
      step,
      onStepChange,
      presentationMode,
      onMount,
      snapshot,
      startStep = 0,
    } = props;

    const tlanislideAtoms = usePerInstanceAtoms();
    const {
      $currentStepIndex,
      $presentationMode,
      $stepHotkeyEnabled,
      $presentationModeHotkeyEnabled,
    } = tlanislideAtoms;

    useEffect(() => {
      $stepHotkeyEnabled.set(step == null);
    }, [$stepHotkeyEnabled, step]);
    useEffect(() => {
      $presentationModeHotkeyEnabled.set(presentationMode == null);
    }, [$presentationModeHotkeyEnabled, presentationMode]);

    const editorRef = useRef<Editor | null>(null);

    const handleMount = useCallback(
      (editor: Editor) => {
        const targetStep = (step ?? 0) + startStep;
        if ($presentationMode.get()) {
          const orderedSteps = getOrderedSteps(editor);
          const res = runStep(editor, orderedSteps, targetStep);
          if (res) {
            $currentStepIndex.set(targetStep);
          }
        }

        editorRef.current = editor;
        onMount?.(editor);
      },
      [step, startStep, onMount, $presentationMode, $currentStepIndex],
    );

    useEffect(() => {
      if (presentationMode != null) {
        $presentationMode.set(presentationMode);
      }
    }, [$presentationMode, presentationMode]);

    useEffect(() => {
      if (step == null) {
        return;
      }
      if ($currentStepIndex.get() === step) {
        return;
      }

      const editor = editorRef.current;
      if (editor == null) {
        return;
      }

      const targetStep = step + startStep;
      const orderedSteps = getOrderedSteps(editor);
      const res = runStep(editor, orderedSteps, targetStep);
      if (res) {
        $currentStepIndex.set(targetStep);
      }
    }, [$currentStepIndex, step, startStep]);
    useEffect(() => {
      if (onStepChange == null) {
        return;
      }

      return react(
        "current frame index to call onCurrentStepIndexChange",
        () => {
          onStepChange($currentStepIndex.get());
        },
      );
    }, [$currentStepIndex, onStepChange]);

    useImperativeHandle(ref, () => ({
      rerunStep: () => {
        if (editorRef.current == null) {
          return;
        }
        runStep(
          editorRef.current,
          getOrderedSteps(editorRef.current),
          $currentStepIndex.get(),
        );
      },
    }));

    return (
      <MemoizedInner
        onMount={handleMount}
        perInstanceAtoms={tlanislideAtoms}
        snapshot={snapshot}
      />
    );
  },
);
Tlanislide.displayName = "Tlanislide";
