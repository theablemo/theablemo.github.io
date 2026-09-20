export const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => t * t * (3 - 2 * t);
export const frameAt = (phase: number, sequence: number[]) => sequence[Math.floor(((phase % 1 + 1) % 1) * sequence.length + 1e-9) % sequence.length];

export function gait(previous: 'walk' | 'run', speed: number) {
  return previous === 'run' ? speed < 125 ? 'walk' : 'run' : speed > 210 ? 'run' : 'walk';
}

export type Gesture = 'wave' | 'smile' | 'wink' | 'curious' | 'laugh' | 'surprised' | 'thoughtful' | 'sleepy';
export const gestures: Gesture[] = ['wave', 'smile', 'wink', 'curious', 'laugh', 'surprised', 'thoughtful', 'sleepy'];
export const gestureLength = (gesture: Gesture) => gesture === 'wave' ? 2070 : 2200;
export function gestureAt(gesture: Gesture, elapsed: number) {
  if (gesture === 'wave') {
    const frames = [[0,280],[1,180],[2,170],[3,170],[2,170],[3,170],[2,170],[1,220],[0,540]];
    for (const [frame, duration] of frames) {
      if (elapsed < duration) return { clip: 'wave', frame };
      elapsed -= duration;
    }
    return { clip: 'wave', frame: 0 };
  }
  // Neutral holds make the generated expressions read as deliberate gestures.
  const active = elapsed > 280 && elapsed < (gesture === 'wink' ? 1000 : 1630);
  if (!active) return { clip: 'expressions', frame: 0 };
  if (gesture === 'smile' || gesture === 'wink' || gesture === 'curious')
    return { clip: 'expressions', frame: { smile: 1, wink: 2, curious: 3 }[gesture] };
  return { clip: 'expressions-extra', frame: { laugh: 0, surprised: 1, thoughtful: 2, sleepy: 3 }[gesture] };
}

export function shirtPixel(r: number, g: number, b: number, alpha: number) {
  return alpha > 0 && Math.min(r, g, b) >= 72 && Math.max(r, g, b) - Math.min(r, g, b) < 32;
}
