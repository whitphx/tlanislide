import { describe, it, expect, beforeEach } from 'vitest'
import { createShapeId } from "tldraw"
import { PresentationFlow, getShapeSequenceId, CAMERA_SEQUENCE_ID, CameraStep, ShapeStep, ShapeSequence, CameraSequence } from './presentation-flow'

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
      const shapeId1 = createShapeId("shape-1");
      const shapeId2 = createShapeId("shape-2");

      flow.addShapeSequence(shapeId1);
      flow.addShapeSequence(shapeId2);

      const sequences = Object.values(flow.state.sequences);
      expect(sequences).toEqual(expect.arrayContaining([
        { type: "camera", steps: [] },
        { type: "shape", shapeId: shapeId1, steps: [] },
        { type: "shape", shapeId: shapeId2, steps: [] },
      ]));
    })
  });

  describe('Step management', () => {
    const shapeId1 = createShapeId("shape-1");
    const shapeId2 = createShapeId("shape-2");

    beforeEach(() => {
      flow.addShapeSequence(shapeId1);
      flow.addShapeSequence(shapeId2);
    });

    it('can add steps', () => {
      flow.pushStep({
        type: "camera",
        shapeId: shapeId1,
        zoomToBoundsParams: {
          inset: 100,
        },
      })
      flow.pushStep({ type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } })
      flow.pushStep({ type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 200 } } })
      flow.pushStep({ type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 300 } } })
      flow.pushStep({ type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 400 } } })

      expect(flow.getFrames()).toEqual([
        [{ type: "camera", shapeId: shapeId1, zoomToBoundsParams: { inset: 100 } }],
        [{ type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } }],
        [{ type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 200 } } }],
        [{ type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 300 } } }],
        [{ type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 400 } } }],
      ]);
    });

    describe('moveStepToFrame', () => {
      describe('when moving a step to a different frame without side effects', () => {
        let cameraStep1: CameraStep
        let cameraStep2: CameraStep
        let shapeStep1: ShapeStep

        beforeEach(() => {
          cameraStep1 = {
            type: "camera",
            shapeId: shapeId1,
            zoomToBoundsParams: {
              inset: 100,
            },
          }
          cameraStep2 = {
            type: "camera",
            shapeId: shapeId1,
            zoomToBoundsParams: {
              inset: 200,
            },
          }
          shapeStep1 = {
            type: "shape",
            shapeId: shapeId1,
            animateShapeParams: { partial: { x: 100 } },
          }

          flow.pushStep(cameraStep1)
          flow.pushStep(shapeStep1)
          flow.pushStep(cameraStep2)
        });

        it('can move a step to another earlier frame', () => {
          flow.moveStepToFrame({ sequenceId: getShapeSequenceId(shapeId1), stepIndex: 0 }, 0);

          expect(flow.getFrames()).toEqual([
            [
              cameraStep1,
              shapeStep1,
            ],
            [
              cameraStep2,
            ],
          ]);
        });

        it('can move a step to another later frame', () => {
          flow.moveStepToFrame({ sequenceId: getShapeSequenceId(shapeId1), stepIndex: 0 }, 2);

          expect(flow.getFrames()).toEqual([
            [
              cameraStep1,
            ],
            [
              cameraStep2,
              shapeStep1,
            ],
          ]);
        });
      });

      describe('when moving a step to a different frame with side effects', () => {
        let cameraStep0: CameraStep
        let cameraStep1: CameraStep
        let cameraStep2: CameraStep
        let shapeStep0: ShapeStep
        let shapeStep1: ShapeStep
        let shapeStep2: ShapeStep

        beforeEach(() => {
          cameraStep0 = {
            type: "camera",
            shapeId: shapeId1,
            zoomToBoundsParams: {
              inset: 0,
            },
          }
          cameraStep1 = {
            type: "camera",
            shapeId: shapeId1,
            zoomToBoundsParams: {
              inset: 100,
            },
          }
          cameraStep2 = {
            type: "camera",
            shapeId: shapeId1,
            zoomToBoundsParams: {
              inset: 200,
            },
          }
          shapeStep0 = {
            type: "shape",
            shapeId: shapeId1,
            animateShapeParams: { partial: { x: 0 } },
          }
          shapeStep1 = {
            type: "shape",
            shapeId: shapeId1,
            animateShapeParams: { partial: { x: 100 } },
          }
          shapeStep2 = {
            type: "shape",
            shapeId: shapeId1,
            animateShapeParams: { partial: { x: 200 } },
          }
          flow.setState({
            sequences: {
              [CAMERA_SEQUENCE_ID]: {
                type: "camera" as const,
                steps: [cameraStep0, cameraStep1, cameraStep2],
              },
              [getShapeSequenceId(shapeId1)]: {
                type: "shape" as const,
                shapeId: shapeId1,
                steps: [shapeStep0, shapeStep1, shapeStep2],
              },
            },
            frames: [
              [{ sequenceId: getShapeSequenceId(shapeId1), stepIndex: 0 }],
              [{ sequenceId: CAMERA_SEQUENCE_ID, stepIndex: 0 }],
              [{ sequenceId: CAMERA_SEQUENCE_ID, stepIndex: 1 }, { sequenceId: getShapeSequenceId(shapeId1), stepIndex: 1 }],
              [{ sequenceId: CAMERA_SEQUENCE_ID, stepIndex: 2 },],
              [{ sequenceId: getShapeSequenceId(shapeId1), stepIndex: 2 }],
            ],
          })

          expect(flow.getFrames()).toEqual([
            [
              shapeStep0,
            ],
            [
              cameraStep0,
            ],
            [
              cameraStep1,
              shapeStep1,
            ],
            [
              cameraStep2,
            ],
            [
              shapeStep2,
            ],
          ]);
        });

        it('can move a step to another earlier frame, pushing other steps in the same sequence to newly created frames to keep the order', () => {
          flow.moveStepToFrame({ sequenceId: getShapeSequenceId(shapeId1), stepIndex: 2 }, 2);

          expect(flow.getFrames()).toEqual([
            [
              shapeStep0,
            ],
            [
              cameraStep0,
            ],
            [
              shapeStep1,
            ],
            [
              cameraStep1,
              shapeStep2,
            ],
            [
              cameraStep2,
            ],
          ]);
        });

        it('can move a step to another later frame, pushing other steps in the same sequence to newly created frames to keep the order', () => {
          flow.moveStepToFrame({ sequenceId: getShapeSequenceId(shapeId1), stepIndex: 0 }, 2);

          expect(flow.getFrames()).toEqual([
            [
              cameraStep0,
            ],
            [
              cameraStep1,
              shapeStep0,
            ],
            [
              shapeStep1,
            ],
            [
              cameraStep2,
            ],
            [
              shapeStep2,
            ],
          ]);
        });
      });
    });
  });
});
