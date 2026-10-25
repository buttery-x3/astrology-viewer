import {spawnSync} from 'node:child_process';
import path from 'node:path';
const result=spawnSync(process.execPath,['node_modules/playwright/cli.js','test',...process.argv.slice(2)],{
  stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH??path.resolve('.cache/playwright')},
});
process.exit(result.status??1);
