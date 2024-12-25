import { Editor, createShapeId, uniqueId } from "tldraw";
import { KeyframeData, keyframeToJsonObject } from "./models"

export function setup(editor: Editor) {
  const rect0Id = createShapeId("rect0");
  const rect0KfId = uniqueId();
  editor.createShape({
    id: rect0Id,
    type: "geo",
    x: 100,
    y: 0,
    props: {
      w: 100,
      h: 50,
    },
    meta: {
      keyframe: keyframeToJsonObject({
        id: rect0KfId,
        globalIndex: 0,
        localBefore: null,
        data: {},
      })
    },
  });

  const rect1Id = createShapeId("rect1");
  const rect1KfId = uniqueId();
  editor.createShape({
    id: rect1Id,
    type: "geo",
    x: 200,
    y: 0,
    props: {
      w: 100,
      h: 100,
    },
    meta: {
      keyframe: keyframeToJsonObject<KeyframeData>({
        id: rect1KfId,
        globalIndex: 1,
        localBefore: rect0KfId,
        data: {
          duration: 1000,
        },
      })
    }
  });

  const arrow0Id = createShapeId("arrow0");
  const arrow0KfId = uniqueId();
  editor.createShape({
    id: arrow0Id,
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
        id: arrow0KfId,
        globalIndex: 1,
        localBefore: null,
        data: {},
      })
    }
  });

  const arrow1Id = createShapeId("arrow1");
  const arrow1KfId = uniqueId();
  editor.createShape({
    id: arrow1Id,
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
        id: arrow1KfId,
        globalIndex: 2,
        localBefore: arrow0KfId,
        data: {
          duration: 1000,
        },
      })
    }
  });

  const arrow2Id = createShapeId("arrow2");
  const arrow2KfId = uniqueId();
  editor.createShape({
    id: arrow2Id,
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
        id: arrow2KfId,
        globalIndex: 3,
        localBefore: arrow1KfId,
        data: {},
      })
    }
  });

  const arrow3Id = createShapeId("arrow3");
  const arrow3KfId = uniqueId();
  editor.createShape({
    id: arrow3Id,
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
        id: arrow3KfId,
        globalIndex: 4,
        localBefore: arrow2KfId,
        data: {
          duration: 1000,
        },
      })
    }
  });
}
