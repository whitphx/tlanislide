import { useCallback } from "react";
import { Editor, createShapeId, uniqueId } from "tldraw";
import { Keyframe, SubFrame } from "./models";
import { Tlanislide } from "./Tlanislide.tsx";

function setupDevMock(editor: Editor) {
  const rect0Id = createShapeId("rect0");
  const rectTrackId = uniqueId();
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
      keyframe: {
        id: uniqueId(),
        type: "keyframe",
        globalIndex: 0,
        trackId: rectTrackId,
        data: {
          type: "shapeAnimation",
        },
      } satisfies Keyframe,
    },
  });

  const rect1Id = createShapeId("rect1");
  const rect1FrameId = uniqueId();
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
      keyframe: {
        id: rect1FrameId,
        type: "keyframe",
        globalIndex: 1,
        trackId: rectTrackId,
        data: {
          type: "shapeAnimation",
          duration: 1000,
        },
      } satisfies Keyframe,
    },
  });

  const rect2Id = createShapeId("rect2");
  editor.createShape({
    id: rect2Id,
    type: "geo",
    x: 300,
    y: 0,
    props: {
      w: 100,
      h: 150,
    },
    meta: {
      keyframe: {
        id: uniqueId(),
        type: "subFrame",
        prevFrameId: rect1FrameId,
        data: {
          type: "shapeAnimation",
          duration: 2000,
        },
      } satisfies SubFrame,
    },
  });

  const arrow0Id = createShapeId("arrow0");
  const arrowTrackId = uniqueId();
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
      keyframe: {
        id: uniqueId(),
        type: "keyframe",
        globalIndex: 1,
        trackId: arrowTrackId,
        data: {
          type: "shapeAnimation",
        },
      } satisfies Keyframe,
    },
  });

  const arrow1Id = createShapeId("arrow1");
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
      keyframe: {
        id: uniqueId(),
        type: "keyframe",
        globalIndex: 2,
        trackId: arrowTrackId,
        data: {
          type: "shapeAnimation",
          duration: 1000,
        },
      } satisfies Keyframe,
    },
  });

  const arrow2Id = createShapeId("arrow2");
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
      keyframe: {
        id: uniqueId(),
        type: "keyframe",
        globalIndex: 3,
        trackId: arrowTrackId,
        data: {
          type: "shapeAnimation",
        },
      } satisfies Keyframe,
    },
  });

  const arrow3Id = createShapeId("arrow3");
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
      keyframe: {
        id: uniqueId(),
        type: "keyframe",
        globalIndex: 4,
        trackId: arrowTrackId,
        data: {
          type: "shapeAnimation",
          duration: 1000,
        },
      } satisfies Keyframe,
    },
  });
}

function App() {
  const handleMount = useCallback((editor: Editor) => {
    setupDevMock(editor);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tlanislide onMount={handleMount} />
    </div>
  );
}

export default App;
