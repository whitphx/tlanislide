import type { PointerEvent, MouseEvent, TouchEvent } from "react";
import {
  PointerSensor as LibPointerSensor,
  MouseSensor as LibMouseSensor,
  TouchSensor as LibTouchSensor,
} from "@dnd-kit/core";

// Block DnD event propagation if element have "data-no-dnd" attribute
// Ref: https://github.com/clauderic/dnd-kit/issues/477#issuecomment-1713536492
const handler = ({
  nativeEvent: event,
}: PointerEvent | MouseEvent | TouchEvent) => {
  let cur = event.target as HTMLElement;

  while (cur) {
    if (cur.dataset && cur.dataset.noDnd) {
      return false;
    }
    cur = cur.parentElement as HTMLElement;
  }

  return true;
};

export class PointerSensor extends LibPointerSensor {
  static activators = [
    { eventName: "onPointerDown", handler },
  ] as (typeof LibPointerSensor)["activators"];
}

export class MouseSensor extends LibMouseSensor {
  static activators = [
    { eventName: "onMouseDown", handler },
  ] as (typeof LibMouseSensor)["activators"];
}

export class TouchSensor extends LibTouchSensor {
  static activators = [
    { eventName: "onTouchStart", handler },
  ] as (typeof LibTouchSensor)["activators"];
}
