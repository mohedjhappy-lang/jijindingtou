import { spawn } from 'node:child_process';

const args = process.argv.slice(2);

const child = spawn('vite', args, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
