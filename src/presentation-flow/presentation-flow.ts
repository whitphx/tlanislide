import type { TLShapeId, TLCameraMoveOptions, TLShapePartial } from "tldraw"
import { atom, computed } from "tldraw";

interface CameraStepId {
  type: "camera";
  stepIndex: number;
}
interface ShapeStepId {
  type: "shape";
  sequenceId: ShapeSequenceId;
  stepIndex: number;
}
type StepId = CameraStepId | ShapeStepId;

interface Frame {
  steps: Set<StepId>;
};

export interface BaseStep {
  type: string;
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
  shapeId: TLShapeId;
  animateShapeParams: {
    partial: Omit<TLShapePartial, "id" | "type">;
    opts?: TLCameraMoveOptions;
  }
}
type Step = CameraStep | ShapeStep;

export interface BaseSequence<T extends Step> {
  type: T["type"];
  steps: T[];
}

export interface CameraSequence extends BaseSequence<CameraStep> {
  type: "camera";
}

export interface ShapeSequence extends BaseSequence<ShapeStep> {
  type: "shape";
  shapeId: TLShapeId;
}

export type Sequence = CameraSequence | ShapeSequence;

export type ShapeSequenceId = TLShapeId;

export type ComputedFrame = Set<Step>;

interface PresentationFlowState {
  cameraSequence: CameraSequence;
  shapeSequences: Record<ShapeSequenceId, ShapeSequence>;
  frames: Frame[];
}

export class PresentationFlow {
  private readonly _state = atom<PresentationFlowState>('PresentationFlow._state', {
    cameraSequence: { type: "camera", steps: [] },
    shapeSequences: {},
    frames: [],
  });

  get state() {
    return this._state.get();
  }

  @computed getCameraSequence(): CameraSequence {
    return this.state.cameraSequence;
  }

  @computed getShapeSequences(): Record<TLShapeId, ShapeSequence> {
    return this.state.shapeSequences
  };

  @computed getFrames(): ComputedFrame[] {
    return this.state.frames.map((frame) => {
      const computedSteps = Array.from(frame.steps).map((stepId) => {
        if (stepId.type === "camera") {
          return this.state.cameraSequence.steps[stepId.stepIndex];
        } else {
          const sequence = this.state.shapeSequences[stepId.sequenceId];
          return sequence.steps[stepId.stepIndex];
        }
      });
      return new Set(computedSteps);
    });
  }

  public addShapeSequence(shapeId: TLShapeId) {
    const newShapeSequence: ShapeSequence = { type: "shape", shapeId, steps: [] };
    this._state.update((state) => {
      return {
        ...state,
        shapeSequences: {
          ...state.shapeSequences,
          [shapeId]: newShapeSequence,
        },
      }
    });
  }

  public pushCameraStep(stepPartial: Omit<CameraStep, "type">) {
    const step = { type: "camera" as const, ...stepPartial };
    this._state.update((state) => {
      const newFrame: Frame = {
        steps: new Set([{ type: "camera", stepIndex: state.cameraSequence.steps.length }]),
      };

      return {
        ...state,
        cameraSequence: {
          ...state.cameraSequence,
          steps: [...state.cameraSequence.steps, step],
        },
        frames: [
          ...state.frames,
          newFrame,
        ]
      };
    });
  }
  public pushShapeStep(shapeId: TLShapeId, stepPartial: Omit<ShapeStep, "type" | "shapeId">) {
    const step = { type: "shape" as const, shapeId, ...stepPartial };
    this._state.update((state) => {
      const targetSequence = state.shapeSequences[shapeId];
      if (!targetSequence) {
        throw new Error(`Shape sequence with id ${shapeId} does not exist`);
      }

      const newFrame: Frame = {
        steps: new Set([{ type: "shape", sequenceId: shapeId, stepIndex: targetSequence.steps.length }]),
      };

      return {
        ...state,
        shapeSequences: {
          ...state.shapeSequences,
          [shapeId]: {
            ...targetSequence,
            steps: [...targetSequence.steps, step],
          },
        },
        frames: [
          ...state.frames,
          newFrame,
        ]
      };
    });
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
  public moveStepTo(stepId: StepId, frameIndex: number, mode: "before" | "after" | "merge") {
  }
}
