import type { TLShapeId, TLCameraMoveOptions, TLShapePartial, TLShape } from "tldraw"
import { atom, computed } from "tldraw";

interface StepIndex {
  sequenceId: SequenceId;
  stepIndex: number;
};

function stepIndexEquals(a: StepIndex, b: StepIndex) {
  return a.sequenceId === b.sequenceId && a.stepIndex === b.stepIndex;
}

type Frame = StepIndex[];  // Semantically equivalent to Set<StepIndex>, `StepIndex` is not a primitive type and doesn't work with `Set`. Also, we use array for easier manipulation.

export interface BaseStep {
  type: string;
}
export interface CameraStep extends BaseStep {
  type: "camera";
  shapeId: TLShapeId;
  zoomToBoundsParams: {
    inset?: number;
    targetZoom?: number;
  } & TLCameraMoveOptions;
}
export interface ShapeStep<T extends TLShape = TLShape> extends BaseStep {
  type: "shape";
  shapeId: TLShapeId;
  animateShapeParams: {
    partial: Omit<TLShapePartial<T>, "id" | "type">;
    opts?: TLCameraMoveOptions;
  }
}
type Step<T extends TLShape = TLShape> = CameraStep | ShapeStep<T>;

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

export type ComputedFrame = Step[];  // Semantically equivalent to Set<Step>, `Step` is not a primitive type and doesn't work with `Set`. Also, we use array for easier manipulation.

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

  setState(newState: PresentationFlowState) {
    if (newState.sequences[CAMERA_SEQUENCE_ID]?.type !== "camera") {
      throw new Error(`Invalid initial state: camera sequence not found`);
    }
    this._state.set(newState);
  }

  initialize() {
    this.setState({
      frames: [],
      sequences: {
        [CAMERA_SEQUENCE_ID]: {
          type: "camera",
          steps: [],
        }
      }
    })
  }

  get state() {
    return this._state.get();
  }

  @computed getFrames(): ComputedFrame[] {
    return this.state.frames.map((frame) => {
      const computedSteps = frame.map((stepId) => {
        const sequence = this.state.sequences[stepId.sequenceId];
        return sequence.steps[stepId.stepIndex];
      });
      return computedSteps;
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

  public pushStep<T extends TLShape = TLShape>(step: Step<T>) {
    this._state.update((state) => {
      const targetSequenceId = step.type === "camera" ? CAMERA_SEQUENCE_ID : getShapeSequenceId(step.shapeId);
      if (!state.sequences[targetSequenceId]) {
        throw new Error(`Sequence with id ${targetSequenceId} not found`);
      }

      const newFrame: Frame = [{ sequenceId: targetSequenceId, stepIndex: state.sequences[targetSequenceId].steps.length }];

      return {
        ...state,
        sequences: {
          ...state.sequences,
          [targetSequenceId]: {
            ...state.sequences[targetSequenceId],
            steps: [...state.sequences[targetSequenceId].steps, step],
          },
        },
        frames: [
          ...state.frames,
          newFrame,
        ]
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
