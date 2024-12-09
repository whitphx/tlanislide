import { atom, EASINGS, type Editor } from "tldraw";
import { SlideShape, SlideShapeType } from "./SlideShapeUtil";

export const $currentSlide = atom<SlideShape | null>("current slide", null);

export function moveToSlide(editor: Editor, slide: SlideShape) {
  const bounds = editor.getShapePageBounds(slide.id);
  if (!bounds) {
    return;
  }

  $currentSlide.set(slide);
  editor.zoomToBounds(bounds, {
    inset: 0,
    animation: {
      duration: 500,
      easing: EASINGS.easeInOutCubic,
    },
  });
}

export function getSlides(editor: Editor) {
  return editor
    .getSortedChildIdsForParent(editor.getCurrentPageId())
    .map((id) => editor.getShape(id))
    .filter((s) => s?.type === SlideShapeType) as SlideShape[];
}
