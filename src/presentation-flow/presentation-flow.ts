import type { TLShapeId, TLCameraMoveOptions } from "tldraw"

export class Frame {
  public readonly steps: Set<Step> = new Set();
}

export interface BaseStep {
  type: string;
  frameIndex: number;
}
export interface CameraStep extends BaseStep {
  type: "camera";
  focusShapeId: TLShapeId;
  zoomToBoundsParams: {
    inset?: number;
    targetZoom?: number;
  } & TLCameraMoveOptions;
}
export interface ShapeStep extends BaseStep {
  type: "shape";
}
type Step = CameraStep | ShapeStep;

export abstract class BaseSequence<T extends Step> {
  public abstract readonly type: T["type"];

  public steps: T[] = [];

  constructor(private presentationFlow: PresentationFlow) { }

  public pushStep(stepPartial: Omit<T, "type" | "frameIndex">) {
    const [frameIndex, newFrame] = this.presentationFlow.createEmptyFrame();
    const step = { ...stepPartial, type: this.type, frameIndex } as T;
    this.steps.push(step);
    newFrame.steps.add(step);
  }

  public insertStep(stepPartial: Omit<T, "type" | "frameIndex">, index: number) {
    // TODO
  }

  public deleteStep(index: number) {
    // TODO
  }

  /**
   * Move the step to a different frame.
   * This keeps the order of steps in the sequence is preserved.
   * To achieve it, the steps after the current step can also be moved to the new frame.
   * If there are not enough frames, new frames will be created.
   */
  public moveStepTo(fromIndexInThisSequence: number, frameIndex: number) {
    // TODO
  }
}

export class CameraSequence extends BaseSequence<CameraStep> {
  public readonly type = "camera";
}

export class ShapeSequence extends BaseSequence<ShapeStep> {
  public readonly type = "shape";
  public readonly shapeId: TLShapeId;

  constructor(presentationFlow: PresentationFlow, shapeId: TLShapeId) {
    super(presentationFlow);
    this.shapeId = shapeId;
  }
}

export type Sequence = CameraSequence | ShapeSequence;

export interface JSONSerializablePresentationFlow {
  // TODO
}

export class PresentationFlow {
  private frames: Frame[] = [];
  private sequences: Sequence[] = [];
  private cameraSequence: CameraSequence;
  private shapeSequences: ShapeSequence[];

  constructor() {
    this.cameraSequence = new CameraSequence(this);
    this.shapeSequences = [];

    this.sequences.push(this.cameraSequence);
  }

  public getCameraSequence(): CameraSequence {
    return this.cameraSequence;
  }

  public getShapeSequences(): ShapeSequence[] {
    return this.shapeSequences;
  }

  public getShapeSequenceAt(index: number): ShapeSequence {
    return this.shapeSequences[index];
  }

  public addShapeSequence(shapeId: TLShapeId) {
    const sequence = new ShapeSequence(this, shapeId);
    this.sequences.push(sequence);
    this.shapeSequences.push(sequence);
  }

  public getFrames() {
    return this.frames;
  }

  public createEmptyFrame(): [number, Frame] {
    const newFrame = new Frame();
    this.frames.push(newFrame);
    const insertedIndex = this.frames.length - 1;
    return [insertedIndex, newFrame];
  }

  public serialize(): JSONSerializablePresentationFlow {
    // TODO
    return {};
  }

  public static deserialize(json: JSONSerializablePresentationFlow): PresentationFlow {
    // TODO
    return new PresentationFlow();
  }
}
