'use client';

import { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  User, 
  FileText, 
  Plus, 
  QrCode, 
  AlertTriangle, 
  X, 
  Calendar,
  CheckCircle,
  FileCheck2,
  Trash2
} from 'lucide-react';

import { getTrips, getPurchaseOrders, getDrivers, getTrucks } from '@/app/data/dataHelper';
import { fetchSyncedValue, saveSyncedValue } from '@/lib/syncedStorage';
import { getOperationalStatusClasses, getOperationalStatusLabel, OPERATIONAL_STATUS_OPTIONS, OperationalStatus } from '@/lib/operationalStatus';
import { getTruckDynamicHealth } from '@/lib/healthHelper';
import { useAuthStore } from '@/store/auth.store';
import { updateAssignedTripStatus, upsertTruckStatusOverride, isMatchingDestination } from '@/lib/workflowAutomation';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  clientName: string;
  commodity: string;
  totalQuantityTons: number;
  allocatedQuantityTons: number;
  ratePerTon: number;
  status: string;
}

interface Trip {
  id: string;
  tripNumber: string;
  truckId?: string;
  driverId?: string;
  source: string;
  destination: string;
  distanceKm: number;
  estimatedQuantityTons: number | string;
  actualLoadedTons?: number | string;
  actualDeliveredTons?: number | string;
  status: string;
  scheduledStartDate: string;
  vendorName?: string;
  vehicleType?: string;
  driver: { fullName: string; phone: string };
  truck: { plateNumber: string; model: string };
  purchaseOrder: { poNumber: string; clientName: string; commodity: string };
}

interface LoadingRecord {
  id: string;
  tripId?: string;
  tripNumber?: string;
  truckId: string;
  truckPlate: string;
  tareWeight: number;
  grossWeight: number;
  netWeight: number;
  loadingDateTime: string;
  ticketNo: string;
  challanNo: string;
  uom: string;
  truckStatus: OperationalStatus;
  receivedQty?: number;
  unloadingDateTime?: string;
  turnaroundMinutes?: number;
  unloadingTruckStatus?: OperationalStatus;
}

