import { Editor, createShapeId } from "tldraw";
import { KeyframeData, keyframeToJsonObject } from "./models"

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
    meta: {
      keyframe: keyframeToJsonObject({
        id: rectId0,
        globalIndex: 0,
        localBefore: null,
        data: {},
      })
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
    meta: {
      keyframe: keyframeToJsonObject<KeyframeData>({
        id: rectId1,
        globalIndex: 1,
        localBefore: rectId0,
        data: {
          duration: 1000,
        },
      })
    }
  });

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
    meta: {
      keyframe: keyframeToJsonObject({
        id: arrowId0,
        globalIndex: 1,
        localBefore: null,
        data: {},
      })
    }
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
    meta: {
      keyframe: keyframeToJsonObject<KeyframeData>({
        id: arrowId1,
        globalIndex: 2,
        localBefore: arrowId0,
        data: {
          duration: 1000,
        },
      })
    }
  });

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
    meta: {
      keyframe: keyframeToJsonObject({
        id: arrowId2,
        globalIndex: 3,
        localBefore: arrowId1,
        data: {},
      })
    }
  });

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
    meta: {
      keyframe: keyframeToJsonObject<KeyframeData>({
        id: arrowId3,
        globalIndex: 4,
        localBefore: arrowId2,
        data: {
          duration: 1000,
        },
      })
    }
  });
}
