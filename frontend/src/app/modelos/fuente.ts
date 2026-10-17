export interface SourceMetrics {
  received: number; accepted: number; rejected: number; duplicates: number;
  validPercent: number; duplicatePercent: number; missingTdp: number; processingMs: number;
}
export interface SourceRun {
  id: string; source: string; mode: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  retrievedAt: string; startedAt: string; finishedAt: string | null;
  metrics: SourceMetrics | null; storedCount: number; staleSkipped: number; errorCode: string | null;
  issues: Array<{ index: number; code: string; fields: string[] }> | null;
  sourceRequestUrl?: string | null; retrievalMs?: number | null; durationMs?: number | null;
}
export interface ExternalReference {
  id: string; externalId: string; name: string; brand: string; partNumber: string | null;
  specs: { socket: string; cores: number; threads: number; declaredTdpWatts: number | null };
  sourceUrl: string; retrievedAt: string; sourceUpdatedAt: string | null;
  contentHash: string; accessStatus: string; acquisitionMode: string; internalCatalogId: string | null;
}
export interface SourceOverview {
  source: string; accessStatus: string; mode: string; synchronizationEnabled: boolean;
  manualProbeEnabled: boolean; nextAllowedAt: string | null; probeRunning: boolean;
  referenceCount: number; runCount: number;
  latestRun: { id: string; mode?: string; status: string; startedAt: string; metrics: SourceMetrics | null } | null;
}
export interface ReferencePage { items: ExternalReference[]; total: number; page: number; pageSize: number }
