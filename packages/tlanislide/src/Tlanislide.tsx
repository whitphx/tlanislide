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
} from "tldraw";
import type {
  TLUiOverrides,
  TLComponents,
  Editor,
  TLShape,
  TldrawProps,
} from "tldraw";
import "tldraw/tldraw.css";

import { SlideShapeUtil } from "./SlideShapeUtil";
import { SlideShapeTool } from "./SlideShapeTool";
import { FramesPanel } from "./FramesPanel";
import {
  getGlobalFrames,
  $currentFrameIndex,
  $presentationMode,
  getKeyframe,
  runFrame,
  getAllKeyframes,
  detatchKeyframe,
} from "./models";
import { setup } from "./debug";
import React, { useCallback, useEffect, useRef } from "react";

const MyCustomShapes = [SlideShapeUtil];
const MyCustomTools = [SlideShapeTool];

interface CreateUiOverridesOptions {
  enableKeyControls: boolean;
}
function createUiOverrides(options: CreateUiOverridesOptions): TLUiOverrides {
  const { enableKeyControls } = options;
  return {
    actions(editor, actions) {
      if (!enableKeyControls) {
        return actions;
      }

      const $globalFrames = computed("global frames", () =>
        getGlobalFrames(editor)
      );

      actions["next-frame"] = {
        id: "next-frame",
        label: "Next Frame",
        kbd: "right",
        onSelect() {
          const globalFrames = $globalFrames.get();
          const currentFrameIndex = $currentFrameIndex.get();

          const nextFrameIndex = currentFrameIndex + 1;
          const nextFrame = globalFrames[nextFrameIndex];
          if (nextFrame == null) {
            return;
          }

          $currentFrameIndex.set(nextFrameIndex);
          runFrame(editor, nextFrame);
        },
      };

      actions["prev-frame"] = {
        id: "prev-frame",
        label: "Previous Frame",
        kbd: "left",
        onSelect() {
          const globalFrames = $globalFrames.get();
          const currentFrameIndex = $currentFrameIndex.get();

          const prevFrameIndex = currentFrameIndex - 1;
          const prevFrame = globalFrames[prevFrameIndex];
          if (prevFrame == null) {
            return;
          }

          $currentFrameIndex.set(prevFrameIndex);
          runFrame(editor, prevFrame);
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
}

const components: TLComponents = {
  HelperButtons: FramesPanel,
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

interface InnerProps {
  onMount: TldrawProps["onMount"];
  initPresentationMode: boolean;
  enableKeyControls: boolean;
}
function Inner(props: InnerProps) {
  const { enableKeyControls, initPresentationMode, onMount } = props;
  const handleMount = (editor: Editor) => {
    setup(editor);

    $presentationMode.set(initPresentationMode);

    editor.sideEffects.registerBeforeDeleteHandler("shape", (shape) => {
      detatchKeyframe(editor, shape.id);
    });

    if (onMount) {
      onMount(editor);
    }

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

    if (shape.meta?.hiddenDuringAnimation) {
      return HIDDEN;
    }

    const keyframe = getKeyframe(shape);
    if (keyframe == null) {
      // No animation keyframe is attached to this shape, so it should always be visible
      return SHOW;
    }

    const globalFrames = getGlobalFrames(editor); // TODO: Cache
    const currentFrameIndex = $currentFrameIndex.get();
    const currentFrame = globalFrames[currentFrameIndex];
    if (currentFrame == null) {
      // Fallback: This should never happen, but if it does, show the shape
      return SHOW;
    }

    const isCurrent = currentFrame
      .map((keyframe) => keyframe.id)
      .includes(keyframe.id);
    if (isCurrent) {
      // Current frame should always be visible
      return SHOW;
    }

    // The last frame of a finished animation should always be visible
    const isFuture = keyframe.globalIndex > currentFrameIndex;
    if (isFuture) {
      return HIDDEN;
    }
    const keyframes = getAllKeyframes(editor); // TODO: Cache
    const isLatestPrevInTrack = !keyframes.some(
      (kf) =>
        kf.localBefore === keyframe.id && kf.globalIndex <= currentFrameIndex
    );
    if (isLatestPrevInTrack) {
      return SHOW;
    }

    return HIDDEN;
  };

  return (
    <Tldraw
      onMount={handleMount}
      components={components}
      overrides={createUiOverrides({
        enableKeyControls,
      })}
      shapeUtils={MyCustomShapes}
      tools={MyCustomTools}
      isShapeHidden={determineShapeHidden}
    />
  );
}

// IMPORTANT: Memoization is necessary to prevent re-rendering of the entire Tldraw component tree and recreating the editor instance when the most outer `Tlanislide` component's props change, which typically happens when the current frame index changes in the parent component.
const MemoizedInner = React.memo(Inner);

interface TlanislideProps {
  presentationMode?: boolean;
  enableKeyControls?: boolean;
  currentFrameIndex?: number;
  onMount?: TldrawProps["onMount"];
}
function Tlanislide(props: TlanislideProps) {
  const {
    presentationMode: initPresentationMode = false,
    enableKeyControls = true,
    currentFrameIndex: currentFrameIndexProp,
    onMount,
  } = props;

  const editorRef = useRef<Editor | null>(null);
  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      onMount?.(editor);
    },
    [onMount]
  );

  useEffect(() => {
    if (currentFrameIndexProp == null) {
      return;
    }
    if ($currentFrameIndex.get() === currentFrameIndexProp) {
      return;
    }

    const editor = editorRef.current;
    if (editor == null) {
      return;
    }

    const globalFrames = getGlobalFrames(editor);
    const newFrame = globalFrames[currentFrameIndexProp];
    if (newFrame == null) {
      return;
    }

    $currentFrameIndex.set(currentFrameIndexProp);
    runFrame(editor, newFrame);
  }, [currentFrameIndexProp]);

  return (
    <MemoizedInner
      onMount={handleMount}
      initPresentationMode={initPresentationMode}
      enableKeyControls={enableKeyControls}
    />
  );
}

export default Tlanislide;
