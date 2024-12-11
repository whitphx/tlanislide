import { describe, it, beforeEach, expect } from "vitest";
import { createShapeId, type TLShapeId } from "tldraw";
import { PresentationFlow } from './presentation-flow';

describe('PresentationFlow', () => {
  let flow: PresentationFlow;
  let shapeId1: TLShapeId;
  let shapeId2: TLShapeId;
  beforeEach(() => {
    shapeId1 = createShapeId('shape1')
    shapeId2 = createShapeId('shape2')

    flow = new PresentationFlow();
    flow.addShapeSequence(shapeId1);
    flow.addShapeSequence(shapeId2);
  });

  it('should be able to add steps to a sequence', () => {
    flow.getCameraSequence().pushStep({ focusShapeId: shapeId1, zoomToBoundsParams: {} })
    flow.getShapeSequenceAt(0).pushStep({})
    flow.getShapeSequenceAt(1).pushStep({})

    const frames = flow.getFrames()
    expect(frames.length).toBe(3);
  });
});
