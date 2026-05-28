import tmsData from './tms_data_client.json';

// NOTE: This file is kept for backwards compatibility or fallback during development.
// In production, components should use the /api routes via the useApiData hook.

export interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  type: string;
  fleetCategory?: 'OWNED_FLEET' | 'ATTACHED_FLEET';
  capacity: string;
  fuelCard: string;
  health: number;
  status: 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE' | 'IN_TRANSIT' | 'RECEIVED' | 'ACTION';
  vendor?: string;
  subVendor?: string;
  wheeler?: string;
  rcDocumentName?: string;
  insuranceDocumentName?: string;
  pucDocumentName?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  assignedDriverLicense?: string;
  assignedDriverAadhar?: string;
}

export interface DriverData {
  id: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  status: string;
  verified: boolean;
  aadharNumber?: string;
  assignedTruckId?: string;
  assignedTruckPlate?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  clientName: string;
  commodity: string;
  totalQuantityTons: number;
  allocatedQuantityTons: number;
  ratePerTon: number;
  status: string;
}

export interface Trip {
  id: string;
  tripNumber: string;
  truckId?: string;
  driverId?: string;
  source: string;
  destination: string;
  distanceKm: number;
  estimatedQuantityTons: number;
  actualLoadedTons?: number;
  actualDeliveredTons?: number;
  status: string;
  scheduledStartDate: string;
  vendorName?: string;
  vehicleType?: string;
  driver: { fullName: string; phone: string };
  truck: { plateNumber: string; model: string };
  purchaseOrder: { poNumber: string; clientName: string; commodity: string };
}

export interface WeighTicket {
  id: string;
  ticketNo: string;
  tripNo: string;
  truckPlate: string;
  material: string;
  grossTons: number;
  tareTons: number;
  netTons: number;
  sealNumber: string;
  status: 'VERIFIED' | 'PENDING_GROSS' | 'REJECTED';
  timestamp: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  salary: number;
  allowance: number;
  safetyScore: number;
  joinDate: string;
}

const getLocalItems = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
};

const isRegionalAdmin = () => {
  if (typeof window === 'undefined') return false;
  try {
    const user = JSON.parse(window.localStorage.getItem('tms_user') || 'null') as { role?: string } | null;
    return user?.role === 'REGION_ADMIN';
  } catch {
    return false;
  }
};

const getTruckStatusOverrides = (): Record<string, TruckData['status']> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem('tms_truck_status_overrides') || '{}') as Record<string, TruckData['status']>;
  } catch {
    return {};
  }
};

// 1. Get raw lists directly from JSON data, plus locally onboarded records.
export const getTrucks = (): TruckData[] => {
  const statusOverrides = getTruckStatusOverrides();
  const localTrucks = isRegionalAdmin() ? [] : getLocalItems<TruckData>('tms_local_trucks');
  const datasetTrucks = isRegionalAdmin() ? [] : (tmsData.trucks as TruckData[]);
  return [
    ...localTrucks,
    ...datasetTrucks
  ].map(truck => ({
    ...truck,
    fleetCategory: truck.fleetCategory || 'OWNED_FLEET',
    status: statusOverrides[truck.id] || truck.status
  }));
};
export const getDrivers = (): DriverData[] => [
  ...(isRegionalAdmin() ? [] : getLocalItems<DriverData>('tms_local_drivers')),
  ...(isRegionalAdmin() ? [] : (tmsData.drivers as DriverData[]))
];
export const getPurchaseOrders = (): PurchaseOrder[] => isRegionalAdmin() ? [] : tmsData.purchaseOrders as PurchaseOrder[];
export const getTrips = (): Trip[] => [
  ...(isRegionalAdmin() ? [] : getLocalItems<Trip>('tms_assigned_trips')),
  ...(isRegionalAdmin() ? [] : (tmsData.trips as Trip[]))
];
export const getWeighTickets = (): WeighTicket[] => isRegionalAdmin() ? [] : tmsData.weighTickets as WeighTicket[];

