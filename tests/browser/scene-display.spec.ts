import { expect, test, type Page } from '@playwright/test';
import * as THREE from 'three';
import { readFile } from 'node:fs/promises';
import { EphemerisEngine, EPHEMERIS_FILES } from '../../src/lib/astronomy/ephemeris';
import { astronomicalToThree, equatorialToVector, normalizeDegrees } from '../../src/lib/astronomy/coordinates';
import { eclipticDirection } from '../../src/lib/domain/sky-reference';
import { openControlGroup } from './helpers';

test.use({ deviceScaleFactor: 2 });
let engine: EphemerisEngine;
test.beforeAll(async () => {
  engine = await EphemerisEngine.create({
    wasmBinary: new Uint8Array(await readFile('src/lib/astronomy/generated/spatial-ephemeris.wasm')),
    files: new Map(await Promise.all(EPHEMERIS_FILES.map(async file => [file.name, new Uint8Array(await readFile(`public/data/ephemeris/${file.name}`))] as const))),
  });
});
test.afterAll(() => engine?.close());
async function example(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: /Explore example/ }).click();
  await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
}
async function range(page: Page, name: string, value: string) {
  await page.getByLabel(name, { exact: true }).evaluate((input, next) => { (input as HTMLInputElement).value = next; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}
async function birth(page: Page, date: string, time: string, latitude = 51.5, longitude = 0, zone?: string) {
  await page.goto('/'); await page.getByRole('button', { name: /Enter a birth moment/ }).click();
  await page.getByLabel('Gregorian date (local)').fill(date); await page.getByLabel('Time (local)', { exact: true }).fill(time);
  await page.getByLabel('Latitude · north positive').fill(String(latitude)); await page.getByLabel('Longitude · east positive').fill(String(longitude));
  if (zone) {
    await page.getByLabel('IANA time zone', { exact: true }).fill(zone);
    await page.getByLabel('Confirm this time zone for the entered coordinates').check();
  } else {
    await page.getByLabel('Override with an explicit UTC offset').check(); await page.getByLabel('Offset minutes east of UTC').fill('0');
  }
  await page.getByRole('button', { name: /Set birth anchor/ }).click(); await expect(page.getByText('Moment calculated', { exact: true })).toBeVisible();
}

test('native view controls, orientation, quality and restored context preserve the chart', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await example(page); await page.locator('.object-list').getByRole('button', { name: /^Mars/ }).click();
  const coordinates = await page.locator('#inspector .data-list').first().locator('dd').allTextContents();
  const canvas = page.locator('.scene-canvas canvas');
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width / element.clientWidth)).toBeCloseTo(1.5, 1);
  await page.getByRole('button', { name: 'Return to observer', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Camera orientation', exact: true })).toContainText('Observer sky');
  const before = await page.locator('.orientation-hud').innerText();
  await canvas.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('.orientation-hud')).not.toHaveText(before);
  await page.getByRole('button', { name: 'Zoom in', exact: true }).focus(); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByText('View controls', { exact: true }).click(); await expect(page.locator('.scene-help p')).toBeVisible();
  await openControlGroup(page, 'display'); await page.getByLabel('Rendering quality', { exact: true }).selectOption('low');
  await range(page, 'Scene label size', '1.5'); await range(page, 'Earth opacity', '0.4');
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width / element.clientWidth)).toBeCloseTo(1, 1);
  expect(await page.locator('#inspector .data-list').first().locator('dd').allTextContents()).toEqual(coordinates);
  const supported = await canvas.evaluate(element => {
    const extension = (element as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');
    (window as any).sceneDisplayRecovery = extension; extension?.loseContext(); return Boolean(extension);
  });
  test.skip(!supported, 'Driver has no context-loss simulation.');
  await expect(page.getByText(/paused while the browser restores its graphics context/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
  await page.evaluate(() => (window as any).sceneDisplayRecovery.restoreContext());
  await expect(page.getByText(/paused while the browser restores its graphics context/)).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled();
  await expect(canvas).toHaveCount(1);
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width / element.clientWidth)).toBeCloseTo(1, 1);
  expect(errors).toEqual([]);
});

