import {
  Tldraw,
  useIsToolSelected,
  useTools,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  DefaultKeyboardShortcutsDialog,
  DefaultKeyboardShortcutsDialogContent,
  createShapeId,
  react,
} from "tldraw";
import type {
  TLUiOverrides,
  TLComponents,
  Editor,
  TLShapePartial,
  JsonObject,
} from "tldraw";
import "tldraw/tldraw.css";

import { SlideShapeType, SlideShapeUtil } from "./SlideShapeUtil";
import { SlideShapeTool } from "./SlideShapeTool";
import { FramePanel } from "./FramePanel";
import {
  $currentFrameIndex,
  $presentationFlow,
  $presentationMode,
  runInitialFrame,
  runFrame,
  AnimeDataMeta,
  runCurrentFrame,
  getAnimeMeta,
} from "./frame";
import {
  CAMERA_SEQUENCE_ID,
  PresentationFlowState,
  ShapeSequenceId,
} from "./presentation-flow";
import { useEffect } from "react";

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

      actions["next-frame"] = {
        id: "next-frame",
        label: "Next Frame",
        kbd: "right",
        onSelect() {
          const frames = $presentationFlow.getFrames();
          const currentFrameIndex = $currentFrameIndex.get();
          const nextFrameIndex =
            currentFrameIndex === "initial" ? 0 : currentFrameIndex + 1;
          const nextFrame = frames[nextFrameIndex];
          if (nextFrame == null) {
            return;
          }

          $currentFrameIndex.set(nextFrameIndex);
          editor.stopCameraAnimation();
          runFrame(editor, nextFrame);
        },
      };

      actions["prev-frame"] = {
        id: "prev-frame",
        label: "Previous Frame",
        kbd: "left",
        onSelect() {
          const frames = $presentationFlow.getFrames();
          const currentFrameIndex = $currentFrameIndex.get();
          const prevFrameIndex =
            currentFrameIndex === "initial"
              ? "initial"
              : currentFrameIndex === 0
                ? "initial"
                : currentFrameIndex - 1;
          if (prevFrameIndex === "initial") {
            $currentFrameIndex.set(prevFrameIndex);
            runInitialFrame(editor);
            return;
          }

          const prevFrame = frames[prevFrameIndex];
          if (prevFrame == null) {
            return;
          }

          $currentFrameIndex.set(prevFrameIndex);
          editor.stopCameraAnimation();
          runFrame(editor, prevFrame, { skipAnime: true });
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
  HelperButtons: FramePanel,
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

interface TlanislideProps {
  onMount?: (editor: Editor) => void;
  clicks?: number;
}
function Tlanislide(props: TlanislideProps) {
  const handleMount = (editor: Editor) => {
    react("Render anime phantom shapes", () => {
      if ($presentationMode.get()) {
        return;
      }

      const sequenceIds = Object.keys($presentationFlow.state.sequences).filter(
        (sid) => sid !== CAMERA_SEQUENCE_ID
      ) as ShapeSequenceId[];
      sequenceIds.forEach((sequenceId) => {
        const sequence = $presentationFlow.state.sequences[sequenceId];

        const animeShapeId = createShapeId(
          `AnimePhantom:${sequenceId}:initial`
        );
        const meta: AnimeDataMeta = {
          anime: {
            type: "edit",
            sequenceId,
            index: "initial",
          },
        };
        const animeShape = editor.getShape(animeShapeId);
        if (animeShape == null) {
          editor.createShape({
            ...sequence.initialShape,
            id: animeShapeId,
            meta,
          });
        } else {
          editor.updateShape({
            ...sequence.initialShape,
            id: animeShapeId,
            meta,
          });
        }

        sequence.steps.forEach((step, stepIndex) => {
          const animeShapeId = createShapeId(
            `AnimePhantom:${sequenceId}:${stepIndex}`
          );
          const meta: AnimeDataMeta = {
            anime: {
              type: "edit",
              sequenceId,
              index: stepIndex,
            },
          };
          const animeShape = editor.getShape(animeShapeId);
          if (animeShape == null) {
            editor.createShape({
              ...step.shape,
              id: animeShapeId,
              meta,
            });
          } else {
            editor.updateShape({
              ...step.shape,
              id: animeShapeId,
              meta,
            });
          }
        });
      });
    });

    editor.sideEffects.registerAfterChangeHandler("shape", (_, nextShape) => {
      if ($presentationMode.get()) {
        return;
      }

      const anime = getAnimeMeta(nextShape);
      if (!anime) {
        return;
      }

      const { type, sequenceId, index } = anime as AnimeDataMeta["anime"];
      if (type !== "edit") {
        return;
      }

      if (!(sequenceId in $presentationFlow.state.sequences)) {
        console.warn("Sequence not found", sequenceId, "for shape", nextShape);
        return;
      }

      const updatedShape: TLShapePartial = Object.assign({}, nextShape);
      delete updatedShape.meta;
      delete updatedShape.opacity;

      if (index === "initial") {
        $presentationFlow.updateShape(sequenceId, "initial", updatedShape);
      } else {
        $presentationFlow.updateShape(sequenceId, index, updatedShape);
      }
    });

    editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
      if (shape.type === SlideShapeType) {
        $presentationFlow.pushStep(CAMERA_SEQUENCE_ID, {
          type: "camera",
          shapeId: shape.id,
          zoomToBoundsParams: {
            animation: {
              duration: 1000,
            },
          },
        });
      }
    });

    // Save and load presentation flow state to/from the page's metadata
    const initPresentationFlow = editor.getCurrentPage().meta?.presentationFlow;
    if (initPresentationFlow) {
      $presentationFlow.setState(
        initPresentationFlow as unknown as PresentationFlowState
      );
    }
    react("Save state to page meta", () => {
      const state = $presentationFlow.state;
      editor.updatePage({
        ...editor.getCurrentPage(),
        meta: {
          ...editor.getCurrentPage().meta,
          presentationFlow: state as unknown as JsonObject,
        },
      });
    });

    runCurrentFrame(editor, { skipAnime: true });

    props.onMount?.(editor);
  };

  useEffect(() => {
    if (props.clicks == null) {
      return;
    }
    $currentFrameIndex.set(props.clicks <= 0 ? "initial" : props.clicks - 1);
  }, [props.clicks]);

  return (
    <Tldraw
      persistenceKey="tlanislide-dev"
      onMount={handleMount}
      components={components}
      overrides={createUiOverrides({ enableKeyControls: props.clicks == null })}
      shapeUtils={MyCustomShapes}
      tools={MyCustomTools}
      isShapeHidden={(shape) => {
        const animeDataMeta = getAnimeMeta(shape);
        if (!animeDataMeta) {
          return false;
        }
        if ($presentationMode.get()) {
          if (animeDataMeta.type === "edit") {
            return true;
          }
        } else {
          if (animeDataMeta.type === "presentation") {
            return true;
          }
        }
        return false;
      }}
    />
  );
}

export default Tlanislide;
