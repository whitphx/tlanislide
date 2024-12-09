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
import type { TLUiOverrides, Editor, TLComponents } from "tldraw";
import "tldraw/tldraw.css";

import { SlideShapeUtil } from "./SlideShapeUtil";
import { SlideShapeTool } from "./SlideShapeTool";
import { SlidePanel } from "./SlidePanel";
import { $currentSlide, getSlides, moveToSlide } from "./slide";

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
  HelperButtons: SlidePanel,
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
    editor.createShapes([
      {
        type: "slide",
        x: 500,
        y: 500,
      },
    ]);
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
