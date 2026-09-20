import atlas from '../../data/avatar-clips.json';
import settings from '../../data/avatar-settings.json';
import { shirtPixel } from './core';

type Rect = number[];
interface Frame { source: Rect; bounds: Rect; pivot: number[]; portrait?: Rect; shirt: Rect; mark: Rect; grips?: number[][]; }
interface Clip { file: string; sourceBodyHeight: number; sequence: number[]; strideAt96?: number; frames: Frame[]; }
export const clips = atlas.clips as Record<string, Clip>;
export interface Outfit { shirtColor: string; markText: string; markColor: string; }
export const outfits = settings.outfits as Record<string, Outfit>;
export const defaultOutfit = settings.activeOutfit;
export const BODY = { width: 128, height: 144, x: 64, y: 112, body: 96 };

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Avatar canvas unavailable');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}
interface Layers { base: HTMLCanvasElement; garment: HTMLCanvasElement; mark: Rect; grips: number[][]; }
export interface Pose { canvas: HTMLCanvasElement; grips: number[][]; }

export class AvatarRenderer {
  private images = new Map<string, Promise<HTMLImageElement>>();
  private layers = new Map<string, Promise<Layers>>();
  private poses = new Map<string, Promise<Pose>>();
  outfit = outfits[defaultOutfit] ? defaultOutfit : Object.keys(outfits)[0];
  setOutfit(id: string) {
    if (!outfits[id]) return false;
    this.outfit = id;
    return true;
  }
  private image(name: string) {
    const source = clips[name];
    if (!source) return Promise.reject(new Error(`Unknown avatar clip: ${name}`));
    // Several motions can share an atlas without decoding it more than once.
    if (!this.images.has(source.file)) {
      const pending = new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Avatar asset unavailable: ${name}`));
        image.src = source.file;
      });
      this.images.set(source.file, pending);
    }
    return this.images.get(source.file)!;
  }
  private async separate(name: string, frame: number, portrait: boolean): Promise<Layers> {
    const clip = clips[name], pose = clip.frames[frame];
    const image = await this.image(name);
    const [sx, sy, sw, sh] = pose.source;
    const raw = surface(sw, sh);
    raw.ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const pixels = raw.ctx.getImageData(0, 0, sw, sh);
    const shirt = raw.ctx.createImageData(sw, sh);
    const [rx, ry, rw, rh] = pose.shirt;
    // Source PNGs remain untouched. Separate only the measured shirt region,
    // preserving its shading while excluding skin, trousers, hair and shoes.
    for (let y = Math.max(0, Math.floor(ry)); y < Math.min(sh, ry + rh); y++) {
      for (let x = Math.max(0, Math.floor(rx)); x < Math.min(sw, rx + rw); x++) {
        const i = (y * sw + x) * 4;
        if (!shirtPixel(pixels.data[i], pixels.data[i+1], pixels.data[i+2], pixels.data[i+3])) continue;
        shirt.data.set(pixels.data.subarray(i, i + 4), i);
        pixels.data[i+3] = 0;
      }
    }
    const crop = portrait ? pose.portrait : undefined;
    if (portrait && !crop) throw new Error(`No portrait crop: ${name}`);
    const size = portrait ? [96, 96] : [BODY.width, BODY.height];
    const scale = crop ? 96 / crop[2] : BODY.body / clip.sourceBodyHeight;
    const x = crop ? -crop[0] * scale : BODY.x - pose.pivot[0] * scale;
    const y = crop ? -crop[1] * scale : BODY.y - pose.pivot[1] * scale;
    const base = surface(size[0], size[1]), garment = surface(size[0], size[1]);
    raw.ctx.putImageData(pixels, 0, 0);
    base.ctx.drawImage(raw.canvas, x, y, sw * scale, sh * scale);
    raw.ctx.putImageData(shirt, 0, 0);
    garment.ctx.drawImage(raw.canvas, x, y, sw * scale, sh * scale);
    const mark = [x + pose.mark[0]*scale, y + pose.mark[1]*scale, pose.mark[2]*scale, pose.mark[3]*scale];
    const grips = (pose.grips || []).map(([gx, gy]) => [x + gx*scale, y + gy*scale]);
    // Only small, fixed-resolution layers are retained; full-frame scratch is freed.
    raw.canvas.width = raw.canvas.height = 0;
    return { base: base.canvas, garment: garment.canvas, mark, grips };
  }
  pose(name: string, frame = 0, portrait = false, mirrored = false): Promise<Pose> {
    const key = `${name}:${frame}:${portrait}`;
    const outfit = outfits[this.outfit];
    const styledKey = `${key}:${this.outfit}:${Boolean(outfit.markText && mirrored)}`;
    if (!this.poses.has(styledKey)) {
      if (!this.layers.has(key)) this.layers.set(key, this.separate(name, frame, portrait));
      const pending = this.layers.get(key)!.then(layers => {
        const { width, height } = layers.base;
        const output = surface(width, height), shirt = surface(width, height);
        shirt.ctx.drawImage(layers.garment, 0, 0);
        if (outfit.shirtColor.toLowerCase() !== '#ffffff') {
          shirt.ctx.globalCompositeOperation = 'multiply';
          shirt.ctx.fillStyle = outfit.shirtColor;
          shirt.ctx.fillRect(0, 0, width, height);
          shirt.ctx.globalCompositeOperation = 'destination-in';
          shirt.ctx.drawImage(layers.garment, 0, 0);
        }
        if (outfit.markText) {
          const [x,y,w,h] = layers.mark;
          shirt.ctx.globalCompositeOperation = 'source-atop';
          shirt.ctx.fillStyle = outfit.markColor;
          shirt.ctx.font = `bold ${Math.max(2, h)}px monospace`;
          shirt.ctx.textAlign = 'center'; shirt.ctx.textBaseline = 'top';
          shirt.ctx.save();
          // The travel canvas flips the character. Counter-flip optional lettering
          // here so a future role shirt remains readable in either direction.
          if (mirrored) { shirt.ctx.translate(2*x + w, 0); shirt.ctx.scale(-1, 1); }
          shirt.ctx.fillText(outfit.markText.slice(0, 16), x + w/2, y, w);
          shirt.ctx.restore();
        }
        output.ctx.drawImage(layers.base, 0, 0);
        output.ctx.drawImage(shirt.canvas, 0, 0);
        return { canvas: output.canvas, grips: layers.grips };
      });
      this.poses.set(styledKey, pending);
    }
    return this.poses.get(styledKey)!;
  }
}
