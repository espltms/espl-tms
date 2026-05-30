export type OperationalStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'RECEIVED' | 'ACTION' | 'COMPLETED';

export const OPERATIONAL_STATUS_OPTIONS: { value: OperationalStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'IN_TRANSIT', label: 'Running' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'ACTION', label: 'Action' },
  { value: 'COMPLETED', label: 'Completed' },
];

export const normalizeOperationalStatus = (status?: string): OperationalStatus => {
  if (status === 'EN_ROUTE' || status === 'ON_TRIP' || status === 'DISPATCHED' || status === 'GATE_OUT_LOADING') return 'IN_TRANSIT';
  if (status === 'AVAILABLE' || status === 'GATE_IN_UNLOADING' || status === 'UNLOADING' || status === 'GATE_OUT_UNLOADING') return 'RECEIVED';
  if (status === 'MAINTENANCE' || status === 'OUT_OF_SERVICE' || status === 'CANCELLED') return 'ACTION';
  if (status === 'LOADING' || status === 'GATE_IN_LOADING') return 'SCHEDULED';
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'RECEIVED') return 'RECEIVED';
  if (status === 'ACTION') return 'ACTION';
  if (status === 'IN_TRANSIT') return 'IN_TRANSIT';
  return 'SCHEDULED';
};

export const getOperationalStatusLabel = (status?: string) => {
  const normalized = normalizeOperationalStatus(status);
  return OPERATIONAL_STATUS_OPTIONS.find(option => option.value === normalized)?.label || normalized;
};

export const getOperationalStatusClasses = (status?: string) => {
  const normalized = normalizeOperationalStatus(status);
  if (normalized === 'SCHEDULED') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (normalized === 'IN_TRANSIT') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (normalized === 'RECEIVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (normalized === 'COMPLETED') return 'bg-slate-100 text-slate-700 border-slate-300';
  return 'bg-red-50 text-red-700 border-red-200';
};
