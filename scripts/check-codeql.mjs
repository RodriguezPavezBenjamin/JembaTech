import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function resolveRule(run, result) {
  const driver = run.tool.driver;
  const extensions = run.tool.extensions ?? [];
  if (!Array.isArray(extensions)) throw new Error('Extensiones SARIF inválidas.');
  const reference = result.rule?.toolComponent;
  let component = driver;
  if (reference?.index !== undefined) {
    if (!Number.isInteger(reference.index) || reference.index < 0 || !extensions[reference.index]) {
      throw new Error('Componente de regla no verificable.');
    }
    component = extensions[reference.index];
  } else if (reference?.guid !== undefined) {
    const matches = [driver, ...extensions].filter(item => item.guid === reference.guid);
    if (typeof reference.guid !== 'string' || !reference.guid || matches.length !== 1) {
      throw new Error('GUID de componente no verificable.');
    }
    [component] = matches;
  }
  if ((reference?.guid !== undefined && reference.guid !== component.guid)
      || (reference?.name !== undefined && reference.name !== component.name)) {
    throw new Error('Identidad de componente contradictoria.');
  }
  if (!Array.isArray(component.rules)) throw new Error('Faltan reglas del componente.');
  if ((result.ruleId !== undefined && result.rule?.id !== undefined && result.ruleId !== result.rule.id)
      || (result.ruleIndex !== undefined && result.rule?.index !== undefined && result.ruleIndex !== result.rule.index)) {
    throw new Error('Referencias de regla contradictorias.');
  }
  const id = result.rule?.id ?? result.ruleId;
  const index = result.rule?.index ?? result.ruleIndex;
  if (id !== undefined && (typeof id !== 'string' || !id)) throw new Error('ID de regla inválido.');
  let rule;
  if (index !== undefined) {
    if (!Number.isInteger(index) || index < 0) throw new Error('Índice de regla inválido.');
    rule = component.rules[index];
    if (rule && id !== undefined && rule.id !== id) throw new Error('ID e índice de regla contradictorios.');
  } else if (id !== undefined) {
    const matches = component.rules.filter(item => item.id === id);
    if (matches.length === 1) [rule] = matches;
  }
  if (!rule || typeof rule.id !== 'string' || !rule.id) throw new Error('Hallazgo sin regla verificable.');
  return rule;
}

export function highSecurityFindings(report) {
  if (report?.version !== '2.1.0' || !Array.isArray(report.runs) || !report.runs.length) {
    throw new Error('Reporte SARIF inválido o incompleto.');
  }
  const findings = [];
  for (const run of report.runs) {
    if (!Array.isArray(run.results) || !run.tool?.driver || typeof run.tool.driver !== 'object'
        || Array.isArray(run.tool.driver)
        || (run.tool.driver.rules !== undefined && !Array.isArray(run.tool.driver.rules))
        || (run.tool.extensions !== undefined && !Array.isArray(run.tool.extensions))) {
      throw new Error('Faltan resultados o reglas del análisis.');
    }
    if (run.invocations?.some(invocation => invocation.executionSuccessful === false)) {
      throw new Error('El analizador no terminó correctamente.');
    }
    for (const result of run.results) {
      const rule = resolveRule(run, result);
      const declared = rule.properties?.['security-severity'];
      if (declared === undefined && rule.properties?.tags?.includes('security')) {
        throw new Error('Regla de seguridad sin severidad.');
      }
      if (declared !== undefined && ((typeof declared !== 'string' && typeof declared !== 'number')
          || (typeof declared === 'string' && !declared.trim()))) {
        throw new Error('Severidad de seguridad inválida.');
      }
      const severity = Number(declared ?? 0);
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
