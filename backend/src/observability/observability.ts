import { HttpService } from '@nestjs/axios';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';
import type { AxiosRequestConfig } from 'axios';
import { firstValueFrom } from 'rxjs';

const context = new AsyncLocalStorage<{ requestId: string }>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const operations = new Set(['/evaluate', '/builds/preview', '/sources/solotodo/cpu/normalize', '/sources/solotodo/cpu/recover', '/sources/solotodo/components/normalize', '/sources/solotodo/components/recover', '/sources/solotodo/prices/recover', '/sources/solotodo/catalog/recover']);

export function requestIdFrom(value: unknown): string {
  return typeof value === 'string' && uuid.test(value) ? value.toLowerCase() : randomUUID();
}
export function currentRequestId() { return context.getStore()?.requestId ?? null; }
export function withRequestId<T>(requestId: string, callback: () => T): T {
  return context.run({ requestId: requestIdFrom(requestId) }, callback);
}
export function emitEvent(event: Record<string, unknown>) {
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), service: 'jemba-api', ...event }) + '\n');
}

interface Measurement { count: number; errors: number; clientErrors: number; aborted: number; totalMs: number; maxMs: number }
export class RequestMetrics {
  private readonly started = performance.now();
  private readonly inbound = new Map<string, Measurement>();
  private readonly python = new Map<string, Measurement>();
  record(kind: 'inbound' | 'python', label: string, durationMs: number, status: number, aborted = false) {
    const map = kind === 'inbound' ? this.inbound : this.python;
    // Rutas plantilla, nunca URL/query/ID. Límite de memoria y cardinalidad por proceso.
    const key = map.has(label) || map.size < 63 ? label : 'OTHER';
    const item = map.get(key) ?? { count: 0, errors: 0, clientErrors: 0, aborted: 0, totalMs: 0, maxMs: 0 };
    const elapsed = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    item.count++;
    if (status >= 500 || status === 0) item.errors++;
    if (status >= 400 && status < 500) item.clientErrors++;
    if (aborted) item.aborted++;
    item.totalMs += elapsed;
    item.maxMs = Math.max(item.maxMs, elapsed);
    map.set(key, item);
  }
  snapshot() {
    const project = (map: Map<string, Measurement>) => [...map.entries()].map(([route, item]) => ({
      route, ...item, totalMs: Number(item.totalMs.toFixed(3)),
      maxMs: Number(item.maxMs.toFixed(3)), averageMs: Number((item.totalMs / item.count).toFixed(3)),
    })).sort((a, b) => a.route.localeCompare(b.route));
    return { service: 'jemba-api', scope: 'single-process', resetsOnRestart: true, durationUnit: 'ms',
      uptimeSeconds: Math.floor((performance.now() - this.started) / 1000),
      inbound: project(this.inbound), python: project(this.python) };
  }
}
export const requestMetrics = new RequestMetrics();

export function createRequestMiddleware(metrics = requestMetrics) {
  return (request: Request, response: Response, next: NextFunction) => {
    const requestId = requestIdFrom(request.headers['x-request-id']);
    const start = performance.now();
    const method = methods.has(request.method) ? request.method : 'OTHER';
    response.setHeader('X-Request-Id', requestId);
    let recorded = false;
    const finish = (aborted: boolean) => {
      if (recorded) return;
      recorded = true;
      const route = typeof request.route?.path === 'string' ? request.route.path : 'unmatched';
      const status = aborted ? 0 : response.statusCode;
      const durationMs = Number((performance.now() - start).toFixed(3));
      metrics.record('inbound', `${method} ${route}`, durationMs, status, aborted);
      emitEvent({ event: 'http_request', requestId, method, route, status, durationMs, aborted,
        ...(status >= 500 ? { code: 'HTTP_SERVER_ERROR' } : {}) });
    };
    response.once('finish', () => finish(false));
    response.once('close', () => finish(!response.writableFinished));
    withRequestId(requestId, next);
  };
}

export async function pythonPost<T>(http: HttpService, url: string, body: unknown, options: AxiosRequestConfig) {
  const requestId = currentRequestId();
  let operation = 'OTHER';
  try { const path = new URL(url).pathname; if (operations.has(path)) operation = path; } catch { /* Nunca registrar URLs del entorno. */ }
  const start = performance.now();
  let status = 0;
  let code: string | undefined;
  let correlated = false;
  try {
    const result = await firstValueFrom(http.post<T>(url, body, {
      ...options, headers: { ...options.headers, ...(requestId ? { 'X-Request-Id': requestId } : {}) },
    }));
    status = result.status ?? 200;
    correlated = !!requestId && result.headers?.['x-request-id'] === requestId;
    return result;
  } catch (error) {
    const failure = error as { code?: string; response?: { status?: number; headers?: Record<string, unknown> } };
    const receivedStatus = failure.response?.status ?? 0;
    status = Number.isInteger(receivedStatus) && receivedStatus >= 100 && receivedStatus <= 599 ? receivedStatus : 0;
    correlated = !!requestId && failure.response?.headers?.['x-request-id'] === requestId;
    code = ['ECONNABORTED', 'ETIMEDOUT'].includes(failure.code ?? '') ? 'PYTHON_TIMEOUT'
      : status ? 'PYTHON_HTTP_ERROR' : 'PYTHON_UNAVAILABLE';
    throw error;
  } finally {
    const durationMs = Number((performance.now() - start).toFixed(3));
    requestMetrics.record('python', operation, durationMs, status);
    emitEvent({ event: 'python_request', requestId, operation, status, durationMs, correlated, ...(code ? { code } : {}) });
  }
}
