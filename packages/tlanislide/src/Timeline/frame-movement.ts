import type {
  FrameBatchUIData,
  FrameUIData,
  SubFrameUIData,
  Track,
} from "./frame-ui-data";
import type { Frame, FrameBatch, Step } from "../models";
import { reassignGlobalIndexInplace } from "../ordered-track-item";

export function moveFrame(
  steps: FrameBatchUIData[][],
  track: Track,
  srcGlobalIndex: number,
  srcTrackIndex: number,
  dstGlobalIndex: number,
  dstType: "after" | "at",
): Step[] | undefined {
  if (
    srcGlobalIndex < dstGlobalIndex ||
    (srcGlobalIndex === dstGlobalIndex && dstType === "after")
  ) {
    if (dstType === "after") {
      dstGlobalIndex++;
    }
    // Move to the right
    const newSteps: FrameBatch[][] = [];
    const pushedOutFrames: FrameUIData[] = [];
    for (let stepIndex = 0; stepIndex < steps.length + 1; stepIndex++) {
      // NOTE: Loop until `stepIndex` is `steps.length` to handle the case where `dstGlobalIndex = steps.length` and `dstType = "after"`.
      const step = steps[stepIndex] ?? [];
      if (stepIndex < srcGlobalIndex) {
        newSteps.push(step);
      } else if (stepIndex === srcGlobalIndex) {
        const newStep: FrameBatch[] = [];
        step.forEach((frameBatch) => {
          if (frameBatch.trackId !== track.id) {
            newStep.push(frameBatch);
          } else {
            const [cueFrame, ...subFrames] = frameBatch.data;
            if (cueFrame.trackIndex === srcTrackIndex) {
              pushedOutFrames.push(cueFrame, ...subFrames);
            } else {
              const remainingSubFrames: SubFrameUIData[] = [];
              subFrames.forEach((subFrame) => {
                if (subFrame.trackIndex < srcTrackIndex) {
                  remainingSubFrames.push(subFrame);
                } else {
                  pushedOutFrames.push(subFrame);
                }
              });
              newStep.push({
                ...frameBatch,
                data: [cueFrame, ...remainingSubFrames],
              });
            }
          }
        });
        newSteps.push(newStep);
      } else if (srcGlobalIndex < stepIndex && stepIndex < dstGlobalIndex) {
        const newStep: FrameBatch[] = [];
        step.forEach((frameBatch) => {
          if (frameBatch.trackId !== track.id) {
            newStep.push(frameBatch);
          } else {
            pushedOutFrames.push(...frameBatch.data);
          }
        });
        newSteps.push(newStep);
      } else if (stepIndex === dstGlobalIndex) {
        const newStep: FrameBatch[] = [];
        let existingDstFrameBatch: FrameBatchUIData | null = null;
        for (const frameBatch of step) {
          if (!(dstType === "at" && frameBatch.trackId === track.id)) {
            newStep.push(frameBatch);
          } else {
            existingDstFrameBatch = frameBatch;
          }
        }

        if (existingDstFrameBatch != null) {
          const lastPushedOutFrame = pushedOutFrames.at(-1);
          if (lastPushedOutFrame != null) {
            const [cueFrame, ...subFrames] = existingDstFrameBatch.data;
            pushedOutFrames.push(
              {
                id: cueFrame.id,
                type: "sub",
                prevFrameId: lastPushedOutFrame.id,
                trackIndex: cueFrame.trackIndex,
                action: cueFrame.action,
              },
              ...subFrames,
            );
          } else {
            pushedOutFrames.push(...existingDstFrameBatch.data);
          }
        }
        // Convert the pushed out frames into new frame batches
        let frameBatchesToInsert: FrameBatch[] = [];
        if (pushedOutFrames.length > 0) {
          pushedOutFrames[0] = {
            // The first frame is always a cueFrame
            ...pushedOutFrames[0],
            type: "cue",
            trackId: track.id,
            globalIndex: 999999, // This will be set later.
          };
          pushedOutFrames.forEach((frame) => {
            if (frame.type === "cue") {
              frameBatchesToInsert.push({
                id: `batch-${pushedOutFrames[0].id}`,
                trackId: track.id,
                globalIndex: 999999, // This will be set later.
                data: [frame],
              });
            } else {
              frameBatchesToInsert.at(-1)?.data.push(frame);
            }
          });
        }

        if (dstType === "at") {
          const lastFrameBatchToInsert = frameBatchesToInsert.at(-1);
          if (lastFrameBatchToInsert != null) {
            newStep.push(lastFrameBatchToInsert);
            frameBatchesToInsert = frameBatchesToInsert.slice(0, -1);
          }
        }

        frameBatchesToInsert.forEach((frameBatchToInsert) => {
          newSteps.push([frameBatchToInsert]);
        });
        newSteps.push(newStep);
      } else if (dstGlobalIndex < stepIndex) {
        newSteps.push(step);
      }
    }
    reassignGlobalIndexInplace(newSteps);
    for (const step of newSteps) {
      for (const frameBatch of step) {
        frameBatch.data[0].globalIndex = frameBatch.globalIndex;
      }
    }
    return newSteps;
  } else if (
    dstGlobalIndex < srcGlobalIndex ||
    (dstGlobalIndex === srcGlobalIndex && dstType === "after")
  ) {
    // Move to the left
    const newSteps: FrameBatch[][] = [];
    const pushedOutFrames: Frame[] = [];
    for (let stepIndex = steps.length - 1; stepIndex >= -1; stepIndex--) {
      // NOTE: Loop until `stepIndex` is -1 to handle the case where `dstGlobalIndex = -1` and `dstType = "after"`.
      const step = steps[stepIndex] ?? [];
      if (srcGlobalIndex < stepIndex) {
        newSteps.unshift(step);
      } else if (stepIndex === srcGlobalIndex) {
        const newStep: FrameBatch[] = [];
        for (const frameBatch of step) {
          if (frameBatch.trackId !== track.id) {
            newStep.push(frameBatch);
          } else {
            const lastFrame = frameBatch.data.at(-1);
            if (lastFrame && lastFrame.trackIndex === srcTrackIndex) {
              pushedOutFrames.unshift(...frameBatch.data);
            } else {
              const [cueFrame, ...subFrames] = frameBatch.data;
              const remainingSubFrames: SubFrameUIData[] = [];
              subFrames.reverse().forEach((subFrame) => {
                if (srcTrackIndex < subFrame.trackIndex) {
                  remainingSubFrames.unshift(subFrame);
                } else {
                  pushedOutFrames.unshift(subFrame);
                }
              });
              pushedOutFrames.unshift(cueFrame);
              const [firstRemainingSubFrame, ...restRemainingSubFrames] =
                remainingSubFrames;
              newStep.push({
                ...frameBatch,
                data: [
                  {
                    id: firstRemainingSubFrame.id,
                    type: "cue",
                    globalIndex: 999999, // This will be set later
                    trackId: track.id,
                    action: firstRemainingSubFrame.action,
                  },
                  ...restRemainingSubFrames,
                ],
              });
            }
          }
        }
        newSteps.unshift(newStep);
      } else if (dstGlobalIndex < stepIndex && stepIndex < srcGlobalIndex) {
        const newStep: FrameBatch[] = [];
        for (const frameBatch of step) {
          if (frameBatch.trackId !== track.id) {
            newStep.push(frameBatch);
          } else {
            pushedOutFrames.unshift(...frameBatch.data);
          }
        }
        newSteps.unshift(newStep);
      } else if (stepIndex === dstGlobalIndex) {
        const newStep: FrameBatch[] = [];
        let existingDstFrameBatch: FrameBatchUIData | null = null;
        for (const frameBatch of step) {
          if (!(dstType === "at" && frameBatch.trackId === track.id)) {
            newStep.push(frameBatch);
          } else {
            existingDstFrameBatch = frameBatch;
          }
        }

        if (existingDstFrameBatch != null) {
          if (pushedOutFrames.length > 0) {
            // Merge the existing frame batch with the pushed out frames
            const [firstPushedOutFrame, ...restPushedOutFrames] =
              pushedOutFrames;
            pushedOutFrames.unshift(
              ...existingDstFrameBatch.data,
              {
                id: firstPushedOutFrame.id,
                type: "sub",
                prevFrameId: existingDstFrameBatch.data.at(-1)!.id,
                action: firstPushedOutFrame.action,
              },
              ...restPushedOutFrames,
            );
          } else {
            pushedOutFrames.unshift(...existingDstFrameBatch.data);
          }
        }

        // Convert the pushed out frames into new frame batches
        const frameBatchesToInsert: FrameBatch[] = [];
        if (pushedOutFrames.length > 0) {
          pushedOutFrames[0] = {
            // The first frame is always a cueFrame
            ...pushedOutFrames[0],
            type: "cue",
            trackId: track.id,
            globalIndex: 999999, // This will be set later.
          };
          pushedOutFrames.forEach((frame) => {
            if (frame.type === "cue") {
              frameBatchesToInsert.push({
                id: `batch-${pushedOutFrames[0].id}`,
                trackId: track.id,
                globalIndex: 999999, // This will be set later.
                data: [frame],
              });
            } else {
              frameBatchesToInsert.at(-1)?.data.push(frame);
            }
          });
        }

        const [firstFrameBatchToInsert, ...restFrameBatchesToInsert] =
          frameBatchesToInsert;
        restFrameBatchesToInsert.reverse().forEach((frameBatch) => {
          newSteps.unshift([frameBatch]);
        });

        if (dstType === "at") {
          newStep.push(firstFrameBatchToInsert);
        } else {
          newSteps.unshift([firstFrameBatchToInsert]);
        }
        newSteps.unshift(newStep);
      } else if (stepIndex < dstGlobalIndex) {
        newSteps.unshift(step);
      }
    }

    reassignGlobalIndexInplace(newSteps);
    for (const step of newSteps) {
      for (const frameBatch of step) {
        frameBatch.data[0].globalIndex = frameBatch.globalIndex;
      }
    }
    return newSteps;
  }
}
