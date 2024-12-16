import type { TLShapeId, TLCameraMoveOptions, TLShapePartial, TLShape, EASINGS, TLStore, JsonObject } from "tldraw"
import { atom, computed, uniqueId } from "tldraw";

interface StepIndex {
  sequenceId: SequenceId;
  stepIndex: number;
};

function stepIndexEquals(a: StepIndex, b: StepIndex) {
  return a.sequenceId === b.sequenceId && a.stepIndex === b.stepIndex;
}

type Frame = StepIndex[];  // Semantically equivalent to Set<StepIndex>, `StepIndex` is not a primitive type and doesn't work with `Set`. Also, we use array for easier manipulation.

export interface JSONSerializableTLCameraMoveOptionsAnimation extends Omit<NonNullable<TLCameraMoveOptions["animation"]>, "easing"> {
  easing?: keyof typeof EASINGS;
}
export interface JSONSerializableTLCameraMoveOptions extends Omit<TLCameraMoveOptions, "animation"> {
  animation?: JSONSerializableTLCameraMoveOptionsAnimation;
}

export interface BaseStep {
  type: string;
}
export interface CameraStep extends BaseStep {
  type: "camera";
  shapeId: TLShapeId;
  zoomToBoundsParams: {
    inset?: number;
    targetZoom?: number;
  } & JSONSerializableTLCameraMoveOptions;
}
export interface ShapeStep<T extends TLShape = TLShape> extends BaseStep {
  type: "shape";
  shape: Omit<TLShapePartial<T>, "id">;
  animateShapeOpts?: JSONSerializableTLCameraMoveOptions;
}
type Step<T extends TLShape = TLShape> = CameraStep | ShapeStep<T>;

export interface BaseSequence<T extends Step> {
  type: T["type"];
  steps: T[];
}

export interface CameraSequence extends BaseSequence<CameraStep> {
  type: "camera";
}

export interface ShapeSequence<T extends TLShape = TLShape> extends BaseSequence<ShapeStep<T>> {
  type: "shape";
  initialShape: Omit<TLShapePartial<T>, "id">;
}

export type Sequence = CameraSequence | ShapeSequence;

export const CAMERA_SEQUENCE_ID = "CameraSeq" as const;
export type CameraSequenceId = typeof CAMERA_SEQUENCE_ID;
export type ShapeSequenceId = `ShapeSeq:${string}`;
export type SequenceId = CameraSequenceId | ShapeSequenceId;
type SeqIdToSeqMap<K extends string, V> = {
  [P in K]: V;
}
type SequenceMap = SeqIdToSeqMap<CameraSequenceId, CameraSequence> & SeqIdToSeqMap<ShapeSequenceId, ShapeSequence>;

export function getShapeSequenceId(str: string): ShapeSequenceId {
  return `ShapeSeq:${str}`;
}

export type RelativeStepIndex = { type: "at" | "after", index: number }
export type ComputedFrame = Record<SequenceId, RelativeStepIndex>;

export interface PresentationFlowState {
  sequences: SequenceMap;
  frames: Frame[];
}
function getEmptyPresentationFlowState(): PresentationFlowState {
  return {
    sequences: {
      [CAMERA_SEQUENCE_ID]: { type: "camera", steps: [] },
    },
    frames: [],
  }
}

export class PresentationFlow {
  private readonly _state = atom<PresentationFlowState>('PresentationFlow._state', getEmptyPresentationFlowState());

  setState(newState: PresentationFlowState) {
    if (newState.sequences[CAMERA_SEQUENCE_ID]?.type !== "camera") {
      throw new Error(`Invalid initial state: camera sequence not found`);
    }
    this._state.set(newState);
  }

  initialize() {
    this.setState(getEmptyPresentationFlowState())
  }

  get state() {
    return this._state.get();
  }

  @computed getFrames(): ComputedFrame[] {
    const sequenceIds = Object.keys(this.state.sequences) as SequenceId[];
    const latestIndexes = sequenceIds.reduce((acc, sequenceId) => {
      acc[sequenceId] = -1;
      return acc;
    }, {} as Record<SequenceId, number>);

    const computedFrames: ComputedFrame[] = [];
    this.state.frames.forEach((frame) => {
      const computedFrame: ComputedFrame = {
        [CAMERA_SEQUENCE_ID]: { type: "after", index: latestIndexes[CAMERA_SEQUENCE_ID] },
      };
      const unseenSequenceIdSet = new Set(sequenceIds);
      frame.forEach((stepIdx) => {
        unseenSequenceIdSet.delete(stepIdx.sequenceId);
        computedFrame[stepIdx.sequenceId] = { type: "at", index: stepIdx.stepIndex };
        latestIndexes[stepIdx.sequenceId] = stepIdx.stepIndex;
      });
      unseenSequenceIdSet.forEach((sequenceId) => {
        computedFrame[sequenceId] = { type: "after", index: latestIndexes[sequenceId] };
      });
      computedFrames.push(computedFrame);
    });
    return computedFrames;
  }

  public addShapeSequence<T extends TLShape = TLShape>(initialShape: Omit<TLShapePartial<T>, "id">): ShapeSequenceId {
    const id = uniqueId();
    const shapeSequenceId: ShapeSequenceId = getShapeSequenceId(id);
    const newShapeSequence: ShapeSequence = { type: "shape", initialShape, steps: [] };
    this._state.update((state) => {
      return {
        ...state,
        sequences: {
          ...state.sequences,
          [shapeSequenceId]: newShapeSequence,
        },
      }
    });
    return shapeSequenceId;
  }