test('an actual eclipse overlap offers keyboard choices without changing the current chart', async ({ page }) => {
  const instantMs = Date.UTC(2024, 3, 8, 18, 17);
  await birth(page, '2024-04-08', '18:17:00');
  await page.getByRole('button', { name: 'Outside sphere', exact: true }).click();
  const box = await page.locator('.scene-canvas canvas').boundingBox(); if (!box) throw new Error('Missing canvas.');
  const snapshot = engine.calculate(instantMs, { latitudeDeg: 51.5, longitudeDeg: 0 });
  const camera = new THREE.PerspectiveCamera(43, box.width / box.height, 0.015, 100);
  const vertical = THREE.MathUtils.degToRad(43), horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  camera.position.copy(new THREE.Vector3(7.2, 4.8, 9.4).normalize().multiplyScalar(5.8 * 1.24 / Math.sin(Math.min(vertical, horizontal) / 2)));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const points = ['sun', 'moon'].map(id => {
    const value = astronomicalToThree(equatorialToVector(snapshot.bodies.find(body => body.id === id)!.fixedEquatorial));
    return new THREE.Vector3(value.x, value.y, value.z).multiplyScalar(5.8).project(camera);
  });
  // Both markers physically intersect this ray. Their near-coincident sorting
  // can differ with browser floating-point projection; navigate the real order.
  const middle = points[0]!.clone().lerp(points[1]!, 0.45);
  await page.mouse.click(box.x + (middle.x + 1) * box.width / 2, box.y + (1 - middle.y) * box.height / 2);
  const chooser = page.getByRole('dialog', { name: 'Choose a nearby feature', exact: true });
  await expect(chooser).toBeVisible(); await expect(chooser.getByRole('button', { name: /^Sun/ })).toBeVisible(); await expect(chooser.getByRole('button', { name: /^Moon/ })).toBeVisible();
  const choices = chooser.getByRole('button');
  await expect(choices.nth(0)).toBeFocused();
  const nextBody = (await choices.nth(1).innerText()).split(' · ')[0]!;
  await page.keyboard.press('ArrowDown'); await expect(choices.nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(chooser).not.toBeVisible(); await expect(page.locator('#inspector').getByRole('heading', { name: nextBody, exact: true })).toBeVisible();
  await expect(page.locator('.scene-canvas canvas')).toBeFocused(); await expect(page.locator('.context-details')).toContainText('08 Apr 2024');
});

test('a translucent Earth permits choosing the actual body behind it', async ({ page }) => {
  const instantMs = Date.UTC(2000, 0, 1, 12);
  const first = engine.calculate(instantMs, { latitudeDeg: 0, longitudeDeg: 0 });
  const sun = first.bodies.find(body => body.id === 'sun')!;
  const latitude = -sun.equatorial.declinationDeg;
  const longitude = normalizeDegrees(sun.equatorial.rightAscensionDeg - first.greenwichSiderealTimeDeg + 180 + 180) - 180;
  await birth(page, '2000-01-01', '12:00:00', latitude, longitude);
  await openControlGroup(page, 'references'); await page.locator('.feature-list').getByRole('button', { name: /^Earth/ }).click();
  await page.getByRole('button', { name: 'Focus selected feature', exact: true }).click();
  const canvas = page.locator('.scene-canvas canvas'), box = await canvas.boundingBox(); if (!box) throw new Error('Missing canvas.');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#inspector').getByRole('heading', { name: 'Sun', exact: true })).not.toBeVisible();
  const before = await page.locator('.context-details').innerText();
  await openControlGroup(page, 'display'); await range(page, 'Earth opacity', '0.3');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const chooser = page.getByRole('dialog', { name: 'Choose a nearby feature', exact: true });
  await expect(chooser).toBeVisible(); await chooser.getByRole('button', { name: /^Sun/ }).click();
  await expect(page.locator('#inspector').getByRole('heading', { name: 'Sun', exact: true })).toBeVisible();
  expect(await page.locator('.context-details').innerText()).toBe(before);
});

test('Melbourne1987 renders the linked Taurus label at its native-frame anchor and identifies the unselected Sun', async ({ page }) => {
  // Observe real WebGL sprite submissions, without adding a production test API.
  await page.addInitScript(() => {
    const probe = (window as any).tropicalLabelProbe = { draws: [] as number[][], labels: [] as string[] };
    const text = new WeakMap<HTMLCanvasElement, string>();
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args: any[]) {
      text.set(this.canvas, String(args[0])); return (fillText as any).apply(this, args);
    };
    const states = new WeakMap<WebGL2RenderingContext, any>();
    const state = (gl: WebGL2RenderingContext) => {
      let value = states.get(gl);
      if (!value) { value = { unit: 0, program: null, textures: new Map(), text: new WeakMap(), locations: new WeakMap(), matrices: new Map(), samplers: new Map() }; states.set(gl, value); }
      return value;
    };
    const proto = WebGL2RenderingContext.prototype as any;
    const wrap = (name: string, before: (gl: WebGL2RenderingContext, args: any[]) => void) => {
      const original = proto[name];
      proto[name] = function (...args: any[]) { before(this, args); return original.apply(this, args); };
    };
    wrap('activeTexture', (gl, args) => { state(gl).unit = args[0] - gl.TEXTURE0; });
    wrap('bindTexture', (gl, args) => { if (args[0] === gl.TEXTURE_2D) state(gl).textures.set(state(gl).unit, args[1]); });
    wrap('useProgram', (gl, args) => { state(gl).program = args[0]; });
    const getLocation = proto.getUniformLocation;
    proto.getUniformLocation = function (program: WebGLProgram, name: string) {
      const location = getLocation.call(this, program, name);
      if (location) state(this).locations.set(location, { program, name }); return location;
    };
    wrap('uniformMatrix4fv', (gl, args) => { const info = state(gl).locations.get(args[0]); if (info?.name === 'modelViewMatrix') state(gl).matrices.set(info.program, Array.from(args[2])); });
    wrap('uniform1i', (gl, args) => { const info = state(gl).locations.get(args[0]); if (info?.name === 'map') state(gl).samplers.set(info.program, args[1]); });
    for (const method of ['texImage2D', 'texSubImage2D']) wrap(method, (gl, args) => {
      const source = args.find(value => value instanceof HTMLCanvasElement), texture = state(gl).textures.get(state(gl).unit);
      if (source && texture) state(gl).text.set(texture, text.get(source));
    });
    for (const method of ['drawElements', 'drawElementsInstanced', 'drawArrays', 'drawArraysInstanced']) wrap(method, gl => {
      const current = state(gl);
      if (!current.samplers.has(current.program)) return;
      const texture = current.textures.get(current.samplers.get(current.program));
      const matrix = current.matrices.get(current.program);
      const caption = texture && current.text.get(texture);
      if (caption && matrix) { probe.labels.push(caption); if (probe.labels.length > 128) probe.labels.shift(); }
      if (texture && current.text.get(texture) === '♉' && matrix) { probe.draws.push(matrix); if (probe.draws.length > 32) probe.draws.shift(); }
    });
  });
  await birth(page, '1987-04-27', '02:00:00', -37.814, 144.96332, 'Australia/Melbourne');
  await expect(page.locator('.context-details')).toContainText('26 Apr 1987');
  await expect(page.locator('.context-details')).toContainText('16:00:00 UTC');
  await expect(page.getByTestId('displayed-local-moment')).toHaveText('1987-04-27 · 02:00:00 local');
  await expect.poll(() => page.evaluate(() => (window as any).tropicalLabelProbe.labels.includes('☉ Sun · Taurus 5.89°'))).toBe(true);
  await openControlGroup(page, 'references');
  await page.getByRole('button', {name:'Sagittarius 30° sector',exact:true}).click();
  await expect(page.locator('#inspector .selected-heading')).toContainText('Sagittarius');
  await expect.poll(() => page.evaluate(() => (window as any).tropicalLabelProbe.labels.includes('♐ Sagittarius · sign'))).toBe(true);
  expect(await page.locator('.scene-canvas canvas').evaluate(async element=>{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return (element as HTMLCanvasElement).getContext('webgl2')!.getError();
  })).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).tropicalLabelProbe.labels.includes('☉ Sun · Taurus 5.89°'))).toBe(true);
  await page.evaluate(() => { (window as any).tropicalLabelProbe.draws = []; });
  await page.locator('.object-list').getByRole('button', { name: /^Sun/ }).click();
  await expect(page.locator('#inspector .selected-heading')).toContainText('Taurus');
  // The old exterior-hemisphere culling never submitted this linked glyph.
  await expect.poll(() => page.evaluate(() => (window as any).tropicalLabelProbe.draws.length)).toBeGreaterThan(0);
  expect(await page.locator('.scene-canvas canvas').evaluate(async element=>{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return (element as HTMLCanvasElement).getContext('webgl2')!.getError();
  })).toBe(0);
  const matrix = await page.evaluate(() => (window as any).tropicalLabelProbe.draws.at(-1) as number[]);
  const box = await page.locator('.scene-canvas canvas').boundingBox(); if (!box) throw new Error('Missing canvas.');
  const camera = new THREE.PerspectiveCamera(43, box.width / box.height, 0.015, 100);
  const vertical = THREE.MathUtils.degToRad(43), horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  camera.position.copy(new THREE.Vector3(7.2, 4.8, 9.4).normalize().multiplyScalar(5.8 * 1.08 / Math.sin(Math.min(vertical, horizontal) / 2)));
  camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const snapshot = engine.calculate(Date.UTC(1987, 3, 26, 16), { latitudeDeg: -37.814, longitudeDeg: 144.96332 });
  const direction = astronomicalToThree(eclipticDirection(snapshot, 45, 5));
  const expected = new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(5.8);
  const actual = new THREE.Vector3(matrix[12], matrix[13], matrix[14]).applyMatrix4(camera.matrixWorld);
  expect(actual.distanceTo(expected)).toBeLessThan(0.00001);
  const sun = snapshot.bodies.find(body => body.id === 'sun')!;
  expect(sun.longitudeDeg).toBeCloseTo(35.89199283139494, 8);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  const clearBox = await page.locator('.scene-canvas canvas').boundingBox(); if (!clearBox) throw new Error('Missing canvas.');
  camera.aspect = clearBox.width / clearBox.height; camera.updateProjectionMatrix();
  const value = astronomicalToThree(equatorialToVector(sun.fixedEquatorial));
  const screen = new THREE.Vector3(value.x, value.y, value.z).multiplyScalar(5.8).project(camera);
  await page.mouse.move(clearBox.x + (screen.x + 1) * clearBox.width / 2, clearBox.y + (1 - screen.y) * clearBox.height / 2);
  await expect(page.getByTestId('scene-hover')).toContainText('Sun · Taurus 5.89° · below horizon');
  // Keyboard activation changes the snapshot while the physical pointer stays
  // over the marker. Its tooltip must describe the new calculation immediately.
  await page.getByLabel('Step unit', { exact: true }).selectOption('hour');
  await page.getByRole('button', { name: 'Next hour', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.context-details')).toContainText('17:00:00 UTC');
  const nextSun = engine.calculate(snapshot.instantMs + 3600000, snapshot.observer).bodies.find(body => body.id === 'sun')!;
  await expect(page.getByTestId('scene-hover')).toContainText(`Sun · Taurus ${(nextSun.longitudeDeg % 30).toFixed(2)}°`);
  await page.locator('details[data-control-group="layers"] > summary').focus(); await page.keyboard.press('Enter');
  await page.getByLabel('Celestial bodies', { exact: true }).focus(); await page.keyboard.press('Space');
  await expect(page.getByTestId('scene-hover')).toHaveCount(0);
});

