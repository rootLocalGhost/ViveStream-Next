import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { showFpsCounter } from "../store";
import "./FPSCounter.css";

export default function FPSCounter() {
  const [fps, setFps] = createSignal(60);

  createEffect(() => {
    if (!showFpsCounter()) return;
    if (typeof window === "undefined" || typeof requestAnimationFrame === "undefined") return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const loop = (now: number) => {
      frameCount++;
      const delta = now - lastTime;

      if (delta >= 500) {
        const calculatedFps = Math.round((frameCount * 1000) / delta);
        setFps(calculatedFps);
        frameCount = 0;
        lastTime = now;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    onCleanup(() => {
      if (animId) cancelAnimationFrame(animId);
    });
  });

  const fpsStatusClass = () => {
    const val = fps();
    if (val >= 55) return "fps-good";
    if (val >= 30) return "fps-warn";
    return "fps-bad";
  };

  return (
    <Show when={showFpsCounter()}>
      <div class={`fps-counter-pill ${fpsStatusClass()}`} title="In-App Realtime Frame Rate Monitor">
        <span class="fps-dot"></span>
        <span class="fps-value">{fps()}</span>
        <span class="fps-unit">FPS</span>
      </div>
    </Show>
  );
}
