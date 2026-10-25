import {expect,test,type Page} from '@playwright/test';

async function observeCamera(page:Page){
  await page.addInitScript(()=>{
    const state=(window as any).cameraProbe={view:[]as number[],uploads:0,cancelBefore:[]as number[],watchCancellation:false};
    const beforeCancel=()=>{if(state.watchCancellation){state.watchCancellation=false;state.cancelBefore=[...state.view];}};
    window.addEventListener('blur',beforeCancel,{capture:true});
    window.addEventListener('lostpointercapture',beforeCancel,{capture:true});
    const locations=new WeakSet<WebGLUniformLocation>();
    const proto=WebGL2RenderingContext.prototype;
    const location=proto.getUniformLocation;
    proto.getUniformLocation=function(program,name){const value=location.call(this,program,name);if(value&&name==='viewMatrix')locations.add(value);return value;};
    const matrix=proto.uniformMatrix4fv;
    proto.uniformMatrix4fv=function(...args:Parameters<typeof matrix>){if(args[0]&&locations.has(args[0])){state.view=Array.from(args[2]);state.uploads++;}return Reflect.apply(matrix,this,args);};
  });
}

test('right-drag leaves the overview camera anchored to its target',async({page})=>{
  await observeCamera(page);
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).cameraProbe.view.length)).toBe(16);
  const before=await page.evaluate(()=>(window as any).cameraProbe.view);
  const context=await page.locator('.context-details').innerText();
  const box=await page.locator('.scene-canvas canvas').boundingBox();if(!box)throw new Error('Missing canvas.');
  await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down({button:'right'});
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55,{steps:5});await page.mouse.up({button:'right'});
  await page.mouse.move(5,5);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>(window as any).cameraProbe.view)).toEqual(before);
  expect(await page.locator('.context-details').innerText()).toBe(context);
});

test('exterior blur and middle-button capture loss preserve pose and clear residual damping',async({page})=>{
  await observeCamera(page);
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  const canvas=page.locator('.scene-canvas canvas');
  const context=await page.locator('.context-details').innerText();
  for(const viewpoint of ['Earth overview','Outside sphere'])for(const button of ['left','middle']as const){
    await page.getByRole('button',{name:viewpoint,exact:true}).click();
    const box=await canvas.boundingBox();if(!box)throw new Error('Missing canvas.');
    await canvas.evaluate(element=>element.addEventListener('pointerdown',event=>{(window as any).ownedPointer=(event as PointerEvent).pointerId;},{once:true}));
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down({button});
    await page.mouse.move(box.x+box.width*.55,box.y+box.height*.5,{steps:2});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.evaluate(()=>(window as any).cameraProbe.watchCancellation=true);
    if(button==='left')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    else await canvas.evaluate(element=>element.releasePointerCapture((window as any).ownedPointer));
    await page.mouse.move(box.x+box.width*.6,box.y+box.height*.55,{steps:2});
    await page.mouse.up({button});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const comparison=await page.evaluate(()=>({before:(window as any).cameraProbe.cancelBefore as number[],after:(window as any).cameraProbe.view as number[]}));
    expect(comparison.before).toHaveLength(16);
    expect(Math.hypot(...comparison.after.map((value,index)=>value-comparison.before[index]!))).toBeLessThan(.00001);
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.44,box.y+box.height*.42,{steps:2});await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>(window as any).cameraProbe.view)).not.toEqual(comparison.after);
  }
  expect(await page.locator('.context-details').innerText()).toBe(context);
});

test('context loss preserves an explicitly moved exterior camera through real restoration',async({page})=>{
  await observeCamera(page);
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  const canvas=page.locator('.scene-canvas canvas');
  for(const viewpoint of ['Earth overview','Outside sphere']){
    await page.getByRole('button',{name:viewpoint,exact:true}).click();
    await canvas.focus();await page.keyboard.press('ArrowRight');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const before=await page.evaluate(()=>(window as any).cameraProbe.view as number[]);
    const uploads=await page.evaluate(()=>(window as any).cameraProbe.uploads);
    const supported=await canvas.evaluate(element=>{
      const extension=(element as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context');
      (window as any).poseRecovery=extension;extension?.loseContext();return Boolean(extension);
    });
    test.skip(!supported,'Driver has no context-loss simulation.');
    await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeDisabled();
    await page.evaluate(()=>(window as any).poseRecovery.restoreContext());
    await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeEnabled();
    await expect.poll(()=>page.evaluate(()=>(window as any).cameraProbe.uploads)).toBeGreaterThan(uploads);
    const after=await page.evaluate(()=>(window as any).cameraProbe.view as number[]);
    expect(Math.hypot(...after.map((value,index)=>value-before[index]!))).toBeLessThan(.00001);
  }
});

test('blur and lost capture cancel observer gestures and allow the next drag',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:/Explore example/}).click();
  await expect(page.getByText('Moment calculated',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Return to observer',exact:true}).click();
  const context=await page.locator('.context-details').innerText();
  const canvas=page.locator('.scene-canvas canvas'),hud=page.locator('.orientation-hud');
  const box=await canvas.boundingBox();if(!box)throw new Error('Missing canvas.');
  for(const cancellation of ['blur','capture']){
    await canvas.evaluate(element=>element.addEventListener('pointerdown',event=>{(window as any).ownedPointer=(event as PointerEvent).pointerId;},{once:true}));
    const before=(await hud.textContent())!;
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.48,box.y+box.height*.44,{steps:3});
    await expect(hud).not.toHaveText(before);const stopped=(await hud.textContent())!;
    if(cancellation==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    else await canvas.evaluate(element=>element.releasePointerCapture((window as any).ownedPointer));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:3});
    await expect(hud).toHaveText(stopped);await page.mouse.up();
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.4);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.44,box.y+box.height*.42,{steps:2});await page.mouse.up();
    await expect(hud).not.toHaveText(stopped);
  }
  expect(await page.locator('.context-details').innerText()).toBe(context);
});
