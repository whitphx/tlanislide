import { describe, it, expect, beforeEach } from 'vitest'
import { createShapeId } from "tldraw"
import { PresentationFlow, getShapeSequenceId, CAMERA_SEQUENCE_ID, CameraStep, ShapeStep, SequenceId, PresentationFlowState } from './presentation-flow'

describe('PresentationFlow', () => {
  let flow: PresentationFlow

  beforeEach(() => {
    flow = new PresentationFlow()
  })

  describe('Sequence management', () => {
    it('has a single camera sequence and zero shape sequences initially', () => {
      expect(flow.state.sequences[CAMERA_SEQUENCE_ID]).toBeDefined();
      expect(flow.state.sequences[CAMERA_SEQUENCE_ID].steps).toEqual([]);

      expect(Object.keys(flow.state.sequences).length).toBe(1);
    });

    it('can add shape sequences', () => {
      const shapeSeqId1 = flow.addShapeSequence({ type: "text", x: 100, y: 0, props: { text: "Hello" } });
      const shapeSeqId2 = flow.addShapeSequence({ type: "text", x: 200, y: 0, props: { text: "World" } });

      expect(flow.state.sequences).toEqual({
        [CAMERA_SEQUENCE_ID]: {
          type: "camera",
          steps: [],
        },
        [shapeSeqId1]: {
          type: "shape",
          initialShape: { type: "text", x: 100, y: 0, props: { text: "Hello" } },
          steps: [],
        },
        [shapeSeqId2]: {
          type: "shape",
          initialShape: { type: "text", x: 200, y: 0, props: { text: "World" } },
          steps: [],
        },
      })
    })
  });

  describe('Step management', () => {
    let shapeSeqId1: SequenceId
    let shapeSeqId2: SequenceId

    beforeEach(() => {
      shapeSeqId1 = flow.addShapeSequence({ type: "geo", x: 0, y: 0 });
      shapeSeqId2 = flow.addShapeSequence({ type: "geo", x: 0, y: 0 });
    });

    it('can add steps', () => {
      flow.pushStep(CAMERA_SEQUENCE_ID, {
        type: "camera",
        shapeId: createShapeId("camera-target"),
        zoomToBoundsParams: {
          inset: 100,
        },
      })
      flow.pushStep(shapeSeqId1, { type: "shape", shape: { type: "geo", x: 100, y: 0 } })
      flow.pushStep(shapeSeqId1, { type: "shape", shape: { type: "geo", x: 200, y: 0 } })
      flow.pushStep(shapeSeqId2, { type: "shape", shape: { type: "geo", x: 300, y: 0 } })
      flow.pushStep(shapeSeqId2, { type: "shape", shape: { type: "geo", x: 400, y: 0 } })

      expect(flow.getFrames()).toEqual([
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
          [shapeSeqId2]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 0 },
          [shapeSeqId1]: { type: "at", index: 0 },
          [shapeSeqId2]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 0 },
          [shapeSeqId1]: { type: "at", index: 1 },
          [shapeSeqId2]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 0 },
          [shapeSeqId1]: { type: "after", index: 1 },
          [shapeSeqId2]: { type: "at", index: 0 },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 0 },
          [shapeSeqId1]: { type: "after", index: 1 },
          [shapeSeqId2]: { type: "at", index: 1 },
        },
      ])
    });
  });

  describe('moveStepToFrame: when moving a step to a different frame without side effects', () => {
    let shapeSeqId1: SequenceId
    let shapeSeqId2: SequenceId

    beforeEach(() => {
      shapeSeqId1 = flow.addShapeSequence({ type: "geo", x: 0, y: 0 });
      shapeSeqId2 = flow.addShapeSequence({ type: "geo", x: 0, y: 0 });
    });

    let cameraStep1: CameraStep
    let cameraStep2: CameraStep
    let shapeStep1: ShapeStep

    beforeEach(() => {
      cameraStep1 = {
        type: "camera",
        shapeId: createShapeId("camera-target"),
        zoomToBoundsParams: {
          inset: 100,
        },
      }
      cameraStep2 = {
        type: "camera",
        shapeId: createShapeId("camera-target"),
        zoomToBoundsParams: {
          inset: 200,
        },
      }
      shapeStep1 = {
        type: "shape",
        shape: { type: "geo", x: 100, y: 0 },
      }

      flow.pushStep(CAMERA_SEQUENCE_ID, cameraStep1)
      flow.pushStep(shapeSeqId1, shapeStep1)
      flow.pushStep(CAMERA_SEQUENCE_ID, cameraStep2)
    });

    it('can move a step to another earlier frame', () => {
      flow.moveStepToFrame({ sequenceId: shapeSeqId1, stepIndex: 0 }, 0);

      expect(flow.getFrames()).toEqual([
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 0 },
          [shapeSeqId1]: { type: "at", index: 0 },
          [shapeSeqId2]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 1 },
          [shapeSeqId1]: { type: "after", index: 0 },
          [shapeSeqId2]: { type: "after", index: "initial" },
        }
      ]);
    });

    it('can move a step to another later frame', () => {
      flow.moveStepToFrame({ sequenceId: shapeSeqId1, stepIndex: 0 }, 2);

      expect(flow.getFrames()).toEqual([
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
          [shapeSeqId2]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 1 },
          [shapeSeqId1]: { type: "at", index: 0 },
          [shapeSeqId2]: { type: "after", index: "initial" },
        }
      ]);
    });
  });

  describe('moveStepToFrame: when moving a step to a different frame with side effects', () => {
    const cameraShapeId = createShapeId("camera-target");
    const shapeSeqId0 = getShapeSequenceId("0");
    const shapeSeqId1 = getShapeSequenceId("1");

    beforeEach(() => {
      const cameraStep0 = {
        type: "camera",
        shapeId: cameraShapeId,
        zoomToBoundsParams: {
          inset: 0,
        },
      }
      const cameraStep1 = {
        type: "camera",
        shapeId: cameraShapeId,
        zoomToBoundsParams: {
          inset: 100,
        },
      }
      const cameraStep2 = {
        type: "camera",
        shapeId: cameraShapeId,
        zoomToBoundsParams: {
          inset: 200,
        },
      }
      const shapeStep0 = {
        type: "shape",
        shape: { type: "geo", x: 0, y: 0 },
      }
      const shapeStep1 = {
        type: "shape",
        shape: { type: "geo", x: 100, y: 0 },
      }
      const shapeStep2 = {
        type: "shape",
        shape: { type: "geo", x: 200, y: 0 },
      }

      flow.setState({
        sequences: {
          [CAMERA_SEQUENCE_ID]: {
            type: "camera" as const,
            steps: [cameraStep0, cameraStep1, cameraStep2],
          },
          [shapeSeqId0]: {
            type: "shape" as const,
            initialShape: { type: "geo", x: 0, y: 0 },
            steps: [shapeStep0, shapeStep1, shapeStep2],
          },
          [shapeSeqId1]: {
            type: "shape" as const,
            initialShape: { type: "geo", x: 0, y: 0 },
            steps: [],
          },
        },
        frames: [
          [{ sequenceId: shapeSeqId0, stepIndex: 0 }],
          [{ sequenceId: CAMERA_SEQUENCE_ID, stepIndex: 0 }],
          [{ sequenceId: CAMERA_SEQUENCE_ID, stepIndex: 1 }, { sequenceId: shapeSeqId0, stepIndex: 1 }],
          [{ sequenceId: CAMERA_SEQUENCE_ID, stepIndex: 2 },],
          [{ sequenceId: shapeSeqId0, stepIndex: 2 }],
        ],
      } as PresentationFlowState);

      expect(flow.getFrames()).toEqual([
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: "initial" },
          [shapeSeqId0]: { type: "at", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 0 },
          [shapeSeqId0]: { type: "after", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 1 },
          [shapeSeqId0]: { type: "at", index: 1 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 2 },
          [shapeSeqId0]: { type: "after", index: 1 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 2 },
          [shapeSeqId0]: { type: "at", index: 2 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
      ]);
    });

    it('can move a step to another earlier frame, pushing other steps in the same sequence to newly created frames to keep the order', () => {
      flow.moveStepToFrame({ sequenceId: shapeSeqId0, stepIndex: 2 }, 2);

      expect(flow.getFrames()).toEqual([
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: "initial" },
          [shapeSeqId0]: { type: "at", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 0 },
          [shapeSeqId0]: { type: "after", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 0 },
          [shapeSeqId0]: { type: "at", index: 1 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 1 },
          [shapeSeqId0]: { type: "at", index: 2 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 2 },
          [shapeSeqId0]: { type: "after", index: 2 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
      ]);
    });

    it('can move a step to another later frame, pushing other steps in the same sequence to newly created frames to keep the order', () => {
      flow.moveStepToFrame({ sequenceId: shapeSeqId0, stepIndex: 0 }, 2);

      expect(flow.getFrames()).toEqual([
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 0 },
          [shapeSeqId0]: { type: "after", index: "initial" },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 1 },
          [shapeSeqId0]: { type: "at", index: 0 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 1 },
          [shapeSeqId0]: { type: "at", index: 1 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "at", index: 2 },
          [shapeSeqId0]: { type: "after", index: 1 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
        {
          [CAMERA_SEQUENCE_ID]: { type: "after", index: 2 },
          [shapeSeqId0]: { type: "at", index: 2 },
          [shapeSeqId1]: { type: "after", index: "initial" },
        },
      ]);
    });
  });
});