const VEHICLE_TYPES = ['Tipper', 'Dalla', 'Tanker', 'Flatbed', 'Container Carrier', 'Bulker'];
const COMMODITIES = ['Fly Ash', 'Coal', 'FMCG', 'Other'];
const VENDOR_OPTIONS = ['Vendor 1', 'Vendor 2', 'Vendor 3'];
const ASSIGNED_TRIPS_KEY = 'tms_assigned_trips';
const LOADING_RECORDS_KEY = 'tms_loading_records';

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const parseNumberCell = (value: string) => {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const parseImportedDate = (value: string) => {
  if (!value || value === '-') return new Date().toISOString();
  const num = Number(value);
  if (Number.isFinite(num) && num > 30000 && num < 100000) {
    const jsDate = new Date((num - 25569) * 86400 * 1000);
    return jsDate.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const getPoSourceDestination = (poNumber: string) => {
  const num = String(poNumber || '').toUpperCase();
  if (num.includes('DRMGRH') || num.includes('DHARAMGARH') || num.includes('DHARAM') || num.includes('DRM')) {
    return {
      source: 'Vedanta Lanjigarh Plant',
      destination: 'Dharamgarh Terminal',
    };
  }
  return {
    source: 'Vedanta Lanjigarh Plant',
    destination: 'Paramanandpur Stockyard',
  };
};

const getLocalDateTimeString = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
};

export default function TripsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Trip[]>(() => getTrips());
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getPurchaseOrders());
  const [drivers, setDrivers] = useState(() => getDrivers());
  const [trucks, setTrucks] = useState(() => getTrucks());
  const [fleetMasterRecords, setFleetMasterRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [poId, setPoId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [source, setSource] = useState('Vedanta Lanjigarh Plant');
  const [destination, setDestination] = useState('Paramanandpur Stockyard');
  const [vendorName, setVendorName] = useState(VENDOR_OPTIONS[0]);
  const [vehicleType, setVehicleType] = useState('Tipper');
  const [commodity, setCommodity] = useState('');
  const [estimatedQuantity, setEstimatedQuantity] = useState('40.00');
  const [distance, setDistance] = useState('120');

  // Weighment state fields
  const [tareWeight, setTareWeight] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [loadingDateTime, setLoadingDateTime] = useState(getLocalDateTimeString());
  const [ticketNo, setTicketNo] = useState('');
  const [challanNo, setChallanNo] = useState('');
  const [typedTruckPlate, setTypedTruckPlate] = useState('');

  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const [activeGatepass, setActiveGatepass] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 15;

  const deleteTrips = (tripIds: string[]) => {
    const nextTrips = trips.filter(t => !tripIds.includes(t.id));
    setTrips(nextTrips);
    
    if (typeof window !== 'undefined') {
      const existing = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as Trip[];
      const nextSynced = existing.filter(t => !tripIds.includes(t.id));
      saveSyncedValue(ASSIGNED_TRIPS_KEY, nextSynced);

      // Clean matching loading records
      const existingLoading = JSON.parse(window.localStorage.getItem(LOADING_RECORDS_KEY) || '[]') as LoadingRecord[];
      const nextLoading = existingLoading.filter(r => !tripIds.includes(r.tripId || ''));
      saveSyncedValue(LOADING_RECORDS_KEY, nextLoading);
      setLoadingRecords(nextLoading);
    }
    
    setSelectedIds(prev => prev.filter(id => !tripIds.includes(id)));
  };

  const isRegionalUser = user?.role === 'REGION_ADMIN' || user?.role === 'DISPATCHER' || user?.role === 'PARAMANANDPUR_ADMIN' || user?.role === 'DHARAMGARH_ADMIN' || user?.role === 'BHAWANIPATNA_ADMIN';
  const isLanjigarhLoader = user?.role === 'LANJIGARH_LOADER';
  const userRegion = user?.role === 'PARAMANANDPUR_ADMIN' 
    ? 'Paramanandpur' 
    : user?.role === 'DHARAMGARH_ADMIN' 
      ? 'Dharamgarh' 
      : user?.role === 'BHAWANIPATNA_ADMIN'
        ? 'Bhawanipatna'
        : user?.regionName;

  const filteredTrips = trips.filter(trip => {
    if (isLanjigarhLoader) {
      return trip.source && trip.source.toLowerCase().includes('lanjigarh');
    }
    if (isRegionalUser && userRegion) {
      return isMatchingDestination(trip.destination, userRegion);
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTrips.length / ITEMS_PER_PAGE);
  const paginatedTrips = filteredTrips.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getNextChallanNumber = (destinationName: string, tempRecords: LoadingRecord[]) => {
    const dest = String(destinationName || 'Paramanandpur Stockyard').trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
    const prefix = dest.substring(0, 2).padEnd(2, 'X');
    
    const allChallans = [
      ...loadingRecords.map(r => r.challanNo),
      ...tempRecords.map(r => r.challanNo)
    ];
    
    let maxSeq = 0;
    allChallans.forEach(c => {
      if (c && c.toUpperCase().startsWith(prefix)) {
        const seqStr = c.substring(prefix.length);
        const seqNum = parseInt(seqStr, 10);
        if (Number.isFinite(seqNum) && seqNum > maxSeq) {
          maxSeq = seqNum;
        }
      }
    });
    
    const nextSeq = maxSeq + 1;
    const seqString = String(nextSeq).padStart(4, '0');
    return `${prefix}${seqString}`;
  };

  useEffect(() => {
    fetchSyncedValue<Trip[]>(ASSIGNED_TRIPS_KEY, []).then((syncedTrips) => {
      setTrips((currentTrips) => [
        ...syncedTrips,
        ...currentTrips.filter(trip => !syncedTrips.some(syncedTrip => syncedTrip.id === trip.id)),
      ]);
    });

    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then((syncedRecords) => {
      setLoadingRecords(syncedRecords);
    });

    const getCapacityFromWheeler = (wheeler: string) => {
      const w = String(wheeler || '').toLowerCase();
      if (w.includes('6')) return '15.00';
      if (w.includes('10')) return '25.00';
      if (w.includes('12')) return '31.00';
      if (w.includes('14')) return '37.00';
      if (w.includes('16')) return '42.00';
      if (w.includes('18')) return '49.00';
      if (w.includes('22')) return '55.00';
      return '25.00';
    };

    fetchSyncedValue<any[]>('tms_fleet_master', []).then((loadedRecords) => {
      setFleetMasterRecords(loadedRecords);
      if (loadedRecords && loadedRecords.length > 0) {
        const fleetTrucks = loadedRecords.map(r => ({
          id: r.id || `fm-${r.plateNumber}`,
          plateNumber: r.plateNumber,
          model: r.vehicleType || 'Tipper',
          type: r.vehicleType || 'Tipper',
          fleetCategory: r.fleetCategory || 'OWNED_FLEET',
          capacity: getCapacityFromWheeler(r.wheeler),
          fuelCard: '-',
          health: getTruckDynamicHealth(r.plateNumber, 100, loadedRecords),
          status: 'SCHEDULED' as any,
          vendor: r.vendor || 'Vendor 1',
          subVendor: r.subVendor || '-',
          wheeler: r.wheeler || '12 Wheeler',
          assignedDriverName: r.driverName || '-',
        }));

        setTrucks((prev) => {
          const merged = [...prev];
          fleetTrucks.forEach(ft => {
            const index = merged.findIndex(m => m.plateNumber.toUpperCase() === ft.plateNumber.toUpperCase());
            if (index >= 0) {
              merged[index] = { ...merged[index], ...ft };
            } else {
              merged.push(ft);
            }
          });
          return merged;
        });

        const fleetDrivers = loadedRecords
          .filter(r => r.driverName && r.driverName !== '-')
          .map((r, idx) => ({
            id: `fm-driver-${r.plateNumber}-${idx}`,
            fullName: r.driverName,
            phone: r.driverMobile || '-',
            licenseNumber: r.driverDL || '-',
            status: 'ACTIVE',
            verified: true,
            assignedTruckPlate: r.plateNumber,
          }));

        setDrivers((prev) => {
          const merged = [...prev];
          fleetDrivers.forEach(fd => {
            const index = merged.findIndex(m => m.fullName.toLowerCase() === fd.fullName.toLowerCase());
            if (index >= 0) {
              merged[index] = { ...merged[index], ...fd };
            } else {
              merged.push(fd);
            }
          });
          return merged;
        });
      }
    });
  }, []);

  useEffect(() => {
    if (modalOpen && isRegionalUser && userRegion) {
      setDestination(userRegion === 'Bhawanipatna' ? 'Paramanandpur Stockyard' : userRegion);
    }
  }, [modalOpen, isRegionalUser, userRegion]);

  useEffect(() => {
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '-';
    };

    const handleExcelImport = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: ImportedSheet }>).detail;
      if (!detail || detail.sectionName !== 'Trip Dispatch & Loading') return;

      const newTripsList: Trip[] = [];
      const newLoadingRecords: LoadingRecord[] = [];

      const getNextChallanNumberExcel = (destinationName: string, tempRecords: LoadingRecord[]) => {
        const dest = String(destinationName || 'Paramanandpur Stockyard').trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = dest.substring(0, 2).padEnd(2, 'X');
        
        const allChallans = [
          ...loadingRecords.map(r => r.challanNo),
          ...tempRecords.map(r => r.challanNo)
        ];
        
        let maxSeq = 0;
        allChallans.forEach(c => {
          if (c && c.toUpperCase().startsWith(prefix)) {
            const seqStr = c.substring(prefix.length);
            const seqNum = parseInt(seqStr, 10);
            if (Number.isFinite(seqNum) && seqNum > maxSeq) {
              maxSeq = seqNum;
            }
          }
        });
        
        const nextSeq = maxSeq + 1;
        const seqString = String(nextSeq).padStart(4, '0');
        return `${prefix}${seqString}`;
      };

      detail.import.rows.forEach((row, index) => {
        const truckPlate = getCellValue(detail.import.headers, row, ['truck', 'truck plate', 'vehicle', 'vehicle no', 'vehicle number', 'plate number', 'no plate', 'vehicle_no']);
        if (truckPlate === '-') return;

        const poVal = getCellValue(detail.import.headers, row, ['po number', 'po no', 'purchase order', 'purchase order contract', 'contract', 'po']);
        const qtyVal = getCellValue(detail.import.headers, row, ['qty', 'net', 'net weight', 'net tons', 'tons', 'quantity', 'weight', 'qty/net', 'estimated quantity', 'actual loaded']);
        const tareVal = getCellValue(detail.import.headers, row, ['tare', 'tare weight', 'tare tons', 'tare_weight']);
        const grossVal = getCellValue(detail.import.headers, row, ['gross', 'gross weight', 'gross tons', 'gross_weight']);
        const ticketNo = getCellValue(detail.import.headers, row, ['ticket', 'ticket no', 'ticket number', 'weigh ticket', 'ticket_no']);
        const challanVal = getCellValue(detail.import.headers, row, ['challan', 'challan no', 'challan number', 'challan_no']);
        const dateVal = getCellValue(detail.import.headers, row, ['date', 'loading date', 'timestamp', 'datetime', 'time', 'date_val', 'time and date of loading']);
        const locationVal = getCellValue(detail.import.headers, row, ['location', 'destination', 'unloading', 'unloading point', 'destination unloading', 'location/destination']);
        const sourceVal = getCellValue(detail.import.headers, row, ['source', 'origin', 'loading point', 'loading_point', 'source loading']);
        const vendorVal = getCellValue(detail.import.headers, row, ['vendor', 'vendor company', 'transporter', 'carrier', 'vendor name', 'company']);
        const typeVal = getCellValue(detail.import.headers, row, ['vehicle type', 'truck type', 'type', 'vehicle_type', 'wheeler']);
        const driverVal = getCellValue(detail.import.headers, row, ['driver', 'driver name', 'driver partner', 'driver_name']);
        const phoneVal = getCellValue(detail.import.headers, row, ['driver phone', 'phone', 'mobile', 'driver_phone', 'phone no', 'phone number']);
        const excelCommodity = getCellValue(detail.import.headers, row, ['commodity', 'material', 'product', 'cargo', 'item']);

        // Find active PO
        let matchedPo = purchaseOrders.find(p => p.poNumber.toUpperCase() === poVal.toUpperCase());
        if (!matchedPo && poVal !== '-') {
          matchedPo = purchaseOrders.find(p => p.poNumber.toUpperCase().includes(poVal.toUpperCase()));
        }
        if (!matchedPo && purchaseOrders.length > 0) {
          matchedPo = purchaseOrders[0];
        }

        const poNumber = matchedPo ? matchedPo.poNumber : (poVal !== '-' ? poVal : 'PO-GENERIC-01');
        const clientName = matchedPo ? matchedPo.clientName : 'Client';
        
        // Prioritize excel commodity name
        const commodityValue = excelCommodity !== '-' ? excelCommodity : (matchedPo ? matchedPo.commodity : 'Fly Ash');
        
        const route = getPoSourceDestination(poNumber);
        
        // Prioritize Excel source & destination strings directly if supplied
        const finalSource = sourceVal !== '-' ? sourceVal : route.source;
        const finalDestination = locationVal !== '-' ? locationVal : route.destination;

        // Resolve truck details fallbacks
        const matchedMasterTruck = trucks.find(t => t.plateNumber.toUpperCase().replace(/[^A-Z0-9]/ig, '') === truckPlate.toUpperCase().replace(/[^A-Z0-9]/ig, ''));
        const vendor = vendorVal !== '-' ? vendorVal : (matchedMasterTruck?.vendor || 'Vendor 1');
        const type = typeVal !== '-' ? typeVal : (matchedMasterTruck?.type || 'Tipper');
        const driverName = driverVal !== '-' ? driverVal : (matchedMasterTruck?.assignedDriverName || 'Driver Partner');
        const driverPhone = phoneVal !== '-' ? phoneVal : (matchedMasterTruck?.assignedDriverPhone || '-');

        // Weights
        const netWeight = qtyVal !== '-' ? parseNumberCell(qtyVal) : (grossVal !== '-' && tareVal !== '-' ? Math.max(0, parseNumberCell(grossVal) - parseNumberCell(tareVal)) : 25.0);
        const tareWeight = tareVal !== '-' ? parseNumberCell(tareVal) : 15.0;
        const grossWeight = grossVal !== '-' ? parseNumberCell(grossVal) : netWeight + tareWeight;
        const loadingDateTime = parseImportedDate(dateVal);

        const generatedChallanNo = challanVal !== '-' ? challanVal.toUpperCase() : getNextChallanNumberExcel(finalDestination, newLoadingRecords);
        const finalTicketNo = ticketNo !== '-' ? ticketNo.toUpperCase() : `TK-${Date.now().toString().slice(-6)}-${index}`;

        const tripId = `trip-import-${Date.now()}-${index}`;
        const tripNumber = `TRIP-IMP-${Date.now().toString().slice(-4)}-${index + 1}`;

        const autoTrip: Trip = {
          id: tripId,
          tripNumber,
          truckId: matchedMasterTruck?.id || `truck-auto-${truckPlate}`,
          driverId: matchedMasterTruck?.assignedDriverId || `driver-auto-${truckPlate}`,
          source: finalSource,
          destination: finalDestination,
          vendorName: vendor,
          vehicleType: type,
          distanceKm: 120,
          estimatedQuantityTons: netWeight,
          status: 'IN_TRANSIT',
          scheduledStartDate: loadingDateTime,
          driver: { fullName: driverName, phone: driverPhone },
          truck: { plateNumber: truckPlate, model: matchedMasterTruck?.model || '-' },
          purchaseOrder: { poNumber, clientName, commodity: commodityValue },
        };
        newTripsList.push(autoTrip);

        const newRecord: LoadingRecord = {
          id: `loading-import-${Date.now()}-${index}`,
          tripId,
          tripNumber,
          truckId: matchedMasterTruck?.id || `truck-auto-${truckPlate}`,
          truckPlate,
          tareWeight,
          grossWeight,
          netWeight,
          loadingDateTime,
          ticketNo: finalTicketNo,
          challanNo: generatedChallanNo,
          uom: 'Metric Ton',
          truckStatus: 'IN_TRANSIT',
        };
        newLoadingRecords.push(newRecord);

        if (matchedPo) {
          matchedPo.allocatedQuantityTons = Number(matchedPo.allocatedQuantityTons) + netWeight;
        }
      });

      if (newTripsList.length === 0) return;

      setTrips(prev => [
        ...newTripsList,
        ...prev.filter(trip => !newTripsList.some(importedTrip => importedTrip.tripNumber === trip.tripNumber)),
      ]);
      setLoadingRecords(prev => [
        ...newLoadingRecords,
        ...prev.filter(rec => !newLoadingRecords.some(importedRec => importedRec.challanNo === rec.challanNo)),
      ]);

      const existingTrips = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as Trip[];
      saveSyncedValue(ASSIGNED_TRIPS_KEY, [
        ...newTripsList,
        ...existingTrips.filter(trip => !newTripsList.some(importedTrip => importedTrip.tripNumber === trip.tripNumber)),
      ]);

      const existingLoading = JSON.parse(window.localStorage.getItem(LOADING_RECORDS_KEY) || '[]') as LoadingRecord[];
      saveSyncedValue(LOADING_RECORDS_KEY, [
        ...newLoadingRecords,
        ...existingLoading.filter(rec => !newLoadingRecords.some(importedRec => importedRec.challanNo === rec.challanNo)),
      ]);

      newTripsList.forEach(t => {
        upsertTruckStatusOverride(t.truckId || '', 'IN_TRANSIT');
      });

      setPurchaseOrders([...purchaseOrders]);
      setCurrentPage(1);
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [purchaseOrders, loadingRecords, trucks, isLanjigarhLoader]);

  const applyTruckSelection = (selectedTruck: typeof trucks[number]) => {
    setTruckId(selectedTruck.id);
    setVehicleType(selectedTruck.type || 'Tipper');
    setVendorName(selectedTruck.vendor || 'Vendor 1');
    setEstimatedQuantity(selectedTruck.capacity || '40.00');
  };

  const findTruckForDriver = (selectedDriverId: string) => {
    const selectedDriver = drivers.find(driver => driver.id === selectedDriverId);
    if (!selectedDriver) return undefined;

    return trucks.find(truck => truck.id === selectedDriver.assignedTruckId)
      || trucks.find(truck => truck.plateNumber === selectedDriver.assignedTruckPlate)
      || trucks.find(truck => truck.assignedDriverId === selectedDriver.id)
      || trucks.find(truck => truck.assignedDriverName === selectedDriver.fullName)
      || (() => {
        const matchingTrip = trips.find(trip =>
          trip.driverId === selectedDriver.id || trip.driver.fullName === selectedDriver.fullName
        );
        return matchingTrip
          ? trucks.find(truck =>
              truck.id === matchingTrip.truckId || truck.plateNumber === matchingTrip.truck.plateNumber
            )
          : undefined;
      })();
  };

  const findDriverForTruck = (selectedTruckId: string) => {
    const selectedTruck = trucks.find(truck => truck.id === selectedTruckId);
    if (!selectedTruck) return undefined;

    return drivers.find(driver => driver.id === selectedTruck.assignedDriverId)
      || drivers.find(driver => driver.fullName === selectedTruck.assignedDriverName)
      || drivers.find(driver => driver.assignedTruckId === selectedTruck.id)
      || drivers.find(driver => driver.assignedTruckPlate === selectedTruck.plateNumber)
      || (() => {
        const matchingTrip = trips.find(trip =>
          trip.truckId === selectedTruck.id || trip.truck.plateNumber === selectedTruck.plateNumber
        );
        return matchingTrip
          ? drivers.find(driver =>
              driver.id === matchingTrip.driverId || driver.fullName === matchingTrip.driver.fullName
            )
          : undefined;
      })();
  };

  const handleTruckSelection = (selectedTruckId: string) => {
    setTruckId(selectedTruckId);
    const selectedTruck = trucks.find(truck => truck.id === selectedTruckId);
    if (!selectedTruck) return;

    applyTruckSelection(selectedTruck);
    const pairedDriver = findDriverForTruck(selectedTruckId);
    if (pairedDriver) {
      setDriverId(pairedDriver.id);
    }
  };

  const handlePoSelection = (poId: string) => {
    setPoId(poId);
    const selectedPo = purchaseOrders.find(po => po.id === poId);
    if (selectedPo) {
      const route = getPoSourceDestination(selectedPo.poNumber);
      setSource(route.source);
      setDestination(route.destination);
      setDistance('120');

      const generatedChallan = getNextChallanNumber(route.destination, []);
      setChallanNo(generatedChallan);
    }
  };

  const handleWeightChange = (field: 'tare' | 'gross', value: string) => {
    if (field === 'tare') {
      setTareWeight(value);
      const grossVal = parseFloat(grossWeight) || 0;
      const tareVal = parseFloat(value) || 0;
      setNetWeight(grossVal > tareVal ? (grossVal - tareVal).toFixed(2) : '0.00');
    } else {
      setGrossWeight(value);
      const grossVal = parseFloat(value) || 0;
      const tareVal = parseFloat(tareWeight) || 0;
      setNetWeight(grossVal > tareVal ? (grossVal - tareVal).toFixed(2) : '0.00');
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegionalUser && userRegion) {
      if (!isMatchingDestination(destination, userRegion)) {
        const allowedRegions = userRegion === 'Bhawanipatna' ? 'Paramanandpur or Dharamgarh' : userRegion;
        setError(`You can only dispatch trips to your region destination (${allowedRegions})`);
        return;
      }
    }

    if (!source.toLowerCase().includes('lanjigarh')) {
      setError('Source can only be Vedanta Lanjigarh Plant');
      return;
    }

    const dLower = destination.toLowerCase();
    const isAllowedDest = dLower.includes('dharam') || dLower.includes('dharm') || dLower.includes('dhrm') || dLower.includes('drm') ||
                          dLower.includes('param') || dLower.includes('parman') || dLower.includes('prm') || dLower.includes('pram') ||
                          dLower.includes('paramanandpur');
    if (!isAllowedDest) {
      setError('Destination can only be Paramanandpur Stockyard or Dharamgarh Terminal');
      return;
    }

    const targetPO = purchaseOrders.find(po => po.id === poId);
    if (!targetPO) {
      setError('Select a valid Purchase Order');
      return;
    }

    const requestedQty = Number(netWeight) || 0;
    const poRemaining = Number(targetPO.totalQuantityTons) - Number(targetPO.allocatedQuantityTons);

    let selectedTruck = trucks.find(t => t.id === truckId);
    if (!selectedTruck && typedTruckPlate.trim()) {
      const normalizedPlate = typedTruckPlate.toUpperCase().replace(/\s+/g, '');
      selectedTruck = trucks.find(t => t.plateNumber.toUpperCase().replace(/\s+/g, '') === normalizedPlate);
    }

    if (!selectedTruck && typedTruckPlate.trim()) {
      selectedTruck = {
        id: `temp-truck-${Date.now()}`,
        plateNumber: typedTruckPlate.trim().toUpperCase(),
        model: 'Generic Model',
        type: vehicleType || 'Tipper',
        capacityTons: 40.0,
        fuelCard: '',
        health: 100,
        status: 'AVAILABLE',
        complianceVerified: true,
      } as any;
    }

    let selectedDriver = drivers.find(d => d.id === driverId);
    if (selectedTruck && !selectedDriver) {
      const pairedDriver = findDriverForTruck(selectedTruck.id);
      if (pairedDriver) {
        selectedDriver = pairedDriver;
      }
    }

    if (!selectedDriver) {
      selectedDriver = drivers[0] || ({
        id: `temp-driver-${Date.now()}`,
        fullName: 'Generic Driver',
        phone: '9999999999',
        licenseNumber: 'DL-TEMP',
        status: 'AVAILABLE',
        verified: true,
      } as any);
    }

    if (requestedQty <= 0) {
      setError('Net weight must be greater than 0');
      return;
    }

    if (requestedQty > poRemaining) {
      setError(`PO Allocation limit exceeded. PO has only ${poRemaining.toFixed(2)} remaining tons. Requested: ${requestedQty} tons.`);
      return;
    }

    if (!selectedTruck) {
      setError('Please enter a valid Vehicle Number');
      return;
    }

    const tripNumber = `TRIP-${10000 + trips.length + 1}`;
    const newTripId = `trip-local-${Date.now()}`;
    const newTrip: Trip = {
      id: newTripId,
      tripNumber,
      truckId: selectedTruck.id,
      driverId: selectedDriver.id,
      source,
      destination,
      vendorName,
      vehicleType,
      distanceKm: Number(distance),
      estimatedQuantityTons: requestedQty,
      status: 'IN_TRANSIT',
      scheduledStartDate: new Date(loadingDateTime).toISOString(),
      driver: { fullName: selectedDriver.fullName, phone: selectedDriver.phone },
      truck: { plateNumber: selectedTruck.plateNumber, model: selectedTruck.model },
      purchaseOrder: {
        poNumber: targetPO.poNumber,
        clientName: targetPO.clientName,
        commodity,
      },
    };

    const newLoadingRecord: LoadingRecord = {
      id: `loading-local-${Date.now()}`,
      tripId: newTripId,
      tripNumber: newTrip.tripNumber,
      truckId: selectedTruck.id,
      truckPlate: selectedTruck.plateNumber,
      tareWeight: parseFloat(tareWeight) || 0,
      grossWeight: parseFloat(grossWeight) || 0,
      netWeight: requestedQty,
      loadingDateTime: new Date(loadingDateTime).toISOString(),
      ticketNo: ticketNo.toUpperCase(),
      challanNo: challanNo.toUpperCase(),
      uom: 'Metric Ton',
      truckStatus: 'IN_TRANSIT'
    };

    setTrips(prev => [newTrip, ...prev]);
    setLoadingRecords(prev => [newLoadingRecord, ...prev]);

    if (typeof window !== 'undefined') {
      const existingTrips = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as Trip[];
      saveSyncedValue(ASSIGNED_TRIPS_KEY, [newTrip, ...existingTrips]);

      const existingLoading = JSON.parse(window.localStorage.getItem(LOADING_RECORDS_KEY) || '[]') as LoadingRecord[];
      saveSyncedValue(LOADING_RECORDS_KEY, [newLoadingRecord, ...existingLoading]);

      setPurchaseOrders(prev =>
        prev.map(po =>
          po.id === poId
            ? { ...po, allocatedQuantityTons: Number(po.allocatedQuantityTons) + requestedQty }
            : po
        )
      );

      upsertTruckStatusOverride(selectedTruck.id, 'IN_TRANSIT');
    }

    setModalOpen(false);

    // Call API (failsafe)
    const payload = {
      tripNumber,
      purchaseOrderId: poId,
      poNumber: targetPO.poNumber,
      driverId: selectedDriver?.id,
      driverName: selectedDriver?.fullName,
      driverPhone: selectedDriver?.phone,
      truckId: selectedTruck.id,
      truckPlate: selectedTruck.plateNumber,
      source,
      destination,
      vendorName,
      vehicleType,
      commodity,
      status: 'IN_TRANSIT',
      distanceKm: Number(distance),
      estimatedQuantityTons: requestedQty,
      scheduledStartDate: new Date(loadingDateTime).toISOString(),
    };

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('tms_token');
      await fetch(`${apiUrl}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Ignored: offline takes precedence
    }
  };

  const getGatepassToken = (trip: Trip) => {
    const record = loadingRecords.find(r => r.tripId === trip.id || r.tripNumber === trip.tripNumber);
    setActiveGatepass({
      gatepassNumber: `GP-OUT-${trip.tripNumber.split('-')[1]}`,
      tripNumber: trip.tripNumber,
      clientName: trip.purchaseOrder.clientName,
      commodity: trip.purchaseOrder.commodity,
      driverName: trip.driver.fullName,
      plateNumber: trip.truck.plateNumber,
      tareWeight: record ? `${record.tareWeight.toFixed(2)} Tons` : '15.30 Tons',
      grossWeight: record ? `${record.grossWeight.toFixed(2)} Tons` : `${(15.30 + Number(trip.estimatedQuantityTons || 0)).toFixed(2)} Tons (Est)`,
      issuedAt: record ? new Date(record.loadingDateTime).toLocaleDateString() : new Date().toLocaleDateString(),
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const openAssignModal = () => {
    setPoId('');
    setDriverId('');
    setTruckId('');
    setTypedTruckPlate('');
    setCommodity('');
    setSource('Vedanta Lanjigarh Plant');
    setDestination('Paramanandpur Stockyard');
    setEstimatedQuantity('40.00');
    setDistance('120');
    setTareWeight('');
    setGrossWeight('');
    setNetWeight('');
    setTicketNo('');
    setChallanNo('');
    setLoadingDateTime(getLocalDateTimeString());
    setError('');
    setModalOpen(true);
  };

  const selectedTruckObject = trucks.find(t => t.id === truckId);
  const selectedTruckRawHealth = selectedTruckObject ? selectedTruckObject.health : 100;
  const selectedTruckHealth = selectedTruckObject ? getTruckDynamicHealth(selectedTruckObject.plateNumber, selectedTruckRawHealth, fleetMasterRecords) : null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Freight Dispatch & Loading Board</h2>
          <p className="text-xs text-slate-500 mt-1">Consolidated dispatch planning, dynamic health checking, and vehicle loading logs.</p>
        </div>
        <button
          onClick={openAssignModal}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-glass-glow"
        >
          <Plus className="h-4.5 w-4.5" /> Assign New Trip Dispatch & Load
        </button>
      </div>

      {/* PO Progress */}
      <div className="glass-panel rounded-2xl border border-brand-slate p-6">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileCheck2 className="h-4.5 w-4.5 text-brand-primary" />
          <span>Active Purchase Orders Cap Allocation</span>
        </h3>
        
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {purchaseOrders
            .filter(po => !isLanjigarhLoader || getPoSourceDestination(po.poNumber).source.toLowerCase().includes('lanjigarh'))
            .map(po => {
            const usagePercentage = (Number(po.allocatedQuantityTons) / Number(po.totalQuantityTons)) * 100;
            return (
              <div key={po.id} className="rounded-xl bg-white border border-[#e2e8f0] p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-brand-secondary font-mono tracking-wider">
                        {po.poNumber === 'PO-VEDANTA-PRMNDPR-01' ? 'PO Lanjigarh - Paramanadpur' : po.poNumber === 'PO-VEDANTA-DRMGRH-02' ? 'PO Lanjigarh - Dharamgarh' : po.poNumber}
                      </span>
                      <div className="text-xs font-bold text-slate-800 mt-1 truncate">{po.clientName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{po.commodity}</div>
                    </div>
                    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold text-brand-primary">
                      {formatCurrency(po.ratePerTon)} / Ton
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-slate-500 font-semibold mb-1">
                      <span>Allocated: {Number(po.allocatedQuantityTons).toLocaleString()} Tons</span>
                      <span>Total: {Number(po.totalQuantityTons).toLocaleString()} Tons</span>
                    </div>
                    <div className="h-2 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-primary to-blue-500 transition-all duration-500" 
                        style={{ width: `${usagePercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispatched & Loaded Table */}
      <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden">
        <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Trip Dispatches & Loads</h3>
          <div className="flex items-center gap-2">
            {isDeleteMode ? (
              <>
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => {
                      deleteTrips(selectedIds);
                      setIsDeleteMode(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors shadow-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Selected ({selectedIds.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsDeleteMode(false);
                    setSelectedIds([]);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsDeleteMode(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                Select to Delete
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                {isDeleteMode && (
                  <th className="w-10 px-6 py-4">
                    <input
                      type="checkbox"
                      checked={paginatedTrips.length > 0 && paginatedTrips.every(t => selectedIds.includes(t.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelections = [...selectedIds];
                          paginatedTrips.forEach(t => {
                            if (!newSelections.includes(t.id)) {
                              newSelections.push(t.id);
                            }
                          });
                          setSelectedIds(newSelections);
                        } else {
                          setSelectedIds(selectedIds.filter(id => !paginatedTrips.some(t => t.id === id)));
                        }
                      }}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4">Vehicle no</th>
                <th className="px-6 py-4">PO</th>
                <th className="px-6 py-4">Commodity</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Vehicle type</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Destination</th>
                <th className="px-6 py-4">Driver partner</th>
                <th className="px-6 py-4">health index</th>
                <th className="px-6 py-4">Tare (T)</th>
                <th className="px-6 py-4">Gross (T)</th>
                <th className="px-6 py-4">Net (T)</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Loading Time</th>
                <th className="px-6 py-4">Ticket no</th>
                <th className="px-6 py-4">Challan no</th>
                <th className="px-6 py-4">Running Status</th>
                <th className="px-6 py-4 text-center">Gatepass</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
              {paginatedTrips.map(trip => {
                const matchedTruck = trucks.find(t => t.plateNumber.toUpperCase() === trip.truck.plateNumber.toUpperCase());
                const rawHealth = matchedTruck ? matchedTruck.health : 90;
                const health = getTruckDynamicHealth(trip.truck.plateNumber, rawHealth, fleetMasterRecords);

                const record = loadingRecords.find(r => r.tripId === trip.id || (trip.tripNumber && r.tripNumber === trip.tripNumber));

                const vendor = matchedTruck?.vendor || trip.vendorName || '—';
                const vType = matchedTruck?.type || trip.vehicleType || '—';
                const driverPartner = matchedTruck?.assignedDriverName || trip.driver?.fullName || '—';

                return (
                  <tr key={trip.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(trip.id) ? 'bg-blue-50/20' : ''}`}>
                    {isDeleteMode && (
                      <td className="w-10 px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(trip.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, trip.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== trip.id));
                            }
                          }}
                          className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 font-mono font-bold text-slate-800 tracking-wider whitespace-nowrap">{trip.truck.plateNumber}</td>
                    <td className="px-6 py-4 font-semibold text-slate-800 font-mono">{trip.purchaseOrder.poNumber}</td>
                    <td className="px-6 py-4 text-slate-600">{trip.purchaseOrder.commodity || '—'}</td>
                    <td className="px-6 py-4 text-slate-600 font-semibold">{vendor}</td>
                    <td className="px-6 py-4 text-slate-600">{vType}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{trip.source}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{trip.destination}</td>
                    <td className="px-6 py-4 text-slate-600">{driverPartner}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${health > 80 ? 'bg-emerald-500' : health > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${health}%` }} />
                        </div>
                        <span className={`font-bold text-[10px] ${health > 80 ? 'text-emerald-600' : health > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                          {health}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono">{record ? `${record.tareWeight.toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4 font-mono">{record ? `${record.grossWeight.toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{record ? `${record.netWeight.toFixed(2)}` : '—'}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-medium">
                      {record ? new Date(record.loadingDateTime).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap font-medium">
                      {record ? new Date(record.loadingDateTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                    </td>
                    <td className="px-6 py-4 font-mono">{record ? record.ticketNo : '—'}</td>
                    <td className="px-6 py-4 font-mono font-semibold text-slate-800 whitespace-nowrap">{record ? record.challanNo : '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(trip.status as OperationalStatus)}`}>
                        {getOperationalStatusLabel(trip.status as OperationalStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => getGatepassToken(trip)}
                        className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-1.5 text-slate-500 hover:text-slate-800 inline-flex items-center justify-center"
                        title="Show Gatepass QR"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paginatedTrips.length === 0 && (
                <tr>
                  <td colSpan={isDeleteMode ? 19 : 18} className="px-6 py-8 text-center text-slate-500">No trips found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, trips.length)} of {trips.length} entries
            </span>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Prev
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Create Trip & Load Vehicle */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 border border-brand-slate shadow-glass shadow-glass-glow animate-scale-up max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4 mb-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assign Trip & Load Vehicle</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Captures dispatch PO allocation, vehicle parameters, and loading weights simultaneously.</p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="rounded-lg hover:bg-slate-100 p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-4 text-xs overflow-y-auto min-h-0 flex-1 pr-1">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-danger/10 border border-brand-danger/20 p-4 text-brand-danger">
                  <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="border-b border-[#e2e8f0] pb-3 mb-2">
                <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">1. Contract & Routing Information</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Purchase Order Contract *</label>
                  <select 
                    required 
                    value={poId}
                    onChange={(e) => handlePoSelection(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  >
                    <option value="">Choose active PO...</option>
                    {purchaseOrders
                      .filter(po => !isLanjigarhLoader || getPoSourceDestination(po.poNumber).source.toLowerCase().includes('lanjigarh'))
                      .map(po => {
                        let labelText = `${po.poNumber} (${po.clientName})`;
                        if (po.poNumber === 'PO-VEDANTA-PRMNDPR-01') {
                          labelText = 'PO Lanjigarh - Paramanadpur';
                        } else if (po.poNumber === 'PO-VEDANTA-DRMGRH-02') {
                          labelText = 'PO Lanjigarh - Dharamgarh';
                        }
                        return (
                          <option key={po.id} value={po.id}>{labelText}</option>
                        );
                      })}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Commodity *</label>
                  <input
                    type="text"
                    required
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    placeholder="e.g. Fly Ash"
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Source Loading <span className="text-[9px] text-brand-primary font-normal font-sans">(PO Auto-resolved)</span></label>
                  <input
                    type="text"
                    disabled
                    value={source || '—'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Destination Unloading <span className="text-[9px] text-brand-primary font-normal font-sans">(PO Auto-resolved)</span></label>
                  <input
                    type="text"
                    disabled
                    value={destination || '—'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="border-b border-[#e2e8f0] pb-3 pt-2 mb-2">
                <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">2. Fleet & Driver Allocation</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Truck Vehicle Plate *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CG04GV8763"
                    value={typedTruckPlate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTypedTruckPlate(val);
                      
                      const normalizedVal = val.toUpperCase().replace(/\s+/g, '');
                      const matched = trucks.find(t => t.plateNumber.toUpperCase().replace(/\s+/g, '') === normalizedVal);
                      if (matched) {
                        setTruckId(matched.id);
                        applyTruckSelection(matched);
                        const pairedDriver = findDriverForTruck(matched.id);
                        if (pairedDriver) {
                          setDriverId(pairedDriver.id);
                        }
                      } else {
                        setTruckId('');
                      }
                    }}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none placeholder-slate-400 font-mono font-bold tracking-wider"
                  />
                  {selectedTruckHealth !== null && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Dynamic Health:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${selectedTruckHealth > 80 ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : selectedTruckHealth > 50 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                        {selectedTruckHealth}%
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Driver Partner <span className="text-[9px] text-brand-primary font-normal font-sans">(Registry Auto-fetched)</span></label>
                  <input
                    type="text"
                    disabled
                    value={drivers.find(d => d.id === driverId)?.fullName || 'No driver linked to truck'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Vendor Company <span className="text-[9px] text-brand-primary font-normal font-sans">(Auto-fetched)</span></label>
                  <input
                    type="text"
                    disabled
                    value={vendorName || '—'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Vehicle Type <span className="text-[9px] text-brand-primary font-normal font-sans">(Auto-fetched)</span></label>
                  <input
                    type="text"
                    disabled
                    value={vehicleType || '—'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Distance (Km) <span className="text-[9px] text-brand-primary font-normal font-sans">(PO Auto-resolved)</span></label>
                  <input
                    type="text"
                    disabled
                    value={distance ? `${distance} Km` : '—'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-semibold cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="border-b border-[#e2e8f0] pb-3 pt-2 mb-2">
                <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">3. Loading Weighment & Inbound Info</span>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Tare Weight (Tons) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 15.20"
                    value={tareWeight}
                    onChange={(e) => handleWeightChange('tare', e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Gross Weight (Tons) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 54.70"
                    value={grossWeight}
                    onChange={(e) => handleWeightChange('gross', e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Net Weight (Tons) <span className="text-[9px] text-brand-primary font-normal font-sans">(Auto-computed)</span></label>
                  <input
                    type="text"
                    disabled
                    value={netWeight ? `${netWeight} Tons` : '—'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-bold font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Time & Date of Loading *</label>
                  <input
                    type="datetime-local"
                    required
                    value={loadingDateTime}
                    onChange={(e) => setLoadingDateTime(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Ticket No. *</label>
                  <input
                    type="text"
                    required
                    placeholder="TICKET-10293"
                    value={ticketNo}
                    onChange={(e) => setTicketNo(e.target.value.toUpperCase())}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Challan No. <span className="text-[9px] text-brand-primary font-normal font-sans">(Auto-generated)</span></label>
                  <input
                    type="text"
                    disabled
                    value={challanNo || 'Select PO first'}
                    className="w-full bg-slate-50 border border-[#e2e8f0] rounded-xl py-2.5 px-3 text-slate-500 font-mono font-semibold cursor-not-allowed uppercase"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-sans shadow-md"
                  >
                    Dispatch & Load Vehicle
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gatepass display overlay */}
      {activeGatepass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-brand-slate text-center shadow-glass shadow-glass-glow animate-scale-up relative">
            
            <button 
              onClick={() => setActiveGatepass(null)}
              className="absolute right-4 top-4 rounded-lg hover:bg-slate-100 p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary mb-4">
              <QrCode className="h-8 w-8" />
            </div>

            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Digital Gatepass Ticket</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Scanned at loading terminal gate entry (FASTag enabled)</p>

            <div className="my-6 mx-auto w-40 h-40 bg-white p-3 rounded-2xl flex items-center justify-center shadow-glass relative">
              <div className="w-full h-full bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] flex flex-col justify-between items-center opacity-85">
                <div className="flex w-full justify-between">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-[#09090b]"></div>
                  <div className="w-6 h-6 border-t-4 border-r-4 border-[#09090b]"></div>
                </div>
                <div className="w-14 h-14 bg-gradient-to-tr from-brand-primary to-blue-600 rounded-xl flex items-center justify-center text-white text-[9px] font-extrabold uppercase shadow-lg shadow-brand-primary/30">
                  AeroQR
                </div>
                <div className="flex w-full justify-between">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-[#09090b]"></div>
                  <div className="w-6 h-6 border-b-4 border-r-4 border-[#09090b]"></div>
                </div>
              </div>
            </div>

            <div className="text-left text-xs bg-white border border-[#e2e8f0] rounded-2xl p-4 space-y-2 mb-4 font-sans">
              <div className="flex justify-between">
                <span className="text-slate-400">Pass Number:</span>
                <span className="font-mono font-bold text-brand-primary">{activeGatepass.gatepassNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trip reference:</span>
                <span className="font-semibold text-slate-800">{activeGatepass.tripNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Partner:</span>
                <span className="text-slate-800 font-semibold">{activeGatepass.driverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Truck Plate:</span>
                <span className="text-slate-800 font-mono">{activeGatepass.plateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tare Weight:</span>
                <span className="text-slate-800 font-semibold font-mono">{activeGatepass.tareWeight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Weight:</span>
                <span className="text-slate-800 font-semibold font-mono">{activeGatepass.grossWeight}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 text-[10px] text-brand-success font-semibold uppercase tracking-wider">
              <CheckCircle className="h-3.5 w-3.5" /> SECURE DECRYPTED TICKET
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
