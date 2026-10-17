import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function highSecurityFindings(report) {
  if (report?.version !== '2.1.0' || !Array.isArray(report.runs) || !report.runs.length) {
    throw new Error('Reporte SARIF inválido o incompleto.');
  }
  const findings = [];
  for (const run of report.runs) {
    if (!Array.isArray(run.results) || !Array.isArray(run.tool?.driver?.rules)) {
      throw new Error('Faltan resultados o reglas del análisis.');
    }
    if (run.invocations?.some(invocation => invocation.executionSuccessful === false)) {
      throw new Error('El analizador no terminó correctamente.');
    }
    for (const result of run.results) {
      const rule = run.tool.driver.rules.find(item => item.id === result.ruleId)
        ?? run.tool.driver.rules[result.ruleIndex];
      if (!rule) throw new Error('Hallazgo sin regla verificable.');
      const severity = Number(rule.properties?.['security-severity'] ?? 0);
      if (!Number.isFinite(severity) || severity < 0 || severity > 10) {
        throw new Error('Severidad de seguridad inválida.');
      }
      if (severity >= 7) findings.push({ ruleId: rule.id, severity });
    }
  }
  return findings;
}

export function checkReports(directory) {
  const files = readdirSync(directory).filter(file => file.endsWith('.sarif'));
  if (!files.length) throw new Error('No se generaron reportes SARIF.');
  return files.flatMap(file => highSecurityFindings(JSON.parse(readFileSync(join(directory, file), 'utf8'))));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const findings = checkReports(process.argv[2] ?? 'reports/codeql');
    console.log(JSON.stringify({ scanner: 'CodeQL', highOrCritical: findings.length, findings }));
    if (findings.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