  public pushStep<T extends TLShape = TLShape>(sequenceId: SequenceId, step: Step<T>) {
    this._state.update((state) => {
      const sequence = state.sequences[sequenceId]
      if (sequence == null) {
        throw new Error(`Sequence with id ${sequenceId} not found`);
      }

      if (sequence.type !== step.type) {
        throw new Error(`Step type ${step.type} does not match sequence type ${sequence.type}`);
      }

      const newFrame: Frame = [{ sequenceId: sequenceId, stepIndex: state.sequences[sequenceId].steps.length }];

      return {
        ...state,
        sequences: {
          ...state.sequences,
          [sequenceId]: {
            ...state.sequences[sequenceId],
            steps: [...state.sequences[sequenceId].steps, step],
          },
        },
        frames: [
          ...state.frames,
          newFrame,
        ]
      };
    });
  }

  public updateShape(sequenceId: ShapeSequenceId, stepIndex: number | "initial", shape: Omit<TLShapePartial, "id" | "meta">) {
    this._state.update((state) => {
      const sequence = state.sequences[sequenceId];
      if (sequence == null) {
        throw new Error(`Sequence with id ${sequenceId} not found`);
      }

      if (sequence.type !== "shape") {
        throw new Error(`Sequence with id ${sequenceId} is not a shape sequence`);
      }

      if (stepIndex === "initial") {
        return {
          ...state,
          sequences: {
            ...state.sequences,
            [sequenceId]: {
              ...sequence,
              initialShape: shape,
            },
          },
        };
      }

      if (stepIndex < 0 || stepIndex >= sequence.steps.length) {
        throw new Error(`Step index ${stepIndex} out of range`);
      }

      const newSteps = [...sequence.steps];
      newSteps[stepIndex] = { ...newSteps[stepIndex], shape };

      return {
        ...state,
        sequences: {
          ...state.sequences,
          [sequenceId]: {
            ...sequence,
            steps: newSteps,
          },
        },
      };
    });
  }

  public insertStep(step: Step, index: number) {
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
  public moveStepToFrame(srcStepIdx: StepIndex, dstFrameIdx: number) {
    this._state.update((state) => {
      if (dstFrameIdx < 0 || dstFrameIdx >= state.frames.length) {
        throw new Error(`Frame with index ${dstFrameIdx} not found`);
      }

      const srcFrameIdx = state.frames.findIndex((frame) => frame.some((stepIdx) => stepIndexEquals(stepIdx, srcStepIdx)));
      if (srcFrameIdx === -1) {
        throw new Error(`Step with index ${srcStepIdx.stepIndex} not found`);
      }

      if (srcFrameIdx === dstFrameIdx) {
        return state;
      }

      // To keep the order constraint in the sequence, we need to move all steps before/after the current step to the new frame.
      if (srcFrameIdx < dstFrameIdx) {
        const newFrames = moveStep(
          state.frames,
          srcStepIdx,
          srcFrameIdx,
          dstFrameIdx,
        );
        return {
          ...state,
          frames: newFrames,
        };
      } else {
        const newFrames = moveStep(
          state.frames.slice().reverse(),
          srcStepIdx,
          state.frames.length - srcFrameIdx - 1,
          state.frames.length - dstFrameIdx - 1,
        ).reverse();
        return {
          ...state,
          frames: newFrames,
        };
      }
    });
  }
}

/**
 * Move the step to the new frame.
 * This function is only expected to be used internally by the PresentationFlow class,
 * so some assumptions are made and not checked:
 * * Assuming srcStepIdx is in the srcFrameIdx
 * * Assuming 0 <= srcFrameIdx < dstFrameIdx < framesState.length
 * * Assuming the order of steps in the sequence and the order of frames are correct.
 */
function moveStep(framesState: PresentationFlowState["frames"], srcStepIdx: StepIndex, srcFrameIdx: number, dstFrameIdx: number): PresentationFlowState["frames"] {
  const updatedFramesFragment: Frame[] = []
  const stepIdxsToMove: StepIndex[] = []
  framesState.slice(srcFrameIdx + 1, dstFrameIdx + 1).forEach((frame) => {
    const newFrame: Frame = [];
    frame.forEach((stepIdx) => {
      const shouldMove = stepIdx.sequenceId === srcStepIdx.sequenceId
      if (shouldMove) {
        stepIdxsToMove.push(stepIdx);
      } else {
        newFrame.push(stepIdx);
      }
    });
    updatedFramesFragment.push(newFrame);
  })
  const newInsertedFrames: Frame[] = stepIdxsToMove.map((stepIdx) => [{ ...stepIdx }]);

  const srcFrame = framesState[srcFrameIdx];
  const dstFrame = updatedFramesFragment[updatedFramesFragment.length - 1];

  const updatedSrcFrame = [...srcFrame].filter((stepIdx) => !stepIndexEquals(stepIdx, srcStepIdx));
  const updatedDstFrame = [...dstFrame, { ...srcStepIdx }];

  const newFrames = [
    ...framesState.slice(0, srcFrameIdx),
    updatedSrcFrame,
    ...[
      ...updatedFramesFragment.slice(0, -1),
      updatedDstFrame,
    ],
    ...newInsertedFrames,
    ...framesState.slice(dstFrameIdx + 1),
  ]

  return newFrames.filter((frame) => frame.length > 0);
}
