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
import {
  getOrderedSteps,
  getKeyframe,
  runStep,
  getAllKeyframes,
  detatchKeyframe,
  CameraZoomKeyframeData,
  keyframeToJsonObject,
} from "./models";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Keyframe } from "./keyframe";

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
  const $startStepIndex = useAtom<number>("start step index", 0);

  return useMemo(() => {
    return {
      $stepHotkeyEnabled,
      $presentationModeHotkeyEnabled,
      $presentationMode,
      $currentStepIndex,
      $startStepIndex,
    };
  }, [
    $stepHotkeyEnabled,
    $presentationModeHotkeyEnabled,
    $presentationMode,
    $currentStepIndex,
    $startStepIndex,
  ]);
}
type PerInstanceAtoms = ReturnType<typeof usePerInstanceAtoms>;

const makeUiOverrides = ({
  $stepHotkeyEnabled,
  $presentationModeHotkeyEnabled,
  $currentStepIndex,
  $startStepIndex,
  $presentationMode,
}: PerInstanceAtoms): TLUiOverrides => {
  return {
    actions(editor, actions) {
      const $steps = computed("ordered steps", () =>
        getOrderedSteps(editor, $startStepIndex.get()),
      );

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

const makeComponents = ({
  $currentStepIndex,
  $presentationMode,
  $startStepIndex,
}: PerInstanceAtoms): TLComponents => {
  return {
    TopPanel: makeControlPanel({
      $currentStepIndex,
      $presentationMode,
      $startStepIndex,
    }),
    Toolbar: (props) => {
      const tools = useTools();
      const isSlideToolSelected = useIsToolSelected(tools[SlideShapeTool.id]);
      return (
        <DefaultToolbar {...props}>
          <TldrawUiMenuItem
            {...tools[SlideShapeTool.id]}
            isSelected={isSlideToolSelected}
          />
          <DefaultToolbarContent />
        </DefaultToolbar>
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

const NULL_COMPONENTS_OVERRIDE = {
  ContextMenu: null,
  ActionsMenu: null,
  HelpMenu: null,
  ZoomMenu: null,
  MainMenu: null,
  Minimap: null,
  StylePanel: null,
  PageMenu: null,
  NavigationPanel: null,
  Toolbar: null,
  KeyboardShortcutsDialog: null,
  QuickActions: null,
  HelperButtons: null,
  DebugPanel: null,
  DebugMenu: null,
  MenuPanel: null,
  SharePanel: null,
  CursorChatBubble: null,
  TopPanel: null,
};

interface InnerProps {
  onMount: TldrawProps["onMount"];
  snapshot?: TLEditorSnapshot | TLStoreSnapshot;
  perInstanceAtoms: PerInstanceAtoms;
}
const Inner = track((props: InnerProps) => {
  const { onMount, snapshot, perInstanceAtoms } = props;

  const handleMount = (editor: Editor) => {
    editor.sideEffects.registerBeforeCreateHandler("shape", (shape) => {
      if (shape.type === SlideShapeType && shape.meta?.keyframe == null) {
        // Auto attach camera keyframe to the newly created slide shape
        const orderedSteps = getOrderedSteps(
          editor,
          perInstanceAtoms.$startStepIndex.get(),
        );
        const lastCameraKeyframe = orderedSteps
          .reverse()
          .flat()
          .find((kf) => kf.data.type === "cameraZoom");
        const keyframe: Keyframe<CameraZoomKeyframeData> = {
          id: uniqueId(),
          globalIndex: orderedSteps.length,
          trackId: lastCameraKeyframe ? lastCameraKeyframe.trackId : uniqueId(),
          data: {
            type: "cameraZoom",
            duration: lastCameraKeyframe ? 1000 : 0,
          },
        };
        return {
          ...shape,
          meta: {
            ...shape.meta,
            keyframe: keyframeToJsonObject(keyframe),
          },
        };
      } else {
        // If the shape contains a keyframe, ensure that the keyframe is unique.
        // This is necessary e.g. when a shape is duplicated, the keyframe should not be duplicated.
        const keyframe = getKeyframe(shape);
        const keyframeId = keyframe?.id;
        if (keyframeId == null) {
          return shape;
        }

        const allKeyframes = getAllKeyframes(editor);
        const allKeyframeIds = allKeyframes.map((kf) => kf.id);
        if (allKeyframeIds.includes(keyframeId)) {
          const orderedSteps = getOrderedSteps(
            editor,
            perInstanceAtoms.$startStepIndex.get(),
          );
          shape.meta.keyframe = {
            ...keyframe,
            id: uniqueId(),
            globalIndex: orderedSteps.length,
          };
        }
        return shape;
      }
    });
    editor.sideEffects.registerBeforeDeleteHandler("shape", (shape) => {
      detatchKeyframe(editor, shape.id);
    });

    onMount?.(editor);

    return () => {
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

    const keyframe = getKeyframe(shape);
    if (keyframe == null) {
      // No animation keyframe is attached to this shape, so it should always be visible
      return SHOW;
    }

    const orderedSteps = getOrderedSteps(
      editor,
      perInstanceAtoms.$startStepIndex.get(),
    ); // TODO: Cache
    const currentStepIndex = perInstanceAtoms.$currentStepIndex.get();
    const currentStep = orderedSteps[currentStepIndex];
    if (currentStep == null) {
      // Fallback: This should never happen, but if it does, show the shape
      return SHOW;
    }

    const isCurrent = currentStep
      .map((keyframe) => keyframe.id)
      .includes(keyframe.id);
    if (isCurrent) {
      // Current frame should always be visible
      return SHOW;
    }

    // The last frame of a finished animation should always be visible
    const isFuture = keyframe.globalIndex > currentStepIndex;
    if (isFuture) {
      return HIDDEN;
    }
    const keyframes = getAllKeyframes(editor); // TODO: Cache
    const isLatestPrevInTrack = !keyframes.some((anotherKf) => {
      const same = anotherKf.id === keyframe.id;
      if (same) {
        return false;
      }

      const anotherKfIsLatestInTrack =
        anotherKf.trackId === keyframe.trackId &&
        keyframe.globalIndex < anotherKf.globalIndex &&
        anotherKf.globalIndex <= currentStepIndex;
      return anotherKfIsLatestInTrack;
    });
    if (isLatestPrevInTrack) {
      return SHOW;
    }

    return HIDDEN;
  };

  const presentationMode = perInstanceAtoms.$presentationMode.get();

  return (
    <Tldraw
      onMount={handleMount}
      components={{
        ...makeComponents(perInstanceAtoms),
        ...(presentationMode ? NULL_COMPONENTS_OVERRIDE : {}), // Hide all UI components in presentation mode. `hideUi` option is not used because it also disables the hotkeys.
      }}
      overrides={makeUiOverrides(perInstanceAtoms)}
      shapeUtils={customShapeUtils}
      tools={customTools}
      isShapeHidden={determineShapeHidden}
      options={{
        maxPages: 1,
        createTextOnCanvasDoubleClick: !presentationMode,
      }}
      snapshot={snapshot}
    >
      {
        presentationMode && <ReadonlyOverlay /> // Prevent interactions with shapes in presentation mode. Tldraw's `readOnly` option is not used because it allows some ops like selecting shapes or editing text.
      }
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
      startStep,
    } = props;

    const tlanislideAtoms = usePerInstanceAtoms();
    const {
      $currentStepIndex,
      $presentationMode,
      $stepHotkeyEnabled,
      $startStepIndex,
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
        const targetStep = step ?? 0;
        if ($presentationMode.get()) {
          const orderedSteps = getOrderedSteps(editor, $startStepIndex.get());
          const res = runStep(editor, orderedSteps, targetStep);
          if (res) {
            $currentStepIndex.set(targetStep);
          }
        }

        editorRef.current = editor;
        onMount?.(editor);
      },
      [step, onMount, $presentationMode, $startStepIndex, $currentStepIndex],
    );

    useEffect(() => {
      if (startStep != null) {
        $startStepIndex.set(startStep);
      }
    }, [$startStepIndex, startStep]);

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

      const orderedSteps = getOrderedSteps(editor, $startStepIndex.get());
      const res = runStep(editor, orderedSteps, step);
      if (res) {
        $currentStepIndex.set(step);
      }
    }, [$currentStepIndex, $startStepIndex, step]);
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
          getOrderedSteps(editorRef.current, $startStepIndex.get()),
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
