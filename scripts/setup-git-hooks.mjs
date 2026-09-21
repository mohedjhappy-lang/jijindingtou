import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join } from 'node:path';

const gitDir = join(process.cwd(), '.git');
if (!existsSync(gitDir)) {
  console.log('⚠️  未检测到 .git 目录，跳过 git hooks 安装');
  process.exit(0);
}

const hooksDir = join(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });

const precommitHook = join(hooksDir, 'pre-commit');
const script = `#!/usr/bin/env bash
npm run precommit
`;

writeFileSync(precommitHook, script, 'utf-8');
chmodSync(precommitHook, 0o755);

console.log('✅ Git hooks 已安装');
