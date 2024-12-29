import { useCallback, useRef } from "react";

// To animate the active column indicator.
export function useAnimatedActiveColumnIndicator(currentColumnIndex: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<Record<number, HTMLElement | null>>({});
  const columnIndicatorRef = useRef<HTMLDivElement>(null);

  const moveIndicator = useCallback((columnIndex: number) => {
    const activeColumnEl = columnsRef.current[columnIndex];
    const indicatorEl = columnIndicatorRef.current;
    const containerEl = containerRef.current;

    if (!activeColumnEl || !indicatorEl || !containerEl) {
      return;
    }

    // Rather than activeColumnEl.offsetLeft,
    // we should calculate the offset from the container using getBoundingClientRect()
    // for more stable positioning.
    const activeColumnRect = activeColumnEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    const activeColumnLeft = activeColumnRect.left - containerRect.left;
    const activeColumnWidth = activeColumnRect.width;

    indicatorEl.style.width = `${activeColumnWidth}px`;
    indicatorEl.style.transform = `translateX(${activeColumnLeft}px)`;
    indicatorEl.style.opacity = "1";
  }, []);

  const setColumnRef = useCallback(
    (columnIndex: number) => (node: HTMLElement | null) => {
      columnsRef.current[columnIndex] = node;
      moveIndicator(currentColumnIndex);
    },
    [moveIndicator, currentColumnIndex]
  );

  return { containerRef, setColumnRef, columnIndicatorRef };
}
