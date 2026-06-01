export type OperationalStatus = 'IN_TRANSIT' | 'RECEIVED';

export const OPERATIONAL_STATUS_OPTIONS: { value: OperationalStatus; label: string }[] = [
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'RECEIVED', label: 'Receive' },
];

export const normalizeOperationalStatus = (status?: string): OperationalStatus => {
  const s = status ? status.toUpperCase() : '';
  if (
    s === 'RECEIVED' ||
    s === 'COMPLETED' ||
    s === 'GATE_IN_UNLOADING' ||
    s === 'UNLOADING' ||
    s === 'GATE_OUT_UNLOADING' ||
    s === 'AVAILABLE'
  ) {
    return 'RECEIVED';
  }
  return 'IN_TRANSIT';
};

export const getOperationalStatusLabel = (status?: string) => {
  const normalized = normalizeOperationalStatus(status);
  return OPERATIONAL_STATUS_OPTIONS.find(option => option.value === normalized)?.label || normalized;
};

export const getOperationalStatusClasses = (status?: string) => {
  const normalized = normalizeOperationalStatus(status);
  if (normalized === 'RECEIVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-blue-50 text-blue-700 border-blue-200';
};

export const getRoleDisplayName = (role: string): string => {
  if (role === 'VENDOR_1') return 'Eastern Stevedores';
  if (role === 'VENDOR_2') return 'Mahaveer';
  return role.replace(/_/g, ' ');
};

export const normalizeVendorName = (name: string): string => {
  if (!name) return '—';
  const clean = name.trim().toLowerCase();
  
  if (
    clean.includes('espl') ||
    clean.includes('eastern') ||
    clean.includes('stevedore') ||
    clean.includes('est') ||
    clean.startsWith('east')
  ) {
    return 'Eastern Stevedores';
  }
  
  if (
    clean.includes('mahaveer') ||
    clean.includes('mahavir') ||
    clean.includes('mahveer') ||
    clean.startsWith('maha')
  ) {
    return 'Mahaveer';
  }
  
  return name.trim();
};


