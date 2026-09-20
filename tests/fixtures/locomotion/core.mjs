export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const wrapPhase = (value) => {
  const fraction = ((value % 1) + 1) % 1;
  // Floating-point additions must not turn a completed cycle into its last pose.
  return fraction < 1e-9 || fraction > 1 - 1e-9 ? 0 : fraction;
};

export function initialTravel(progress = 0, now = 0) {
  return { progress: clamp(progress), direction: 1, phase: 0, velocity: 0, action: 'idle', lastAt: now };
}

// A stopped reader gets a neutral pose; pauses for inspection can keep their pose.
export function settleTravel(previous, now) {
  return { ...previous, velocity: 0, action: 'idle', lastAt: now };
}

// Advance the stride by distance travelled, independent of the event/frame rate.
export function advanceTravel(previous, progress, now, options = {}) {
  const { trackLength = 700, size = 96, mode = 'auto', reduced = false, strides = { walk: 88, run: 142 } } = options;
  const next = clamp(progress);
  const delta = next - previous.progress;
  if (Math.abs(delta) < 1e-8) return previous;
  const dt = Math.max(16, Math.min(120, now - previous.lastAt));
  const pixels = Math.abs(delta) * trackLength;
  const speed = pixels / dt * 1000;
  const velocity = previous.velocity + (speed - previous.velocity) * (1 - Math.exp(-dt / 60));
  const action = reduced ? 'idle' : mode === 'auto'
    ? (previous.action === 'run' ? velocity > 125 : velocity > 180) ? 'run' : 'walk'
    : mode;
  const stride = (strides[action] || strides.walk) * size / 96;
  return {
    progress: next, direction: delta > 0 ? 1 : -1,
    phase: reduced ? previous.phase : wrapPhase(previous.phase + pixels / stride),
    velocity, action, lastAt: now,
  };
}

export function sequenceFrame(clip, phase) {
  const wrapped = wrapPhase(phase);
  return clip.sequence[Math.min(clip.sequence.length - 1, Math.floor(wrapped * clip.sequence.length + 1e-9))];
}

export function routeProgress(scrollY, top, height, stageHeight) {
  return clamp((scrollY - top) / Math.max(1, height - stageHeight));
}
