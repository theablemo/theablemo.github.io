import { spawn } from 'node:child_process';
// Drafts are opt-in and DEV-only. A production build ignores SHOW_DRAFTS.
const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', '--port', '4326'], {
  stdio: 'inherit', env: { ...process.env, SHOW_DRAFTS: 'true' },
});
child.on('exit', code => process.exit(code ?? 1));
child.on('error', error => { console.error(error.message); process.exit(1); });
