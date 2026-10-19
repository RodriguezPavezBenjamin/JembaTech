import { PrecioConsultado } from './catalogo';
export type SourceCategory = 'cpu' | 'gpu' | 'motherboard' | 'ram' | 'storage';
export interface PriceTarget { id: string; label: string; productId: number; partNumber: string | null; priceInfo: PrecioConsultado | null }
export interface PriceRecovery { runId: string; target: string; received: number; accepted: number; rejected: number; priceInfo: PrecioConsultado | null; applied: boolean }
export interface SourceTarget { id: string; category: SourceCategory; brand: string; label: string }
export interface SourceMetrics {
  received: number; accepted: number; rejected: number; duplicates: number;
  validPercent: number; duplicatePercent: number; missingTdp: number; processingMs: number;
  category?: SourceCategory;
  kind?: 'price-quote';
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
  category: SourceCategory;
  specs: {
    socket?: string; cores?: number; threads?: number; performanceCores?: number; efficiencyCores?: number;
    declaredTdpWatts: number | null; chip?: string; chipBrand?: string;
    vramGb?: number; memoryType?: string; lengthMm?: number | null; slots?: number | null; bus?: string | null;
    chipset?: string; formFactor?: string; ramType?: string; ramSlots?: number; m2Slots?: number | null; sataPorts?: number | null;
    capacityGb?: number; moduleCapacityGb?: number; modules?: number; speedMt?: number; casLatency?: number | null;
    storageType?: 'HDD' | 'SSD'; interface?: string; connector?: string | null; rpm?: number | null;
    readMbps?: number | null; writeMbps?: number | null; protocol?: string | null;
  };
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
export interface CatalogImportOverview {
  caps: Record<string, number>;
  counts: Record<string, number>;
  targets: Array<{ id: string; category: string; query: string; take: number; lastImport: { at: string; count: number } | null }>;
}
