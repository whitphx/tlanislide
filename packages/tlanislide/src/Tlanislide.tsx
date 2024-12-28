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
import { FramesPanel } from "./FramesPanel";
import {
  getGlobalFrames,
  $currentFrameIndex,
  $presentationMode,
  getKeyframe,
  runFrame,
  getAllKeyframes,
  detatchKeyframe,
  CameraZoomKeyframeData,
  KeyframeData,
  keyframeToJsonObject,
} from "./models";
import { setup } from "./debug";
import React, { useCallback, useEffect, useRef } from "react";
import { Keyframe } from "./keyframe";

const MyCustomShapes = [SlideShapeUtil];
const MyCustomTools = [SlideShapeTool];

const $keyControlsEnabled = atom("key controls are enabled", true);

const uiOverrides: TLUiOverrides = {
  actions(editor, actions) {
    const $globalFrames = computed("global frames", () =>
      getGlobalFrames(editor)
    );

    actions["next-frame"] = {
      id: "next-frame",
      label: "Next Frame",
      kbd: "right",
      onSelect() {
        if (!$keyControlsEnabled.get()) {
          return;
        }

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
        if (!$keyControlsEnabled.get()) {
          return;
        }

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

const components: TLComponents = {
  TopPanel: FramesPanel,
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
}
function Inner(props: InnerProps) {
  const handleMount = (editor: Editor) => {
    setup(editor);

    editor.sideEffects.registerBeforeCreateHandler("shape", (shape) => {
      if (shape.type === SlideShapeType) {
        // Auto attach camera keyframe to the newly created slide shape
        const globalFrames = getGlobalFrames(editor);
        let lastCameraKeyframe: Keyframe<KeyframeData> | undefined;
        for (const frame of globalFrames.reverse()) {
          const cameraKeyframe = frame.find(
            (kf) => kf.data.type === "cameraZoom"
          );
          if (cameraKeyframe) {
            lastCameraKeyframe = cameraKeyframe;
            break;
          }
        }
        const keyframe: Keyframe<CameraZoomKeyframeData> = {
          id: uniqueId(),
          globalIndex: globalFrames.length,
          localBefore: lastCameraKeyframe ? lastCameraKeyframe.id : null,
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
        // Remove keyframe meta if it's not a valid keyframe.
        // This can happen if a shape is copied and pasted, or if a shape is duplicated.
        const keyframe = getKeyframe(shape);
        const keyframeId = keyframe?.id;
        if (keyframeId == null) {
          return shape;
        }

        const allKeyframes = getAllKeyframes(editor);
        const allKeyframeIds = allKeyframes.map((kf) => kf.id);
        if (allKeyframeIds.includes(keyframeId)) {
          delete shape.meta.keyframe;
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
      overrides={uiOverrides}
      shapeUtils={MyCustomShapes}
      tools={MyCustomTools}
      isShapeHidden={determineShapeHidden}
    />
  );
}

// IMPORTANT: Memoization is necessary to prevent re-rendering of the entire Tldraw component tree and recreating the editor instance when the most outer `Tlanislide` component's props change, which typically happens when the current frame index changes in the parent component.
const MemoizedInner = React.memo(Inner);

interface TlanislideProps {
  currentFrameIndex?: number;
  presentationMode?: boolean;
  onMount?: TldrawProps["onMount"];
}
function Tlanislide(props: TlanislideProps) {
  const {
    currentFrameIndex: currentFrameIndexProp,
    presentationMode = false,
    onMount,
  } = props;

  useEffect(() => {
    $presentationMode.set(presentationMode);
  }, [presentationMode]);
  useEffect(() => {
    $keyControlsEnabled.set(currentFrameIndexProp == null);
  }, [currentFrameIndexProp]);

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

  return <MemoizedInner onMount={handleMount} />;
}

export default Tlanislide;
