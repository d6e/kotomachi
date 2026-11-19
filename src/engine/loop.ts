// requestAnimationFrame loop with a clamped time step.

export function startLoop(frame: (dt: number) => void): () => void {
  let last = performance.now();
  let id = 0;
  let running = true;
  const tick = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(id);
  };
}
