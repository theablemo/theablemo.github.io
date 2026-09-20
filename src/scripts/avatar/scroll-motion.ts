import { clamp } from './core';

// Smooth only the decorative route. Native scrolling is never intercepted.
export class ScrollMotion {
  value: number;
  private target: number;
  private from: number;
  private began = 0;
  private wheelUntil = -Infinity;
  private direction = 0;
  private readonly duration = 150;

  constructor(value: number) { this.value = this.target = this.from = value; }

  wheel(event: WheelEvent, now: number) {
    // Browsers expose input deltas, not reliable mouse/trackpad identities.
    // Fine pixel deltas already provide their own intermediate motion.
    const coarse = !event.ctrlKey && Math.abs(event.deltaY) > Math.abs(event.deltaX)
      && (event.deltaMode !== 0 || Math.abs(event.deltaY) >= 40);
    this.wheelUntil = coarse ? now + 180 : -Infinity;
  }

  reset(value: number) {
    this.value = this.target = this.from = value;
    this.direction = 0;
    this.wheelUntil = -Infinity;
  }

  get pending() { return this.value !== this.target; }

  follow(target: number, now: number, jumpLimit: number) {
    // Advance the existing impulse before retargeting. Otherwise a new wheel
    // event on every frame would keep restarting at t=0 and freeze the avatar.
    if (this.pending) {
      const t = clamp((now - this.began) / this.duration);
      this.value = t === 1 ? this.target
        : this.from + (this.target - this.from) * (1 - (1 - t) ** 3);
    }
    const delta = target - this.target;
    if (delta !== 0) {
      const reverse = this.direction !== 0 && Math.sign(delta) !== this.direction;
      if (now > this.wheelUntil || Math.abs(delta) > jumpLimit || target === 0 || reverse) {
        // Never carry an old wheel impulse through a reversal, anchor jump or
        // return to the photograph. Resume easing on the next forward impulse.
        this.value = this.from = this.target = target;
      } else {
        this.from = this.value;
        this.target = target;
        this.began = now;
      }
      this.direction = Math.sign(delta);
    }
    return this.value;
  }
}
