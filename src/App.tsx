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
  createShapeId,
  EASINGS,
} from "tldraw";
import type { TLUiOverrides, TLComponents } from "tldraw";
import "tldraw/tldraw.css";

import { SlideShapeUtil } from "./SlideShapeUtil";
import { SlideShapeTool } from "./SlideShapeTool";
import { FramePanel } from "./FramePanel";
import {
  $currentSlide,
  presentationFlow,
  getSlides,
  moveToSlide,
} from "./frame";

const MyCustomShapes = [SlideShapeUtil];
const MyCustomTools = [SlideShapeTool];

const myUiOverrides: TLUiOverrides = {
  actions(editor, actions, helpers) {
    const $slides = computed("slides", () => getSlides(editor));

    actions["next-slide"] = {
      id: "next-slide",
      label: "Next Slide",
      kbd: "right",
      onSelect() {
        const slides = $slides.get();
        const currentSlide = $currentSlide.get();
        const index = slides.findIndex((s) => s.id === currentSlide?.id);
        const nextSlide = slides[index + 1] ?? currentSlide ?? slides[0];
        if (nextSlide) {
          editor.stopCameraAnimation();
          moveToSlide(editor, nextSlide);
        }
      },
    };

    actions["prev-slide"] = {
      id: "prev-slide",
      label: "Previous Slide",
      kbd: "left",
      onSelect() {
        const slides = $slides.get();
        const currentSlide = $currentSlide.get();
        const index = slides.findIndex((s) => s.id === currentSlide?.id);
        const prevSlide =
          slides[index - 1] ?? currentSlide ?? slides[slides.length - 1];
        if (prevSlide) {
          editor.stopCameraAnimation();
          moveToSlide(editor, prevSlide);
        }
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

    const arrow2Id = createShapeId("arrow-2");
    editor.createShapes([
      {
        id: arrow2Id,
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
      },
    ]);
    const arrow2 = editor.getShape(arrow2Id);
    if (arrow2 == null) {
      throw new Error("Arrow 2 not found");
    }

    presentationFlow.initialize();
    presentationFlow.pushStep({
      type: "camera",
      shapeId: slide1Id,
      zoomToBoundsParams: {
        inset: 100,
      },
    });
    presentationFlow.pushStep({
      type: "camera",
      shapeId: slide2Id,
      zoomToBoundsParams: {
        inset: 200,
        animation: {
          duration: 1000,
          easing: EASINGS.easeInCubic, // TODO: JSON serializable
        },
      },
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        onMount={handleMount}
        components={components}
        overrides={myUiOverrides}
        shapeUtils={MyCustomShapes}
        tools={MyCustomTools}
      />
    </div>
  );
}

export default App;
