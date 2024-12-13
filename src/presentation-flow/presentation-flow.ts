import type { TLShapeId, TLCameraMoveOptions, TLShapePartial } from "tldraw"
import { atom, computed } from "tldraw";

interface CameraStepIndex {
  type: "camera";
  stepIndex: number;
}
interface ShapeStepIndex {
  type: "shape";
  sequenceId: ShapeSequenceId;
  stepIndex: number;
}
type StepIndex = CameraStepIndex | ShapeStepIndex;

function stepIndexEquals(a: StepIndex, b: StepIndex) {
  return a.type === b.type && a.stepIndex === b.stepIndex;
}

interface Frame {
  steps: Set<StepIndex>;
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

export const CAMERA_SEQUENCE_ID = "CameraSeq" as const;
export type CameraSequenceId = typeof CAMERA_SEQUENCE_ID;
export type ShapeSequenceId = `ShapeSeq:${TLShapeId}`;
export type SequenceId = CameraSequenceId | ShapeSequenceId;
type SeqIdToSeqMap<K extends string, V> = {
  [P in K]: V;
}
type SequenceMap = SeqIdToSeqMap<CameraSequenceId, CameraSequence> & SeqIdToSeqMap<ShapeSequenceId, ShapeSequence>;

export function getShapeSequenceId(shapeId: TLShapeId): ShapeSequenceId {
  return `ShapeSeq:${shapeId}`;
}

export type ComputedFrame = Set<Step>;

interface PresentationFlowState {
  sequences: SequenceMap;
  frames: Frame[];
}

export class PresentationFlow {
  private readonly _state = atom<PresentationFlowState>('PresentationFlow._state', {
    sequences: {
      [CAMERA_SEQUENCE_ID]: { type: "camera", steps: [] },
    },
    frames: [],
  });

  get state() {
    return this._state.get();
  }

  @computed getCameraSequence(): CameraSequence {
    return this.state.sequences[CAMERA_SEQUENCE_ID];
  }

  @computed getShapeSequences(): ShapeSequence[] {
    return Object.values(this.state.sequences).filter((sequence): sequence is ShapeSequence => sequence.type === "shape");
  };

  @computed getFrames(): ComputedFrame[] {
    return this.state.frames.map((frame) => {
      const computedSteps = Array.from(frame.steps).map((stepId) => {
        if (stepId.type === "camera") {
          return this.state.sequences[CAMERA_SEQUENCE_ID].steps[stepId.stepIndex];
        } else {
          const sequence = this.state.sequences[stepId.sequenceId];
          return sequence.steps[stepId.stepIndex];
        }
      });
      return new Set(computedSteps);
    });
  }

  public addShapeSequence(shapeId: TLShapeId) {
    const shapeSequenceId = getShapeSequenceId(shapeId);
    const newShapeSequence: ShapeSequence = { type: "shape", shapeId, steps: [] };
    this._state.update((state) => {
      return {
        ...state,
        sequences: {
          ...state.sequences,
          [shapeSequenceId]: newShapeSequence,
        },
      }
    });
  }

  public pushCameraStep(stepPartial: Omit<CameraStep, "type">) {
    const step = { type: "camera" as const, ...stepPartial };
    this._state.update((state) => {
      const newFrame: Frame = {
        steps: new Set([{ type: "camera", stepIndex: state.sequences[CAMERA_SEQUENCE_ID].steps.length }]),
      };

      return {
        ...state,
        sequences: {
          ...state.sequences,
          [CAMERA_SEQUENCE_ID]: {
            ...state.sequences[CAMERA_SEQUENCE_ID],
            steps: [...state.sequences[CAMERA_SEQUENCE_ID].steps, step],
          },
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
    const shapeSequenceId = getShapeSequenceId(shapeId);
    this._state.update((state) => {
      const targetSequence = state.sequences[shapeSequenceId];
      if (!targetSequence) {
        throw new Error(`Shape sequence with id ${shapeId} does not exist`);
      }

      const newFrame: Frame = {
        steps: new Set([{ type: "shape", sequenceId: shapeSequenceId, stepIndex: targetSequence.steps.length }]),
      };

      return {
        ...state,
        sequences: {
          ...state.sequences,
          [shapeSequenceId]: {
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
  public moveStepTo(srcStepIdx: StepIndex, dstFrameIdx: number) {
    this._state.update((state) => {
      if (dstFrameIdx < 0 || dstFrameIdx >= state.frames.length) {
        throw new Error(`Frame with index ${dstFrameIdx} not found`);
      }

      const srcFrameIdx = state.frames.findIndex((frame) => Array.from(frame.steps).some((frame) => stepIndexEquals(frame, srcStepIdx)));
      if (srcFrameIdx === -1) {
        throw new Error(`Step with index ${srcStepIdx.stepIndex} not found`);
      }

      if (srcFrameIdx === dstFrameIdx) {
        return state;
      }

      const srcFrame = state.frames[srcFrameIdx];
      const dstFrame = state.frames[dstFrameIdx];

      const newFrames = state.frames.map((frame, idx) => {
        if (idx === srcFrameIdx) {
          return {
            steps: new Set([...srcFrame.steps].filter((step) => !stepIndexEquals(step, srcStepIdx))),
          };
        } else if (idx === dstFrameIdx) {
          return {
            steps: new Set([...dstFrame.steps, { ...srcStepIdx }]),
          };
        } else {
          return frame;
        }
      }).filter((frame) => frame.steps.size > 0);

      return {
        ...state,
        frames: newFrames,
      };
    });
  }
}
