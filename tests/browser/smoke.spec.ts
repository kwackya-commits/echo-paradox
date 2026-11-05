import {test,expect} from '@playwright/test';
test('MVP boots, moves, creates exact echo and restarts',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?qa');await expect(page.getByRole('button',{name:'새로운 시간선'})).toBeVisible();
  await page.screenshot({path:'tests/menu.png'});
  await page.getByRole('button',{name:'새로운 시간선'}).click();
  await expect(page.locator('.hud-left h2')).toHaveText('첫 번째 나');
  const before=await page.evaluate(()=>(window as any).__ECHO__.sim.x);
  await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');
  expect(await page.evaluate(()=>(window as any).__ECHO__.sim.x)).toBeGreaterThan(before+15);
  await page.evaluate(()=>{const q=(window as any).__ECHO__;q.step({x:0,y:0},600-q.sim.echo.recording.length);});
  expect(await page.evaluate(()=>(window as any).__ECHO__.sim.echo.echoes[0].frames.length)).toBe(600);
  await page.screenshot({path:'tests/mvp.png'});
  await page.keyboard.press('Escape');await expect(page.getByText('시간선 일시정지')).toBeVisible();
  await page.getByRole('button',{name:'처음부터 다시'}).click();
  expect(await page.evaluate(()=>(window as any).__ECHO__.sim.hp)).toBe(3);
  await page.setViewportSize({width:390,height:844});await expect(page.locator('.hud-left h2')).toBeVisible();
  expect(errors).toEqual([]);
});
