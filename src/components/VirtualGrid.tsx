import {
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  JSX,
  For,
} from "solid-js";
import "./VirtualGrid.css";

export interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: () => number) => JSX.Element;
  minItemWidth?: number;
  gap?: number;
  estimatedItemHeight?: number;
  overscan?: number;
}

export default function VirtualGrid<T>(props: VirtualGridProps<T>) {
  let containerRef: HTMLDivElement | undefined;
  const minWidth = () => props.minItemWidth || 340;
  const gap = () => props.gap || 16;
  const itemHeight = () => props.estimatedItemHeight || 285;
  const overscan = () => props.overscan ?? 3;

  const [containerWidth, setContainerWidth] = createSignal(1200);
  const [scrollTop, setScrollTop] = createSignal(0);
  const [viewportHeight, setViewportHeight] = createSignal(800);
  const [gridOffsetTop, setGridOffsetTop] = createSignal(0);

  let scrollParent: HTMLElement | null = null;
  const handleScroll = () => {
    if (scrollParent) {
      setScrollTop(scrollParent.scrollTop);
    }
  };

  let rafId: number | null = null;
  const updateMeasurements = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!containerRef || !scrollParent) return;
      setContainerWidth(containerRef.clientWidth || 1200);
      setViewportHeight(scrollParent.clientHeight || window.innerHeight);
      setGridOffsetTop(containerRef.offsetTop || 0);
    });
  };

  onMount(() => {
    if (!containerRef) return;

    // Find scrollable parent (.main-content)
    let parent = containerRef.parentElement;
    while (parent && parent !== document.body) {
      const overflowY = window.getComputedStyle(parent).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollParent = parent;
        break;
      }
      parent = parent.parentElement;
    }

    if (!scrollParent) {
      scrollParent = document.documentElement;
    }

    updateMeasurements();

    scrollParent.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateMeasurements, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateMeasurements();
      });
      resizeObserver.observe(containerRef);
      if (scrollParent && scrollParent !== document.documentElement) {
        resizeObserver.observe(scrollParent);
      }
    }

    onCleanup(() => {
      if (scrollParent) {
        scrollParent.removeEventListener("scroll", handleScroll);
      }
      window.removeEventListener("resize", updateMeasurements);
      if (resizeObserver) resizeObserver.disconnect();
    });
  });

  const columns = createMemo(() => {
    const w = containerWidth();
    const g = gap();
    const mw = minWidth();
    const cols = Math.floor((w + g) / (mw + g));
    return Math.max(1, cols);
  });

  const totalRows = createMemo(() => {
    const total = props.items.length;
    const cols = columns();
    return Math.ceil(total / cols);
  });

  const rowHeight = createMemo(() => itemHeight() + gap());

  const startRow = createMemo(() => {
    const st = scrollTop();
    const ot = gridOffsetTop();
    const rh = rowHeight();
    const os = overscan();
    const relScroll = Math.max(0, st - ot);
    return Math.max(0, Math.floor(relScroll / rh) - os);
  });

  const endRow = createMemo(() => {
    const st = scrollTop();
    const ot = gridOffsetTop();
    const vh = viewportHeight();
    const rh = rowHeight();
    const rows = totalRows();
    const os = overscan();
    const relScroll = Math.max(0, st - ot);
    return Math.min(rows, Math.ceil((relScroll + vh) / rh) + os);
  });

  const startIndex = createMemo(() => startRow() * columns());
  const endIndex = createMemo(() =>
    Math.min(props.items.length, endRow() * columns()),
  );
  const translateY = createMemo(() => startRow() * rowHeight());

  // Direct reference slicing to allow SolidJS <For> DOM element recycling with zero flashing
  const visibleItems = createMemo(() => {
    return props.items.slice(startIndex(), endIndex());
  });

  const totalHeight = createMemo(() => {
    const rows = totalRows();
    if (rows === 0) return 0;
    return rows * rowHeight() - gap();
  });

  return (
    <div
      class="virtual-grid-container"
      ref={containerRef}
      style={{ height: `${totalHeight()}px` }}
    >
      <div
        class="virtual-grid-content"
        style={{
          transform: `translate3d(0, ${translateY()}px, 0)`,
          "grid-template-columns": `repeat(${columns()}, minmax(0, 1fr))`,
          gap: `${gap()}px`,
        }}
      >
        <For each={visibleItems()}>
          {(item, i) => props.renderItem(item, () => startIndex() + i())}
        </For>
      </div>
    </div>
  );
}
