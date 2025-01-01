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
  atom,
  uniqueId,
  react,
  track,
} from "tldraw";
import type {
  TLUiOverrides,
  TLComponents,
  Editor,
  TLShape,
  TldrawProps,
} from "tldraw";
import "tldraw/tldraw.css";

import { SlideShapeType, SlideShapeUtil } from "./SlideShapeUtil";
import { SlideShapeTool } from "./SlideShapeTool";
import { ControlPanel } from "./ControlPanel";
import { ReadonlyOverlay } from "./ReadonlyOverlay";
import {
  getOrderedSteps,
  $currentStepIndex,
  $presentationMode,
  getKeyframe,
  runStep,
  getAllKeyframes,
  detatchKeyframe,
  CameraZoomKeyframeData,
  keyframeToJsonObject,
} from "./models";
import { setup } from "./debug";
import React, { useCallback, useEffect, useRef } from "react";
import { Keyframe } from "./keyframe";

const MyCustomShapes = [SlideShapeUtil];
const MyCustomTools = [SlideShapeTool];

const $stepHotkeyEnabled = atom("steps hotkeys are enabled", true);
const $presentationModeHotkeyEnabled = atom(
  "presentation mode hotkey is enabled",
  true
);

const uiOverrides: TLUiOverrides = {
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

const components: TLComponents = {
  TopPanel: ControlPanel,
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
}
const Inner = track((props: InnerProps) => {
  const handleMount = (editor: Editor) => {
    setup(editor);

    editor.sideEffects.registerBeforeCreateHandler("shape", (shape) => {
      if (shape.type === SlideShapeType && shape.meta?.keyframe == null) {
        // Auto attach camera keyframe to the newly created slide shape
        const orderedSteps = getOrderedSteps(editor);
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
          shape.meta.keyframe = {
            ...keyframe,
            id: uniqueId(),
            globalIndex: getOrderedSteps(editor).length,
          };
        }
        return shape;
      }
    });
    editor.sideEffects.registerBeforeDeleteHandler("shape", (shape) => {
      detatchKeyframe(editor, shape.id);
    });

    props.onMount?.(editor);

    return () => {
      editor.dispose();
    };
  };

  const determineShapeHidden = (shape: TLShape, editor: Editor): boolean => {
    const presentationMode = $presentationMode.get();
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

    const orderedSteps = getOrderedSteps(editor); // TODO: Cache
    const currentStepIndex = $currentStepIndex.get();
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

  const presentationMode = $presentationMode.get();

  return (
    <Tldraw
      onMount={handleMount}
      components={{
        ...components,
        ...(presentationMode ? NULL_COMPONENTS_OVERRIDE : {}), // Hide all UI components in presentation mode. `hideUi` option is not used because it also disables the hotkeys.
      }}
      overrides={uiOverrides}
      shapeUtils={MyCustomShapes}
      tools={MyCustomTools}
      isShapeHidden={determineShapeHidden}
      options={{
        maxPages: 1,
        createTextOnCanvasDoubleClick: !presentationMode,
      }}
    >
      {
        presentationMode && <ReadonlyOverlay /> // Prevent interactions with shapes in presentation mode. Tldraw's `readOnly` option is not used because it allows some ops like selecting shapes or editing text.
      }
    </Tldraw>
  );
});

// IMPORTANT: Memoization is necessary to prevent re-rendering of the entire Tldraw component tree and recreating the editor instance when the most outer `Tlanislide` component's props change, which typically happens when the current frame index changes in the parent component.
const MemoizedInner = React.memo(Inner);

interface TlanislideProps {
  step?: number;
  onStepChange?: (newStep: number) => void;
  presentationMode?: boolean;
  onMount?: TldrawProps["onMount"];
}
function Tlanislide(props: TlanislideProps) {
  const {
    step,
    onStepChange: onStepChange,
    presentationMode = false,
    onMount,
  } = props;

  useEffect(() => {
    $stepHotkeyEnabled.set(step == null);
  }, [step]);
  useEffect(() => {
    $presentationModeHotkeyEnabled.set(presentationMode == null);
  }, [presentationMode]);

  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      onMount?.(editor);
    },
    [onMount]
  );

  useEffect(() => {
    if (presentationMode == null) {
      return;
    }
    $presentationMode.set(presentationMode);
  }, [presentationMode]);

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

    const orderedSteps = getOrderedSteps(editor);
    const res = runStep(editor, orderedSteps, step);
    if (!res) {
      return;
    }
    $currentStepIndex.set(step);
  }, [step]);
  useEffect(() => {
    if (onStepChange == null) {
      return;
    }

    return react("current frame index to call onCurrentStepIndexChange", () => {
      onStepChange($currentStepIndex.get());
    });
  }, [onStepChange]);

  return <MemoizedInner onMount={handleMount} />;
}

export default Tlanislide;
