import { expect, type Page } from '@playwright/test';

interface FrameProbe { draws: number; armed: boolean; serial: number; image: string | null }
type ProbeWindow = Window & { sceneFrameProbe: FrameProbe };

/** Test-only readback before the native rAF callback returns. WebKit's Win32
 * compositor screenshot can omit a correctly rendered accelerated GL layer. */
export async function installSceneFrameCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: FrameProbe = { draws: 0, armed: false, serial: 0, image: null };
    (window as unknown as ProbeWindow).sceneFrameProbe = probe;
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const original = WebGL2RenderingContext.prototype[method];
      Object.defineProperty(WebGL2RenderingContext.prototype, method, {
        value: function (this: WebGL2RenderingContext, ...args: unknown[]) {
          probe.draws++;
          return Reflect.apply(original, this, args);
        }, configurable: true, writable: true,
      });
    }
    const nativeRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => nativeRAF(timestamp => {
      const before = probe.draws;
      callback(timestamp);
      if (probe.armed && probe.draws > before) {
        const canvas = document.querySelector<HTMLCanvasElement>('.scene-canvas canvas');
        if (canvas) {
          probe.image = canvas.toDataURL('image/png');
          probe.serial++;
          probe.armed = false;
        }
      }
    });
  });
}

export async function sceneDrawCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as ProbeWindow).sceneFrameProbe.draws);
}

/** A resize requests an on-demand render with the existing camera and chart. */
export async function captureSceneFrame(page: Page): Promise<{
  png: Buffer; width: number; height: number; uniqueColours: number; nonBackgroundSamples: number;
}> {
  const serial = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).sceneFrameProbe;
    probe.armed = true;
    window.dispatchEvent(new Event('resize'));
    return probe.serial;
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).sceneFrameProbe.serial)).toBeGreaterThan(serial);
  const image = await page.evaluate(() => (window as unknown as ProbeWindow).sceneFrameProbe.image!);
  // Validate the actual saved PNG, rather than inferring pixels from draw calls.
  const pixels = await page.evaluate(async dataUrl => {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = data.slice(0, 4), unique = new Set<number>(); let nonBackgroundSamples = 0;
    for (let index = 0; index < data.length; index += 124) {
      unique.add(data[index]! | data[index + 1]! << 8 | data[index + 2]! << 16 | data[index + 3]! << 24);
      if (Math.abs(data[index]! - background[0]!) + Math.abs(data[index + 1]! - background[1]!) + Math.abs(data[index + 2]! - background[2]!) > 10) nonBackgroundSamples++;
    }
    return { width: canvas.width, height: canvas.height, uniqueColours: unique.size, nonBackgroundSamples };
  }, image);
  return { png: Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'), ...pixels };
}
