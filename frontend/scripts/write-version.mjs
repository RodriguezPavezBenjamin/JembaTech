import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function version(commit = process.env.RAILWAY_GIT_COMMIT_SHA || 'local') {
  if (commit !== 'local' && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Commit de build inválido.');
  return { service: 'jemba-web', commit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('../dist/jemba-cotiza/browser/version.json', import.meta.url), JSON.stringify(version()) + '\n');
}
