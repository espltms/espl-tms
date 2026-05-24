import tmsData from './tms_data_client.json';

// NOTE: This file is kept for backwards compatibility or fallback during development.
// In production, components should use the /api routes via the useApiData hook.

export interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  type: string;
  capacity: string;
  fuelCard: string;
  health: number;
  status: 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE';
}

export interface DriverData {
  id: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  status: string;
  verified: boolean;
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
  source: string;
  destination: string;
  distanceKm: number;
  estimatedQuantityTons: number;
  actualLoadedTons?: number;
  actualDeliveredTons?: number;
  status: string;
  scheduledStartDate: string;
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

// 1. Get raw lists directly from JSON data
export const getTrucks = (): TruckData[] => tmsData.trucks as TruckData[];
export const getDrivers = (): DriverData[] => tmsData.drivers as DriverData[];
export const getPurchaseOrders = (): PurchaseOrder[] => tmsData.purchaseOrders as PurchaseOrder[];
export const getTrips = (): Trip[] => tmsData.trips as Trip[];
export const getWeighTickets = (): WeighTicket[] => tmsData.weighTickets as WeighTicket[];

// 2. Generate HR Employees list using drivers and some admins
export const getEmployees = (): Employee[] => {
  const employees: Employee[] = [
    { id: 'emp-admin', name: 'Vikram Sharma', email: 'admin@logistics.com', department: 'SYS_ADMIN', salary: 180000, allowance: 0, safetyScore: 100, joinDate: '2025-01-10' },
    { id: 'emp-finance', name: 'Elena Rostova', email: 'finance@logistics.com', department: 'FINANCE_OFFICER', salary: 120000, allowance: 0, safetyScore: 100, joinDate: '2025-03-20' },
    { id: 'emp-dispatcher', name: 'Alok Gupta', email: 'dispatcher@logistics.com', department: 'DISPATCHER', salary: 85000, allowance: 0, safetyScore: 100, joinDate: '2025-05-15' }
  ];

  // Map drivers to employees
  const driversList = getDrivers();
  driversList.forEach((d, idx) => {
    employees.push({
      id: `emp-drv-${d.id}`,
      name: d.fullName,
      email: `${d.fullName.toLowerCase().replace(/\s+/g, '.')}@aero-tms.com`,
      department: 'DRIVER_PARTNER',
      salary: 35000 + (idx % 5) * 2000,
      allowance: 1200 + (idx % 3) * 300,
      safetyScore: 85 + (idx % 15),
      joinDate: '2025-06-15'
    });
  });

  return employees;
};

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
  const activeTrucks = trucks.filter(t => t.status === 'ON_TRIP').length;
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
    reconciliationQueueCount: reconciliationQueueCount || 1,
    disputedQueueCount: disputedQueueCount || 0,
    activeTripsCount: activeTripsCount,
    fleetUtilization: fleetUtilization || 85.0
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

// 6. Generate Invoices from completed trips
export const getInvoices = (): Invoice[] => {
  const trips = getTrips();
  const completedTrips = trips.filter(t => t.status === 'COMPLETED').slice(0, 15);
  
  return completedTrips.map((t, idx) => {
    const rate = t.purchaseOrder.poNumber === "PO-VEDANTA-PRMNDPR-01" ? 240 : 280;
    const subtotal = (t.actualDeliveredTons || t.estimatedQuantityTons) * rate;
    const taxAmount = subtotal * 0.05; // 5% GST
    const totalAmount = subtotal + taxAmount;
    
    // Distribute some statuses for demo variety
    const statuses: Invoice['status'][] = ['PAID', 'PENDING_RECONCILIATION', 'DISPUTED', 'SENT'];
    const status = statuses[idx % statuses.length];
    
    return {
      id: `inv-${idx + 1}`,
      invoiceNumber: `INV-VED-${100000 + idx}`,
      tripId: t.id,
      vendorId: `vendor-${(idx % 3) + 1}`,
      type: 'CLIENT_INVOICE',
      subtotal: Math.round(subtotal),
      taxAmount: Math.round(taxAmount),
      totalAmount: Math.round(totalAmount),
      status: status,
      dueDate: new Date(new Date(t.scheduledStartDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      trip: {
        tripNumber: t.tripNumber,
        source: t.source,
        destination: t.destination,
        purchaseOrder: {
          poNumber: t.purchaseOrder.poNumber,
          clientName: t.purchaseOrder.clientName
        }
      },
      vendor: {
        name: idx % 2 === 0 ? 'Gati Freight Carriers Pvt Ltd' : 'VRL Logistics Ltd'
      }
    };
  });
};
