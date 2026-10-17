import { Producto } from './catalogo';

export type EstadoCotizacion = 'DRAFT' | 'REQUESTED' | 'REVIEWING' | 'SCHEDULED' | 'COMPLETED' | 'EXPIRED';
export interface ConfiguracionGuardada {
  budget: number;
  intended_use: string;
  catalog_version: string;
  components: Array<Producto & { quantity: number }>;
}
export interface Cotizacion {
  id: string;
  name?: string | null;
  intendedUse: string;
  budget: number;
  totalPrice: number;
  ramGb: number;
  storageGb: number;
  psuWatts: number;
  estimatedConsumptionWatts: number;
  recommendedPsuWatts?: number | null;
  score: number;
  level: string;
  explanation: string;
  warnings: string[];
  recommendations: string[];
  configuration?: ConfiguracionGuardada | null;
  status: EstadoCotizacion;
  contactPhone?: string | null;
  serviceAddress?: string | null;
  preferredDate?: string | null;
  customerNote?: string | null;
  adminNote?: string | null;
  requestDeletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
}
export const ESTADOS: Record<EstadoCotizacion, string> = {
  DRAFT: 'GUARDADA', REQUESTED: 'SOLICITADA', REVIEWING: 'EN REVISIÓN',
  SCHEDULED: 'AGENDADA', COMPLETED: 'COMPLETADA', EXPIRED: 'CERRADA',
};
export function estadoCotizacion(quote: Cotizacion) {
  return quote.requestDeletedAt ? 'CONSULTA RETIRADA' : ESTADOS[quote.status] ?? quote.status;
}
export function dinero(valor: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(valor);
}
export function fechaLocal(valor?: string | null) {
  if (!valor) return '';
  const date = new Date(valor);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
