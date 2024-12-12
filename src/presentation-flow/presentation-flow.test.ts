import { describe, it, expect, beforeEach } from 'vitest'
import { createShapeId, type TLShapeId } from "tldraw"
import { PresentationFlow, Frame, CameraStep, ShapeStep, CameraSequence, ShapeSequence } from './presentation-flow'

describe('PresentationFlow', () => {
  let flow: PresentationFlow

  beforeEach(() => {
    flow = new PresentationFlow()
  })

  describe('Sequence management', () => {
    it('has a single camera sequence and zero shape sequences initially', () => {
      expect(flow.getCameraSequence()).toBeDefined();
      expect(flow.getCameraSequence().steps).toEqual([]);

      expect(Object.keys(flow.getShapeSequences()).length).toBe(0);
    });

    it('can add shape sequences', () => {
      const shapeId1 = createShapeId("shape-1");
      const shapeId2 = createShapeId("shape-2");

      flow.addShapeSequence(shapeId1);
      flow.addShapeSequence(shapeId2);

      expect(Object.keys(flow.getShapeSequences())).toEqual([shapeId1, shapeId2]);
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
      flow.pushCameraStep({
        focusShapeId: shapeId1,
        zoomToBoundsParams: {
          inset: 100,
        },
      })
      flow.pushShapeStep(shapeId1, { animateShapeParams: { partial: { x: 100 } } })
      flow.pushShapeStep(shapeId1, { animateShapeParams: { partial: { x: 200 } } })
      flow.pushShapeStep(shapeId2, { animateShapeParams: { partial: { x: 300 } } })
      flow.pushShapeStep(shapeId2, { animateShapeParams: { partial: { x: 400 } } })

      expect(flow.getFrames()).toEqual([
        new Set([{ type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 100 } }]),
        new Set([{ type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } }]),
        new Set([{ type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 200 } } }]),
        new Set([{ type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 300 } } }]),
        new Set([{ type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 400 } } }]),
      ]);
    });

    describe('moveStepTo', () => {
      beforeEach(() => {
        flow.pushCameraStep({
          focusShapeId: shapeId1,
          zoomToBoundsParams: {
            inset: 100,
          },
        })
        flow.pushShapeStep(shapeId1, { animateShapeParams: { partial: { x: 100 } } })
        flow.pushShapeStep(shapeId1, { animateShapeParams: { partial: { x: 200 } } })
        flow.pushShapeStep(shapeId2, { animateShapeParams: { partial: { x: 300 } } })
        flow.pushShapeStep(shapeId2, { animateShapeParams: { partial: { x: 400 } } })
      });

      it('can move a step to another earlier frame', () => {
        flow.moveStepTo({ type: "shape", "sequenceId": shapeId2, stepIndex: 0 }, 1, "merge");

        expect(flow.getFrames()).toEqual([
          new Set([{ type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 100 } }]),
          new Set([
            { type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } },
          ]),
          new Set([
            { type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 200 } } },
            { type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 300 } } },
          ]),
          new Set([
            { type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 400 } } }
          ]),
        ]);
      });

      it('can move a step to another later frame', () => {
        flow.moveStepTo({ type: "shape", "sequenceId": shapeId1, stepIndex: 0 }, 2, "merge");

        expect(flow.getFrames()).toEqual([
          new Set([{ type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 100 } }]),
          new Set([
            { type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } },
          ]),
          new Set([
            { type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 200 } } },
            { type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 300 } } },
          ]),
          new Set([
            { type: "shape", shapeId: shapeId2, animateShapeParams: { partial: { x: 400 } } }
          ]),
        ]);
      });

      it('cannot move a step to another frame that already has an earlier step in the same sequence', () => {
        expect(() =>
          flow.moveStepTo({ type: "shape", "sequenceId": shapeId2, stepIndex: 1 }, 3, "merge")
        ).toThrow();
      });

      it('cannot move a step to another frame that is earlier than an earlier step in the same sequence', () => {
        expect(() =>
          flow.moveStepTo({ type: "shape", "sequenceId": shapeId2, stepIndex: 1 }, 3, "merge")
        ).toThrow();
      });
    });
  });
});
