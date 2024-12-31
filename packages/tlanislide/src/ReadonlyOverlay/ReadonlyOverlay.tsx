import { useRef } from "react";
import { usePassThroughWheelEvents } from "tldraw";
import styles from "./ReadonlyOverlay.module.scss";

// To prevent the user from interacting with the canvas while in presentation mode,
// except for scrolling.
interface ReadonlyOverlayProps {
  children?: React.ReactNode;
}
export function ReadonlyOverlay(props: ReadonlyOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  usePassThroughWheelEvents(ref);
  return (
    <div ref={ref} className={styles.readonlyOverlay}>
      {props.children}
    </div>
  );
}