test('Melbourne local birth date remains prominent when its UTC date is the previous day',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/Enter a birth moment/}).click();
  await page.getByLabel('Gregorian date (local)').fill('1987-04-27');
  await page.getByLabel('Time (local)',{exact:true}).fill('02:00:00');
  await page.getByLabel('Latitude · north positive').fill('-37.814');
  await page.getByLabel('Longitude · east positive').fill('144.96332');
  await page.getByLabel('IANA time zone',{exact:true}).fill('Australia/Melbourne');
  await page.getByLabel('Confirm this time zone for the entered coordinates').check();
  const preview=page.locator('.resolved-moment');
  await expect(preview).toContainText('1987-04-27 · 02:00:00 local');
  await expect(preview).toContainText('1987-04-26 · 16:00:00 UTC');
  await expect(preview).toContainText('same moment on a different UTC calendar date');
  await page.getByRole('button',{name:/Set birth anchor/}).click();
  await expect(page.getByTestId('displayed-local-moment')).toHaveText('1987-04-27 · 02:00:00 local');
  await expect(page.getByTestId('displayed-utc-moment')).toHaveText('26 Apr 1987 · 16:00:00 UTC · UTC+10:00');
  await expect(page.locator('.birth-anchor-section')).toContainText('1987-04-27 · 02:00:00 local');
  await page.locator('.object-list').getByRole('button',{name:/^Sun/}).click();
  await expect(page.locator('#inspector .selected-heading')).toContainText('Taurus');
});
