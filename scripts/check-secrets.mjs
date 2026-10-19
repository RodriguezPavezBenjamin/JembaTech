import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkSecretResults(jsonl, baseline, scannerExit) {
  if (![0, 183].includes(scannerExit)) throw new Error('El escáner de secretos no terminó correctamente.');
  if (baseline?.version !== 1 || !Array.isArray(baseline.findings)) throw new Error('Baseline de secretos inválida.');
  for (const entry of baseline.findings) {
    if (!['Postgres', 'URI'].includes(entry.detector) || !/^[a-f0-9]{40}$/.test(entry.commit)
        || typeof entry.file !== 'string' || !entry.file || !Number.isInteger(entry.line) || entry.line < 1
        || !/^[a-f0-9]{64}$/.test(entry.sha256) || typeof entry.reason !== 'string' || !entry.reason) {
      throw new Error('Entrada histórica sin identidad verificable.');
    }
  }
  const rows = jsonl.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  // --fail da 183 con resultados; un código incoherente nunca se toma como limpio.
  if ((rows.length > 0) !== (scannerExit === 183)) throw new Error('Resultado y estado del escáner inconsistentes.');
  const blocked = [];
  let acceptedHistoricalQa = 0;
  for (const row of rows) {
    const git = row.SourceMetadata?.Data?.Git;
    if (typeof row.DetectorName !== 'string' || !row.DetectorName
        || typeof row.Verified !== 'boolean' || typeof row.Raw !== 'string' || !row.Raw || !git
        || typeof git.file !== 'string' || !/^[a-f0-9]{40}$/.test(git.commit)
        || !Number.isInteger(git.line) || git.line < 1) {
      throw new Error('Hallazgo de secretos incompleto.');
    }
    const fingerprint = createHash('sha256').update(row.Raw).digest('hex');
    const accepted = row.Verified === false && baseline.findings.some(entry =>
      entry.detector === row.DetectorName && entry.commit === git.commit
      && entry.file === git.file && entry.line === git.line && entry.sha256 === fingerprint);
    if (accepted) acceptedHistoricalQa++;
    else blocked.push({ detector: row.DetectorName, file: git.file, line: git.line, verified: row.Verified });
  }
  return { scanner: 'TruffleHog', findings: rows.length, acceptedHistoricalQa, blocked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4 || !/^(0|183|[1-9]\d*)$/.test(process.argv[3])) throw new Error('Argumentos inválidos.');
    const baseline = JSON.parse(readFileSync(new URL('../.github/security/secret-baseline.json', import.meta.url), 'utf8'));
    const result = checkSecretResults(readFileSync(process.argv[2], 'utf8'), baseline, Number(process.argv[3]));
    console.log(JSON.stringify(result));
    if (result.blocked.length) process.exitCode = 1;
  } catch {
    // No imprimir JSONL, Raw, errores del parser o diagnósticos con credenciales.
    console.error('No se pudo validar el escaneo de secretos. Revisar ejecución y formato, sin publicar valores sensibles.');
    process.exitCode = 1;
  }
}
