import { OperationalStatus } from '@/lib/operationalStatus';
import { saveSyncedValue } from '@/lib/syncedStorage';

export const ASSIGNED_TRIPS_KEY = 'tms_assigned_trips';
export const LOADING_RECORDS_KEY = 'tms_loading_records';
export const LOCAL_TRUCKS_KEY = 'tms_local_trucks';
export const FLEET_FINANCE_ENTRIES_KEY = 'tms_fleet_finance_entries';
export const TRUCK_STATUS_OVERRIDES_KEY = 'tms_truck_status_overrides';

type TripLike = {
  id: string;
  tripNumber?: string;
  status?: string;
};

const readArray = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
};

export const updateAssignedTripStatus = async (
  tripId: string | undefined,
  tripNumber: string | undefined,
  status: OperationalStatus,
) => {
  if (!tripId && !tripNumber) return;
  const trips = readArray<TripLike>(ASSIGNED_TRIPS_KEY);
  const nextTrips = trips.map(trip =>
    trip.id === tripId || trip.tripNumber === tripNumber
      ? { ...trip, status }
      : trip
  );
  await saveSyncedValue(ASSIGNED_TRIPS_KEY, nextTrips);
};

export const upsertTruckStatusOverride = async (
  truckId: string,
  status: OperationalStatus,
) => {
  if (!truckId) return;
  let existing: Record<string, OperationalStatus> = {};
  if (typeof window !== 'undefined') {
    try {
      existing = JSON.parse(window.localStorage.getItem(TRUCK_STATUS_OVERRIDES_KEY) || '{}') as Record<string, OperationalStatus>;
    } catch {
      existing = {};
    }
  }
  await saveSyncedValue(TRUCK_STATUS_OVERRIDES_KEY, { ...existing, [truckId]: status });
};

export const isMatchingDestination = (destination: string | null | undefined, region: string | null | undefined) => {
  if (!destination || !region) return false;
  const dest = destination.toLowerCase().trim().replace(/[^a-z]/g, '');
  const reg = region.toLowerCase().trim().replace(/[^a-z]/g, '');
  
  if (dest.includes(reg) || reg.includes(dest)) return true;
  
  // Bhawanipatna check matching both regions
  if (reg.includes('bhawani') || reg.includes('patna')) {
    return isMatchingDestination(destination, 'Paramanandpur') || isMatchingDestination(destination, 'Dharamgarh');
  }
  
  // Paramanandpur check
  const isParamanandpurRegion = 
    reg.includes('param') || 
    reg.includes('parman') || 
    reg.includes('prm') || 
    reg.includes('paramanand') || 
    reg.includes('paramanad') || 
    reg.includes('paramand') ||
    reg.includes('pram');

  if (isParamanandpurRegion) {
    const paramWords = [
      'param', 'parman', 'prm', 'pram',
      'prmndpr', 'pramndpr', 'pramnand',
      'paramanand', 'paramanad', 'paramand', 
      'parmanand', 'parmanad', 'parmand', 'parman',
      'prmnd'
    ];
    return paramWords.some(word => dest.includes(word));
  }
  
  // Dharamgarh check
  const isDharamgarhRegion = 
    reg.includes('dharam') || 
    reg.includes('dharm') || 
    reg.includes('dhrm') || 
    reg.includes('drm') || 
    reg.includes('dharang') || 
    reg.includes('dharamb') || 
    reg.includes('dham') ||
    reg.includes('dharag');

  if (isDharamgarhRegion) {
    const dharamWords = [
      'dharam', 'dharm', 'dhrm', 'drm',
      'dharang', 'dharamb', 'dham', 'dharag',
      'drmgrh', 'dhrmgrh',
      'dharagard', 'dharagarh', 'dharamgahr',
      'dharmgahr', 'dharamgadh', 'dharmgadh',
      'dharamgard', 'dharmgard', 'dhamgarh'
    ];
    return dharamWords.some(word => dest.includes(word));
  }
  
  return false;
};

