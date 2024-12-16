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
  EASINGS,
  TLArrowShape,
  react,
} from "tldraw";
import type {
  TLUiOverrides,
  TLComponents,
  Editor,
  TLShapePartial,
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
} from "./frame";
import { CAMERA_SEQUENCE_ID, ShapeSequenceId } from "./presentation-flow";

const MyCustomShapes = [SlideShapeUtil];
const MyCustomTools = [SlideShapeTool];

const myUiOverrides: TLUiOverrides = {
  actions(editor, actions, helpers) {
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
  tools(editor, tools, helpers) {
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

function App() {
  const handleMount = (editor: Editor) => {
    const slide1Id = createShapeId("slide-1");
    editor.createShapes([
      {
        id: slide1Id,
        type: "slide",
        x: 200,
        y: 200,
      },
    ]);
    const slide1 = editor.getShape(slide1Id);
    if (slide1 == null) {
      throw new Error("Slide 1 not found");
    }

    const slide2Id = createShapeId("slide-2");
    editor.createShapes([
      {
        id: slide2Id,
        type: "slide",
        x: 600,
        y: 400,
      },
    ]);
    const slide2 = editor.getShape(slide2Id);
    if (slide2 == null) {
      throw new Error("Slide 2 not found");
    }

    const arrow1Id = createShapeId("arrow-1");
    editor.createShapes([
      {
        id: arrow1Id,
        type: "arrow",
        x: 700,
        y: 500,
        props: {
          start: {
            x: 0,
            y: 0,
          },
          end: {
            x: 300,
            y: 0,
          },
        },
      },
    ]);
    const arrow1 = editor.getShape(arrow1Id);
    if (arrow1 == null) {
      throw new Error("Arrow 1 not found");
    }

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

    editor.sideEffects.registerAfterChangeHandler(
      "shape",
      (prevShape, nextShape) => {
        if ($presentationMode.get()) {
          return;
        }

        const anime = nextShape.meta?.anime;
        if (!anime) {
          return;
        }

        const { type, sequenceId, index } = anime as AnimeDataMeta["anime"];
        if (type !== "edit") {
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
      }
    );

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

    $presentationFlow.initialize();
    $presentationFlow.pushStep(CAMERA_SEQUENCE_ID, {
      type: "camera",
      shapeId: slide1Id,
      zoomToBoundsParams: {
        inset: 100,
      },
    });
    $presentationFlow.pushStep(CAMERA_SEQUENCE_ID, {
      type: "camera",
      shapeId: slide2Id,
      zoomToBoundsParams: {
        inset: 200,
        animation: {
          duration: 1000,
          easing: "easeInCubic",
        },
      },
    });
    $presentationFlow.pushStep(CAMERA_SEQUENCE_ID, {
      type: "camera",
      shapeId: slide1Id,
      zoomToBoundsParams: {
        inset: 300,
        animation: {
          duration: 1000,
          easing: "easeInCubic",
        },
      },
    });
    const shapeSeqId1 = $presentationFlow.addShapeSequence({
      type: "arrow",
      x: 700,
      y: 500,
      props: {
        start: {
          x: 0,
          y: 0,
        },
        end: {
          x: 0,
          y: 300,
        },
      },
    });
    $presentationFlow.pushStep<TLArrowShape>(shapeSeqId1, {
      type: "shape",
      shape: {
        type: "arrow",
        x: 700,
        y: 500,
        props: {
          start: {
            x: 0,
            y: 0,
          },
          end: {
            x: 300,
            y: 300,
          },
        },
      },
      animateShapeOpts: {
        animation: {
          duration: 1000,
          easing: "easeInCubic",
        },
      },
    });

    runInitialFrame(editor);
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        onMount={handleMount}
        components={components}
        overrides={myUiOverrides}
        shapeUtils={MyCustomShapes}
        tools={MyCustomTools}
        isShapeHidden={(shape) => {
          const animeDataMeta = shape.meta?.anime as
            | AnimeDataMeta["anime"]
            | undefined;
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
    </div>
  );
}

export default App;
