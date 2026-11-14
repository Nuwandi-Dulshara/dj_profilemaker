import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
async function run(executable, args) {
  const child = spawn(executable, args, { stdio: 'inherit', cwd: root, windowsHide: true });
  return new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', (code) => resolve(code ?? 1)); });
}
if (process.argv[2] === 'serve') {
  process.exitCode = await run(python, ['backend/manage.py', 'runserver', '127.0.0.1:18000', '--noreload', '--settings=config.e2e_settings']);
} else {
  const prepared = await run(python, ['backend/prepare_e2e.py']);
  process.exitCode = prepared || await run(process.execPath, [path.join(root, 'frontend/node_modules/@playwright/test/cli.js'), 'test', '--config', path.join(root, 'frontend/playwright.config.ts'), ...process.argv.slice(2)]);
}
