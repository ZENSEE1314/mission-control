// Daily cron: keeps OpenClaw at the target version on Render
import { execSync } from 'child_process';

const target = process.env.OPENCLAW_VERSION || '2026.3.22';

try {
  const current = execSync('npx openclaw --version 2>/dev/null || echo none')
    .toString().trim();

  if (current === target) {
    console.log(`OpenClaw ${target} already installed — skipping.`);
    process.exit(0);
  }

  console.log(`Updating OpenClaw from ${current} to ${target} ...`);
  execSync(`npm install -g openclaw@${target}`, { stdio: 'inherit' });
  console.log(`OpenClaw ${target} installed.`);
} catch (e) {
  console.log(`Could not check version, installing ${target} ...`);
  execSync(`npm install -g openclaw@${target}`, { stdio: 'inherit' });
  console.log('Done.');
}
