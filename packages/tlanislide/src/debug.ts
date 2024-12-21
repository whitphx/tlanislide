import { Editor, createShapeId } from "tldraw";
import { addFrameRelation, addSimultaneousFrameRelation, addTrackRelation, attachKeyframe } from "./models"

export function setup(editor: Editor) {
  const rectId0 = createShapeId("rect0");
  editor.createShape({
    id: rectId0,
    type: "geo",
    x: 100,
    y: 0,
    props: {
      w: 100,
      h: 50,
    },
  });

  const rectId1 = createShapeId("rect1");
  editor.createShape({
    id: rectId1,
    type: "geo",
    x: 200,
    y: 0,
    props: {
      w: 100,
      h: 100,
    },
  });
  attachKeyframe(editor, rectId0);
  attachKeyframe(editor, rectId1, { duration: 1000 });
  addTrackRelation(editor, rectId0, rectId1);

  const arrowId0 = createShapeId("arrow0");
  editor.createShape({
    id: arrowId0,
    type: "arrow",
    x: 0,
    y: 0,
    props: {
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 100,
        y: 100,
      },
    },
  });

  const arrowId1 = createShapeId("arrow1");
  editor.createShape({
    id: arrowId1,
    type: "arrow",
    x: 0,
    y: 100,
    props: {
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 200,
        y: 200,
      },
    },
  });

  attachKeyframe(editor, arrowId0);
  attachKeyframe(editor, arrowId1);

  const arrowId2 = createShapeId("arrow2");
  editor.createShape({
    id: arrowId2,
    type: "arrow",
    x: 200,
    y: 200,
    props: {
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 300,
        y: 100,
      },
    },
  });
  attachKeyframe(editor, arrowId2);

  addTrackRelation(editor, arrowId1, arrowId2);

  // addSimultaneousFrameRelation(editor, rectId0, arrowId1);
  addFrameRelation(editor, rectId0, arrowId1);
  addSimultaneousFrameRelation(editor, rectId1, arrowId2);

  const arrowId3 = createShapeId("arrow3");
  editor.createShape({
    id: arrowId3,
    type: "arrow",
    x: 300,
    y: 100,
    props: {
      start: {
        x: 0,
        y: 0,
      },
      end: {
        x: 400,
        y: 200,
      },
    },
  });
  attachKeyframe(editor, arrowId3);
}
