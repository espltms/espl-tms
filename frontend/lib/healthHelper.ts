export interface FleetMasterRecord {
  plateNumber: string;
  insuranceValidityUpto?: string;
  fitnessValidityTo?: string;
  [key: string]: any;
}

/**
 * Parses various date string formats into a JS Date object.
 * Supports ISO (YYYY-MM-DD), DD-MM-YYYY, DD/MM/YYYY, MM-DD-YYYY, MM/DD/YYYY formats.
 */
export function parseCustomDate(dateStr?: string): Date | null {
  if (!dateStr || dateStr === '-') return null;
  
  // Try standard Date parsing first (handles ISO formats)
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  const cleaned = dateStr.trim();
  
  // Parse DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  
  // Parse YYYY-MM-DD or YYYY/MM/DD manually
  const ymdMatch = cleaned.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }
  
  // Parse MM-DD-YYYY or MM/DD/YYYY manually
  const mdyMatch = cleaned.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10) - 1;
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Checks if a validity date string is expired relative to today.
 * If the date is missing, invalid, or in the past, it is considered expired.
 */
export function isDateExpired(dateStr?: string): boolean {
  const parsed = parseCustomDate(dateStr);
  if (!parsed) {
    // If no date or invalid date, it's considered expired/invalid
    return true;
  }
  
  // Strip time components to compare only dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(parsed);
  expiry.setHours(0, 0, 0, 0);
  
  return expiry < today;
}

/**
 * Calculates health index (100, 50, or 0) based on insurance and fitness expiry dates.
 */
export function calculateHealthFromDates(insuranceDate?: string, fitnessDate?: string): number {
  const isInsuranceExpired = isDateExpired(insuranceDate);
  const isFitnessExpired = isDateExpired(fitnessDate);
  
  if (isInsuranceExpired && isFitnessExpired) {
    return 0;
  } else if (isInsuranceExpired || isFitnessExpired) {
    return 50;
  } else {
    return 100;
  }
}

/**
 * Dynamically computes a truck's health by plate number from a list of fleet master records.
 * Falls back to the truck's default health if no master record is matched.
 */
export function getTruckDynamicHealth(
  plateNumber: string,
  fallbackHealth: number,
  fleetMasterRecords: FleetMasterRecord[]
): number {
  if (!plateNumber) return fallbackHealth;
  
  const normalizedPlate = plateNumber.replace(/[^A-Z0-9]/ig, '').toUpperCase();
  const record = fleetMasterRecords.find(r => {
    if (!r.plateNumber) return false;
    const rPlate = r.plateNumber.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    return rPlate === normalizedPlate;
  });
  
  if (!record) {
    return fallbackHealth;
  }
  
  return calculateHealthFromDates(record.insuranceValidityUpto, record.fitnessValidityTo);
}
