import { track, useEditor, stopEventPropagation } from "tldraw";
import { $currentSlide, getSlides, moveToSlide } from "./slide";

export const SlidePanel = track(() => {
  const editor = useEditor();
  const slides = getSlides(editor);
  const currentSlide = $currentSlide.get();
  const selectedShapes = editor.getSelectedShapes();

  return (
    <div
      style={{
        pointerEvents: "all",
      }}
      onPointerDown={(e) => stopEventPropagation(e)}
    >
      {slides.map((slide, i) => {
        console.log({ slide, i });
        const isSelected = selectedShapes.includes(slide);
        return (
          <button
            key={slide.id}
            onClick={() => moveToSlide(editor, slide)}
            style={{
              color: isSelected ? "red" : "black",
              fontWeight: currentSlide?.id === slide.id ? "bold" : "normal",
            }}
          >
            Slide {i + 1}
          </button>
        );
      })}
    </div>
  );
});
