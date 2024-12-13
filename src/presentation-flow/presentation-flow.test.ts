import { describe, it, expect, beforeEach } from 'vitest'
import { createShapeId } from "tldraw"
import { PresentationFlow, getShapeSequenceId, CAMERA_SEQUENCE_ID } from './presentation-flow'

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
        flow.pushCameraStep({
          focusShapeId: shapeId1,
          zoomToBoundsParams: {
            inset: 200,
          },
        })
      });

      it('can move a step to another earlier frame', () => {
        flow.moveStepTo({ type: "shape", sequenceId: getShapeSequenceId(shapeId1), stepIndex: 0 }, 0);

        expect(flow.getFrames()).toEqual([
          new Set([
            { type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 100 } },
            { type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } }
          ]),
          new Set([
            { type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 200 } },
          ]),
        ]);
      });

      it('can move a step to another later frame', () => {
        flow.moveStepTo({ type: "shape", sequenceId: getShapeSequenceId(shapeId1), stepIndex: 0 }, 2);

        expect(flow.getFrames()).toEqual([
          new Set([
            { type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 100 } },
          ]),
          new Set([
            { type: "shape", shapeId: shapeId1, animateShapeParams: { partial: { x: 100 } } },
            { type: "camera", focusShapeId: shapeId1, zoomToBoundsParams: { inset: 200 } },
          ]),
        ]);
      });
    });
  });
});