// 2. HR employees are not present in the imported dataset.
export const getEmployees = (): Employee[] => [];

// 3. Compute dashboard metrics dynamically
export const getDashboardStats = () => {
  const trips = getTrips();
  const trucks = getTrucks();
  
  // Calculate total tonnage and revenue
  let totalRevenue = 0;
  trips.forEach(trip => {
    const rate = trip.purchaseOrder.poNumber === "PO-VEDANTA-PRMNDPR-01" ? 240 : 280;
    totalRevenue += (trip.actualDeliveredTons || trip.estimatedQuantityTons) * rate;
  });

  const activeTripsCount = trips.filter(t => t.status === 'EN_ROUTE' || t.status === 'LOADING').length;
  const totalTrucks = trucks.length;
  const activeTrucks = trucks.filter(t => t.status === 'ON_TRIP' || t.status === 'IN_TRANSIT').length;
  const fleetUtilization = parseFloat(((activeTrucks / totalTrucks) * 100).toFixed(1));

  const totalExpenses = totalRevenue * 0.42; // standard 42% cost structure
  const netMargin = totalRevenue - totalExpenses;

  const tickets = getWeighTickets();
  const reconciliationQueueCount = tickets.filter(t => t.status === 'VERIFIED').length;
  const disputedQueueCount = tickets.filter(t => t.status === 'REJECTED').length;

  return {
    revenueKPI: totalRevenue,
    expenseKPI: totalExpenses,
    netMarginKPI: netMargin,
    reconciliationQueueCount,
    disputedQueueCount: disputedQueueCount || 0,
    activeTripsCount: activeTripsCount,
    fleetUtilization: Number.isFinite(fleetUtilization) ? fleetUtilization : 0
  };
};

// 4. Get last 7 days of operations data for area chart
export const getRevenueHistory = () => {
  const trips = getTrips();
  
  // Group by date
  const dateMap: { [date: string]: { tons: number, revenue: number } } = {};
  
  trips.forEach(trip => {
    if (!trip.scheduledStartDate) return;
    const date = trip.scheduledStartDate.split('T')[0]; // YYYY-MM-DD
    const rate = trip.purchaseOrder.poNumber === "PO-VEDANTA-PRMNDPR-01" ? 240 : 280;
    const qty = trip.actualDeliveredTons || trip.estimatedQuantityTons;
    const rev = qty * rate;
    
    if (!dateMap[date]) {
      dateMap[date] = { tons: 0, revenue: 0 };
    }
    dateMap[date].tons += qty;
    dateMap[date].revenue += rev;
  });

  // Sort dates and select the most recent 7 days of operational data
  const sortedDates = Object.keys(dateMap).sort();
  const last7Dates = sortedDates.slice(-7);
  
  return last7Dates.map(date => {
    // Format YYYY-MM-DD to MMM DD (e.g. May 21)
    let label = date;
    try {
      const d = new Date(date);
      label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {}
    
    return {
      date: label,
      tons: Math.round(dateMap[date].tons),
      revenue: Math.round(dateMap[date].revenue)
    };
  });
};

// 5. Get PO usage limits for bar chart
export const getPoUsageData = () => {
  const pos = getPurchaseOrders();
  return pos.map(po => ({
    name: po.poNumber.replace('-01', '').replace('-02', ''),
    allocated: Math.round(po.allocatedQuantityTons),
    total: Math.round(po.totalQuantityTons)
  }));
};

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tripId: string;
  vendorId?: string;
  type: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'PENDING_RECONCILIATION' | 'PAID' | 'OVERDUE' | 'DISPUTED';
  dueDate: string;
  validatedAt?: string;
  reconciliationLog?: string;
  trip: {
    tripNumber: string;
    source: string;
    destination: string;
    purchaseOrder: { poNumber: string; clientName: string };
  };
  vendor?: { name: string };
}

// 6. Invoices are not present in the imported dataset.
export const getInvoices = (): Invoice[] => [];
