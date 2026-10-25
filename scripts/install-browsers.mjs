import path from 'node:path';
import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['node_modules/playwright/cli.js','install',...process.argv.slice(2).length?process.argv.slice(2):['chromium']],{
  stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH??path.resolve('.cache/playwright')},
});
process.exit(result.status??1);
