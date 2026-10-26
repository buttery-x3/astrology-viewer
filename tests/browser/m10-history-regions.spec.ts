import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { EphemerisEngine, EPHEMERIS_FILES, type EphemerisSnapshot } from '../../src/lib/astronomy/ephemeris';
import { astronomicalToThree, equatorialToVector, sphericalToVector } from '../../src/lib/astronomy/coordinates';
import { eclipticDirection } from '../../src/lib/domain/sky-reference';
import { openControlGroup } from './helpers';

type CameraProbe = { view: number[]; projection: number[] };
const instant = Date.UTC(2000, 0, 1, 12);
const observer = { latitudeDeg: 51.5, longitudeDeg: 0 };
let engine: EphemerisEngine;
let snapshot: EphemerisSnapshot;
test.beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
  snapshot = engine.calculate(instant, observer, ['W', 'E']);
});
test.afterAll(() => engine?.close());

/** Observe genuine uploaded camera matrices; native GL calls are unchanged. */
async function example(page: Page) {
  await page.addInitScript(() => {
    const probe: CameraProbe = (window as any).__m10RegionCamera = { view: [], projection: [] };
    const names = new WeakMap<WebGLUniformLocation, string>();
    const proto = WebGL2RenderingContext.prototype, get = proto.getUniformLocation, upload = proto.uniformMatrix4fv;
    proto.getUniformLocation = function (program, name) {
      const location = get.call(this, program, name);
      if (location) names.set(location, name);
      return location;
    };
    proto.uniformMatrix4fv = function (...args: Parameters<typeof upload>) {
      const name = args[0] && names.get(args[0]);
      if (name === 'viewMatrix') probe.view = Array.from(args[2]);
      if (name === 'projectionMatrix') probe.projection = Array.from(args[2]);
      return Reflect.apply(upload, this, args);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__m10RegionCamera.view.length)).toBe(16);
  await openControlGroup(page, 'display');
  await page.getByLabel('Motion preference', { exact: true }).selectOption('reduced');
  await page.getByLabel('Rendering quality', { exact: true }).selectOption('low');
  await openControlGroup(page, 'aspects');
  await page.getByLabel('Show aspect strands', { exact: true }).uncheck();
}
async function isolate(page: Page, enabled: string[] = []) {
  await openControlGroup(page, 'layers');
  const targets = page.locator('.layer-options [data-feature-id]');
  for (let index = 0; index < await targets.count(); index++) {
    const target = targets.nth(index), id = await target.getAttribute('data-feature-id');
    // Catalogue Points retain an unambiguous world-view uniform. They are real
    // visible stars; foreground geometry still has to win its actual pick.
    await target.locator('input').setChecked(id === 'layer:stars' || enabled.includes(id!));
  }
}
async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function pointOnCanvas(page: Page, world: THREE.Vector3) {
  const canvas = page.locator('.scene-canvas canvas');
  await expect.poll(async () => {
    const state = await page.evaluate(() => (window as any).__m10RegionCamera as CameraProbe), box = await canvas.boundingBox();
    return box ? Math.abs(state.projection[5]! / state.projection[0]! - box.width / box.height) : 1;
  }).toBeLessThan(1e-5);
  await settle(page);
  const state = await page.evaluate(() => (window as any).__m10RegionCamera as CameraProbe), box = (await canvas.boundingBox())!;
  const ndc = world.clone().applyMatrix4(new THREE.Matrix4().fromArray(state.view)).applyMatrix4(new THREE.Matrix4().fromArray(state.projection));
  expect(Math.abs(ndc.x)).toBeLessThan(.95);
  expect(Math.abs(ndc.y)).toBeLessThan(.95);
  const point = { x: box.x + (ndc.x + 1) * box.width / 2, y: box.y + (1 - ndc.y) * box.height / 2 };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe('CANVAS');
  return point;
}
const world = (value: { x: number; y: number; z: number }, radius = 5.8) => {
  const point = astronomicalToThree(value);
  return new THREE.Vector3(point.x, point.y, point.z).multiplyScalar(radius);
};
async function focus(page: Page) {
  await page.getByRole('button', { name: 'Observer sky', exact: true }).click();
  await page.locator('.scene-canvas canvas').focus();
  await page.keyboard.press('f');
  await settle(page);
}
const date = (value: number) => new Date(value).toISOString().replace('T', ' · ').replace('.000Z', ' UTC');

test('a true Orion region interior is a background canvas target and disappears when regions are disabled', async ({ page }) => {
  await example(page);
  await isolate(page, ['layer:constellations']);
  await openControlGroup(page, 'references');
  await page.getByLabel('Find a body, sign, angle or region', { exact: true }).fill('Orion');
  await page.locator('.feature-list [data-feature-id="constellation:ori"]').click();
  await focus(page);
  // This J2000 point is inside Orion, away from its label, boundary and bright
  // stars. It exercises spherical interior classification, not a line or glyph.
  const point = await pointOnCanvas(page, world(sphericalToVector({ longitudeDeg: 90, latitudeDeg: 0 })));
  await page.mouse.move(point.x, point.y);
  const card = page.getByTestId('hover-card');
  await expect(card).toHaveAttribute('data-feature-kind', 'constellation');
  await expect(card).toContainText('Region interior');
  await expect(card.getByRole('heading', { name: 'Orion', exact: true })).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#inspector .selected-heading')).toContainText('CONSTELLATION REGION');
  await expect(page.locator('#inspector h2')).toHaveText('Orion');
  await page.getByLabel('Constellation regions', { exact: true }).uncheck();
  await page.mouse.move(5, 5);
  await page.mouse.move(point.x, point.y);
  await page.waitForTimeout(500);
  await expect(page.locator('[data-testid="hover-card"][data-feature-kind="constellation"]')).toHaveCount(0);
});

test('a real comparison boundary pick retains its secondary system and full selection identity', async ({ page }) => {
  await example(page);
  await openControlGroup(page, 'houses');
  await page.getByLabel('Compare house system', { exact: true }).selectOption('E');
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await page.getByLabel('Show changed regions and assignments only', { exact: true }).uncheck();
  await page.getByRole('radio', { name: 'Boundary arcs', exact: true }).check();
  await page.getByLabel('Show contextual fill', { exact: true }).uncheck();
  await isolate(page, ['layer:houses']);
  await openControlGroup(page, 'references');
  await page.getByLabel('Feature category', { exact: true }).selectOption('comparison');
  const control = page.locator('.feature-navigation [data-feature-id="boundary:comparison:7"]');
  await control.click();
  await focus(page);
  const houses = snapshot.houses[1]!;
  if (houses.status !== 'valid') throw new Error('Equal comparison must be valid.');
  const point = await pointOnCanvas(page, world(eclipticDirection(snapshot, houses.cusps[6]!, 20), 5.8 * 1.009));
  await page.mouse.move(point.x, point.y);
  const card = page.getByTestId('hover-card');
  await expect(card).toHaveAttribute('data-feature-kind', 'boundary');
  await expect(card).toContainText('Comparison · Equal');
  await expect(card).toContainText(`${houses.cusps[6]!.toFixed(2)}°`);
  await page.mouse.click(point.x, point.y);
  await expect(control).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#inspector .feature-reading')).toContainText('Comparison · Equal');
  await expect(page.locator('#inspector .feature-reading')).toContainText(`${houses.cusps[6]!.toFixed(2)}°`);
});

test('a real past trail sample caption keeps its exact sample context after canvas selection', async ({ page }) => {
  await example(page);
  await page.locator('.object-list [data-feature-id="body:moon"]').click();
  await openControlGroup(page, 'trails');
  await page.getByLabel('Show selected body trail', { exact: true }).check();
  await expect(page.getByLabel('Trail sampling status', { exact: true })).toContainText('Trail ready', { timeout: 20000 });
  await isolate(page);
  await focus(page);
  const sampleMs = instant - 43200000, sample = engine.calculate(sampleMs, observer, ['W']);
  const moon = sample.bodies.find(body => body.id === 'moon')!;
  const caption = world(equatorialToVector(moon.fixedEquatorial), 5.8 * 1.017);
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(caption, -caption.y / caption.lengthSq()).normalize();
  caption.addScaledVector(up, .23);
  const point = await pointOnCanvas(page, caption);
  await page.mouse.move(point.x, point.y);
  const card = page.getByTestId('hover-card');
  await expect(card).toHaveAttribute('data-feature-kind', 'trail');
  await expect(card).toContainText('Sample time');
  await expect(card).toContainText(date(sampleMs));
  await expect(card).toContainText('Past');
  await expect(card).toContainText('Relative to stars');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#inspector .feature-reading')).toContainText(date(sampleMs));
  await expect(page.locator('#inspector .feature-reading')).toContainText(`${moon.horizon.altitudeDeg.toFixed(2)}°`);
  await expect(page.locator('#inspector .feature-reading [data-content-id^="body-in-"]')).toHaveCount(0);
});

test('a real historical cusp line retains its sample time, frame and old cusp after canvas selection', async ({ page }) => {
  await example(page);
  await openControlGroup(page, 'houses');
  await page.getByLabel('House system', { exact: true }).selectOption('E');
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Boundary 7,/ }).click();
  await openControlGroup(page, 'trails');
  await page.getByLabel('History window', { exact: true }).selectOption('3600000');
  await page.getByLabel('History sample count', { exact: true }).selectOption('3');
  await page.getByLabel('Show selected boundary history', { exact: true }).check();
  await expect(page.getByLabel('Boundary history status', { exact: true })).toContainText('Boundary history ready', { timeout: 20000 });
  await isolate(page);
  await focus(page);
  const sampleMs = instant - 1800000, sample = engine.calculate(sampleMs, observer, ['E']);
  const houses = sample.houses[0]!;
  if (houses.status !== 'valid') throw new Error('The historical Equal sample must be valid.');
  const point = await pointOnCanvas(page, world(eclipticDirection(sample, houses.cusps[6]!, 20), 5.8 * 1.006));
  await page.mouse.move(point.x, point.y);
  const card = page.getByTestId('hover-card');
  await expect(card).toHaveAttribute('data-feature-kind', 'history');
  await expect(card).toContainText(date(sampleMs));
  await expect(card).toContainText(`${houses.cusps[6]!.toFixed(2)}°`);
  await expect(card).toContainText('Relative to stars');
  await expect(card).toContainText('Past');
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('#inspector .feature-reading')).toContainText(date(sampleMs));
  await expect(page.locator('#inspector .feature-reading')).toContainText(`${houses.cusps[6]!.toFixed(2)}°`);
  await expect(page.locator('#inspector .feature-reading')).toContainText('Equal');
});
