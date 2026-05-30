'use client';

import { useEffect, useState } from 'react';
import { PackageCheck, Plus, Truck, X, Trash2 } from 'lucide-react';
import { getTrips, getTrucks } from '@/app/data/dataHelper';
import {
  OPERATIONAL_STATUS_OPTIONS,
  OperationalStatus,
  getOperationalStatusClasses,
  getOperationalStatusLabel,
  normalizeOperationalStatus,
} from '@/lib/operationalStatus';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import {
  ASSIGNED_TRIPS_KEY,
  LOADING_RECORDS_KEY,
  TRUCK_STATUS_OVERRIDES_KEY,
  updateAssignedTripStatus,
  upsertTruckStatusOverride,
} from '@/lib/workflowAutomation';

type TruckStatus = OperationalStatus;

interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  status: TruckStatus;
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
  truckStatus: TruckStatus;
  receivedQty?: number;
  unloadingDateTime?: string;
  turnaroundMinutes?: number;
  unloadingTruckStatus?: TruckStatus;
}

interface AssignedTrip {
  id: string;
  tripNumber: string;
  truckId?: string;
  source: string;
  destination: string;
  estimatedQuantityTons: number;
  status?: string;
  driver: { fullName: string; phone: string };
  truck: { plateNumber: string; model: string };
  purchaseOrder: { poNumber: string; clientName: string; commodity: string };
}

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
  const parsed = value === '-' ? new Date() : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const UOM_OPTIONS = ['Kg', 'Bags', 'Cases', 'Metric Ton', 'No.', 'Bulk'];
const TRUCK_STATUS_OPTIONS = OPERATIONAL_STATUS_OPTIONS;
const emptyLoadingForm = {
  tripId: '',
  tareWeight: '',
  grossWeight: '',
  netWeight: '',
  loadingDateTime: new Date().toISOString().slice(0, 16),
  ticketNo: '',
  challanNo: '',
  uom: 'Metric Ton',
  truckStatus: 'IN_TRANSIT' as TruckStatus,
};

export default function LoadingVehiclePage() {
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [assignedTrips, setAssignedTrips] = useState<AssignedTrip[]>(() => getTrips());
  const [records, setRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyLoadingForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  useEffect(() => {
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setRecords);
    fetchSyncedValue<AssignedTrip[]>(ASSIGNED_TRIPS_KEY, []).then((syncedTrips) => {
      setAssignedTrips((currentTrips) => [
        ...syncedTrips,
        ...currentTrips.filter(trip => !syncedTrips.some(syncedTrip => syncedTrip.id === trip.id)),
      ]);
    });
  }, []);

  useEffect(() => {
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '-';
    };

    const handleExcelImport = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: ImportedSheet }>).detail;
      if (!detail || detail.sectionName !== 'Loading Vehicle') return;

      const newTripsList: AssignedTrip[] = [];
      const newLoadingRecords: LoadingRecord[] = [];

      const getNextChallanNumber = (destinationName: string, tempRecords: LoadingRecord[]) => {
        const dest = String(destinationName || 'Paramanandpur Stockyard').trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
        const prefix = dest.substring(0, 2).padEnd(2, 'X');
        
        const allChallans = [
          ...records.map(r => r.challanNo),
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
        const seqString = String(nextSeq).padStart(3, '0');
        return `${prefix}${seqString}`;
      };

      detail.import.rows.forEach((row, index) => {
        const truckPlate = getCellValue(detail.import.headers, row, ['truck', 'truck plate', 'vehicle', 'vehicle no', 'vehicle number', 'plate number', 'no plate', 'vehicle_no']);
        if (truckPlate === '-') return;

        const ticketNo = getCellValue(detail.import.headers, row, ['ticket', 'ticket no', 'ticket number', 'weigh ticket', 'ticket_no']);
        
        const qtyValue = getCellValue(detail.import.headers, row, ['received qty', 'received_qty', 'qty', 'net', 'net weight', 'net tons', 'tons', 'quantity', 'weight']);
        const grossValue = getCellValue(detail.import.headers, row, ['gross', 'gross weight', 'gross tons', 'gross_weight']);
        const tareValue = getCellValue(detail.import.headers, row, ['tare', 'tare weight', 'tare tons', 'tare_weight']);
        const dateValue = getCellValue(detail.import.headers, row, ['date', 'loading date', 'timestamp', 'datetime', 'time', 'date_val']);
        
        const unloadingDateVal = getCellValue(detail.import.headers, row, ['unloading date', 'unloading date time', 'unload date', 'unloading_date', 'received date', 'received_date', 'unloading_time', 'unloading datetime']);
        const receivedQtyVal = getCellValue(detail.import.headers, row, ['received qty', 'received_qty', 'received quantity', 'actual received', 'received tons', 'received_tons', 'received weight']);

        const poNumber = getCellValue(detail.import.headers, row, ['po number', 'po no', 'purchase order', 'purchase order contract', 'contract']);
        const clientName = getCellValue(detail.import.headers, row, ['client', 'client name', 'customer', 'company']);
        const commodityValue = getCellValue(detail.import.headers, row, ['commodity', 'commodities', 'material', 'cargo']);
        const driverName = getCellValue(detail.import.headers, row, ['driver', 'driver name', 'driver partner']);
        const driverPhone = getCellValue(detail.import.headers, row, ['driver phone', 'driver mobile', 'mobile', 'phone']);
        const sourceValue = getCellValue(detail.import.headers, row, ['source', 'origin', 'loading point', 'loading_point', 'source loading']);
        const destinationValue = getCellValue(detail.import.headers, row, ['destination', 'unloading point', 'unloading_point', 'destination unloading', 'dest', 'to', 'location', 'location name', 'place']);

        const netWeight = qtyValue !== '-' ? parseNumberCell(qtyValue) : (grossValue !== '-' && tareValue !== '-' ? Math.max(0, parseNumberCell(grossValue) - parseNumberCell(tareValue)) : 0);
        const tareWeight = tareValue !== '-' ? parseNumberCell(tareValue) : 15.0;
        const grossWeight = grossValue !== '-' ? parseNumberCell(grossValue) : netWeight + tareWeight;
        const loadingDateTime = parseImportedDate(dateValue);

        const hasUnloadingInfo = unloadingDateVal !== '-';
        const unloadingDateTime = hasUnloadingInfo ? parseImportedDate(unloadingDateVal) : undefined;
        const receivedQty = hasUnloadingInfo ? (receivedQtyVal !== '-' ? parseNumberCell(receivedQtyVal) : netWeight) : undefined;
        
        let turnaroundMinutes = undefined;
        if (loadingDateTime && unloadingDateTime) {
          turnaroundMinutes = Math.max(0, Math.round((new Date(unloadingDateTime).getTime() - new Date(loadingDateTime).getTime()) / 60000));
        }

        const isReceived = hasUnloadingInfo;
        const statusToSet: OperationalStatus = isReceived ? 'RECEIVED' : 'IN_TRANSIT';

        // Find match in current list or new list
        let matchingTrip = assignedTrips.find(trip => 
          trip.truck.plateNumber.toUpperCase().trim() === truckPlate.toUpperCase().trim() &&
          !records.some(record => record.tripId === trip.id) &&
          !newLoadingRecords.some(record => record.tripId === trip.id)
        );

        if (!matchingTrip) {
          matchingTrip = newTripsList.find(trip => 
            trip.truck.plateNumber.toUpperCase().trim() === truckPlate.toUpperCase().trim() &&
            !newLoadingRecords.some(record => record.tripId === trip.id)
          );
        }

        let tripId = '';
        let tripNumber = '';

        if (matchingTrip) {
          tripId = matchingTrip.id;
          tripNumber = matchingTrip.tripNumber;
        } else {
          tripId = `trip-auto-${Date.now()}-${index}`;
          tripNumber = `TRIP-AUTO-${Date.now()}-${index + 1}`;
          
          const autoTrip: AssignedTrip = {
            id: tripId,
            tripNumber,
            truckId: `truck-auto-${truckPlate}`,
            source: sourceValue !== '-' ? sourceValue : 'Vedanta Lanjigarh Plant',
            destination: destinationValue !== '-' ? destinationValue : 'Paramanandpur Stockyard',
            estimatedQuantityTons: netWeight,
            status: statusToSet,
            driver: { fullName: driverName, phone: driverPhone },
            truck: { plateNumber: truckPlate, model: '-' },
            purchaseOrder: { poNumber, clientName, commodity: commodityValue },
          };
          newTripsList.push(autoTrip);
        }

        const targetDest = matchingTrip ? matchingTrip.destination : (destinationValue !== '-' ? destinationValue : 'Paramanandpur Stockyard');
        const generatedChallanNo = getNextChallanNumber(targetDest, newLoadingRecords);

        const newRecord: LoadingRecord = {
          id: `loading-import-${Date.now()}-${index}`,
          tripId,
          tripNumber,
          truckId: matchingTrip ? (matchingTrip.truckId || `truck-auto-${truckPlate}`) : `truck-auto-${truckPlate}`,
          truckPlate,
          tareWeight,
          grossWeight,
          netWeight,
          loadingDateTime,
          ticketNo: ticketNo === '-' ? '-' : ticketNo.toUpperCase(),
          challanNo: generatedChallanNo,
          uom: 'Metric Ton',
          truckStatus: statusToSet,
          receivedQty,
          unloadingDateTime,
          turnaroundMinutes,
          unloadingTruckStatus: isReceived ? 'RECEIVED' : undefined,
        };

        newLoadingRecords.push(newRecord);
      });

      if (newLoadingRecords.length === 0) return;

      let updatedTrips = [...assignedTrips];
      if (newTripsList.length > 0) {
        updatedTrips = [...newTripsList, ...updatedTrips];
        setAssignedTrips(updatedTrips);
        
        const existingTrips = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as AssignedTrip[];
        saveSyncedValue(ASSIGNED_TRIPS_KEY, [
          ...newTripsList,
          ...existingTrips.filter(t => !newTripsList.some(nt => nt.tripNumber === t.tripNumber))
        ]);
      }

      newLoadingRecords.forEach(record => {
        const existing = records.find(r => r.truckPlate.toUpperCase().trim() === record.truckPlate.toUpperCase().trim());
        const finalStatus = (record.unloadingDateTime || (existing && existing.unloadingDateTime)) ? 'RECEIVED' : record.truckStatus;
        updateAssignedTripStatus(record.tripId, record.tripNumber, finalStatus);
        upsertTruckStatusOverride(record.truckId, finalStatus);
      });

      setRecords(prev => {
        const next = [...prev];
        newLoadingRecords.forEach(nr => {
          const idx = next.findIndex(r => r.truckPlate.toUpperCase().trim() === nr.truckPlate.toUpperCase().trim());
          if (idx >= 0) {
            const merged = { ...next[idx] };
            Object.keys(nr).forEach(key => {
              const val = nr[key as keyof LoadingRecord];
              if (val !== undefined && val !== '-' && val !== '') {
                (merged as any)[key] = val;
              }
            });
            if (merged.loadingDateTime && merged.unloadingDateTime) {
              merged.turnaroundMinutes = Math.max(0, Math.round((new Date(merged.unloadingDateTime).getTime() - new Date(merged.loadingDateTime).getTime()) / 60000));
              merged.truckStatus = 'RECEIVED';
              merged.unloadingTruckStatus = 'RECEIVED';
            }
            next[idx] = merged;
          } else {
            next.unshift(nr);
          }
        });
        persistRecords(next);
        return next;
      });
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [assignedTrips, records]);

  const deleteRecords = (recordIds: string[]) => {
    const recordsToDelete = records.filter(r => recordIds.includes(r.id));
    
    recordsToDelete.forEach(record => {
      if (record.tripId) {
        updateAssignedTripStatus(record.tripId, record.tripNumber, 'SCHEDULED');
      }
    });

    const nextRecords = records.filter(r => !recordIds.includes(r.id));
    setRecords(nextRecords);
    persistRecords(nextRecords);
    
    setAssignedTrips(prevTrips => 
      prevTrips.map(trip => 
        recordsToDelete.some(r => r.tripId === trip.id) 
          ? { ...trip, status: 'SCHEDULED' } 
          : trip
      )
    );

    setSelectedIds(prev => prev.filter(id => !recordIds.includes(id)));
  };

  const isRegionalUser = user?.role === 'REGION_ADMIN' || user?.role === 'DISPATCHER';
  const userRegion = user?.regionName;

  const filteredTrips = assignedTrips.filter(trip => {
    if (isRegionalUser && userRegion) {
      return trip.destination && trip.destination.toLowerCase().includes(userRegion.toLowerCase());
    }
    return true;
  });

  const filteredRecords = records.filter(record => {
    if (isRegionalUser && userRegion) {
      const trip = assignedTrips.find(t => t.tripNumber === record.tripNumber || t.id === record.tripId);
      if (trip) {
        return trip.destination && trip.destination.toLowerCase().includes(userRegion.toLowerCase());
      }
      return true;
    }
    return true;
  });

  const selectedTrip = filteredTrips.find(trip => trip.id === form.tripId);
  const selectedTruck = selectedTrip
    ? trucks.find(truck => truck.id === selectedTrip.truckId || truck.plateNumber === selectedTrip.truck.plateNumber)
    : undefined;
  const availableTrips = filteredTrips.filter(trip =>
    normalizeOperationalStatus(trip.status) === 'SCHEDULED' &&
    !filteredRecords.some(record => record.tripId === trip.id)
  );

  const persistTruckStatusOverrides = (nextTrucks: TruckData[]) => {
    if (typeof window === 'undefined') return;
    const overrides = nextTrucks.reduce<Record<string, TruckStatus>>((acc, truck) => {
      acc[truck.id] = truck.status;
      return acc;
    }, {});
    saveSyncedValue(TRUCK_STATUS_OVERRIDES_KEY, overrides);
  };

  const persistRecords = (nextRecords: LoadingRecord[]) => {
    saveSyncedValue(LOADING_RECORDS_KEY, nextRecords);
  };

  const handleNumberChange = (field: 'tareWeight' | 'grossWeight' | 'netWeight', value: string) => {
    const nextForm = { ...form, [field]: value };
    if (field === 'tareWeight' || field === 'grossWeight') {
      const tare = parseFloat(field === 'tareWeight' ? value : nextForm.tareWeight) || 0;
      const gross = parseFloat(field === 'grossWeight' ? value : nextForm.grossWeight) || 0;
      nextForm.netWeight = gross > tare ? (gross - tare).toFixed(2) : '0.00';
    }
    setForm(nextForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTrip) return;

    const truckForRecord = selectedTruck || {
      id: selectedTrip.truckId || `trip-truck-${selectedTrip.truck.plateNumber}`,
      plateNumber: selectedTrip.truck.plateNumber,
      model: selectedTrip.truck.model,
      status: form.truckStatus,
    };

    const newRecord: LoadingRecord = {
      id: `loading-${Date.now()}`,
      tripId: selectedTrip.id,
      tripNumber: selectedTrip.tripNumber,
      truckId: truckForRecord.id,
      truckPlate: truckForRecord.plateNumber,
      tareWeight: parseFloat(form.tareWeight) || 0,
      grossWeight: parseFloat(form.grossWeight) || 0,
      netWeight: parseFloat(form.netWeight) || 0,
      loadingDateTime: form.loadingDateTime,
      ticketNo: form.ticketNo,
      challanNo: form.challanNo,
      uom: form.uom,
      truckStatus: form.truckStatus,
    };
    const nextRecords = [newRecord, ...records];
    const nextTrucks = selectedTruck
      ? trucks.map(truck => truck.id === selectedTruck.id ? { ...truck, status: form.truckStatus } : truck)
      : trucks;

    setRecords(nextRecords);
    setTrucks(nextTrucks);
    persistRecords(nextRecords);
    persistTruckStatusOverrides(nextTrucks);
    updateAssignedTripStatus(selectedTrip.id, selectedTrip.tripNumber, 'IN_TRANSIT');
    upsertTruckStatusOverride(truckForRecord.id, form.truckStatus);
    setShowModal(false);
    setForm(emptyLoadingForm);
  };

  const openLoadingForTrip = (tripId = '') => {
    const trip = assignedTrips.find(item => item.id === tripId);
    const truck = trip ? trucks.find(item => item.id === trip.truckId || item.plateNumber === trip.truck.plateNumber) : undefined;
    
    let generatedChallan = '';
    if (trip) {
      const dest = String(trip.destination || 'Paramanandpur Stockyard').trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
      const prefix = dest.substring(0, 2).padEnd(2, 'X');
      const allChallans = records.map(r => r.challanNo);
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
      generatedChallan = `${prefix}${String(nextSeq).padStart(3, '0')}`;
    }

    setForm({
      ...emptyLoadingForm,
      tripId,
      truckStatus: truck ? normalizeOperationalStatus(truck.status) : emptyLoadingForm.truckStatus,
      challanNo: generatedChallan,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Loading Vehicle</h2>
          <p className="text-xs text-slate-500 mt-1">Select an assigned trip, then capture loading weights, ticket details, challan number, U.O.M, and truck status</p>
        </div>
        <button onClick={() => openLoadingForTrip()} className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-md">
          <Plus className="h-4 w-4" /> Add Loading Entry
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Truck className="h-4 w-4 text-brand-primary" /> Assigned Trips Ready for Loading
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Trip Details</th>
                <th className="px-6 py-4">Contract</th>
                <th className="px-6 py-4">Truck & Driver</th>
                <th className="px-6 py-4">Planned Qty</th>
                <th className="px-6 py-4 text-right">Loading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {availableTrips.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No assigned trips waiting for loading.</td>
                </tr>
              ) : availableTrips.map(trip => (
                <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono font-extrabold text-slate-800">{trip.tripNumber}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{trip.source} to {trip.destination}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{trip.purchaseOrder.poNumber}</div>
                    <div className="mt-0.5 text-[10px] text-brand-primary">{trip.purchaseOrder.commodity}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-slate-800">{trip.truck.plateNumber}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{trip.driver.fullName}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">{trip.estimatedQuantityTons} Tons</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openLoadingForTrip(trip.id)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100"
                    >
                      Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-brand-primary" /> Loading Records
          </h3>
          <div className="flex items-center gap-2">
            {isDeleteMode ? (
              <>
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => {
                      deleteRecords(selectedIds);
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
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                {isDeleteMode && (
                  <th className="w-10 px-6 py-4">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && selectedIds.length === filteredRecords.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredRecords.map(r => r.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-6 py-4">Trip / Vehicle</th>
                <th className="px-6 py-4">Ticket / Challan</th>
                <th className="px-6 py-4">Weights</th>
                <th className="px-6 py-4">U.O.M</th>
                <th className="px-6 py-4">Loading Time</th>
                <th className="px-6 py-4">Truck Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={isDeleteMode ? 7 : 6} className="px-6 py-8 text-center text-slate-500">No loading records added yet.</td></tr>
              ) : filteredRecords.map(record => (
                <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(record.id) ? 'bg-blue-50/20' : ''}`}>
                  {isDeleteMode && (
                    <td className="w-10 px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, record.id]);
                          } else {
                            setSelectedIds(selectedIds.filter(id => id !== record.id));
                          }
                        }}
                        className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="font-mono font-extrabold text-slate-800">{record.tripNumber || 'TRIP-REF'}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500 font-mono">{record.truckPlate}</div>
                  </td>
                  <td className="px-6 py-4"><div className="font-mono font-bold text-slate-700">{record.ticketNo}</div><div className="mt-0.5 text-[10px] text-slate-400">Challan: {record.challanNo}</div></td>
                  <td className="px-6 py-4 font-mono"><div>Gross: <span className="font-bold text-slate-800">{record.grossWeight.toFixed(2)}</span></div><div className="text-[10px] text-slate-500">Tare: {record.tareWeight.toFixed(2)} | Net: {record.netWeight.toFixed(2)}</div></td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{record.uom}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(record.loadingDateTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(record.truckStatus)}`}>{getOperationalStatusLabel(record.truckStatus)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
              <div><h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Loading Vehicle</h3></div>
              <button onClick={() => { setShowModal(false); setForm(emptyLoadingForm); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto min-h-0 flex-1">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Assigned Trip *">
                  <select required value={form.tripId} onChange={(e) => {
                    const tripId = e.target.value;
                    const trip = assignedTrips.find(item => item.id === tripId);
                    const truck = trip ? trucks.find(item => item.id === trip.truckId || item.plateNumber === trip.truck.plateNumber) : undefined;
                    
                    let generatedChallan = '';
                    if (trip) {
                      const dest = String(trip.destination || 'Paramanandpur Stockyard').trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
                      const prefix = dest.substring(0, 2).padEnd(2, 'X');
                      const allChallans = records.map(r => r.challanNo);
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
                      generatedChallan = `${prefix}${String(nextSeq).padStart(3, '0')}`;
                    }

                    setForm({ 
                      ...form, 
                      tripId, 
                      truckStatus: truck ? normalizeOperationalStatus(truck.status) : form.truckStatus,
                      challanNo: generatedChallan
                    });
                  }} className="load-input">
                    <option value="">Choose assigned trip...</option>
                    {availableTrips.map(trip => (
                      <option key={trip.id} value={trip.id}>
                        {trip.tripNumber} - {trip.truck.plateNumber} - {trip.purchaseOrder.commodity}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Truck Status *">
                  <select required value={form.truckStatus} onChange={(e) => setForm({ ...form, truckStatus: e.target.value as TruckStatus })} className="load-input">
                    {TRUCK_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
              </div>
              {selectedTrip && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-3 text-[11px] md:grid-cols-3">
                    <div><span className="block text-slate-400 font-bold uppercase">Truck</span><span className="font-mono font-bold text-slate-800">{selectedTrip.truck.plateNumber}</span></div>
                    <div><span className="block text-slate-400 font-bold uppercase">Driver</span><span className="font-bold text-slate-800">{selectedTrip.driver.fullName}</span></div>
                    <div><span className="block text-slate-400 font-bold uppercase">Commodity</span><span className="font-bold text-slate-800">{selectedTrip.purchaseOrder.commodity}</span></div>
                    <div className="md:col-span-2"><span className="block text-slate-400 font-bold uppercase">Route</span><span className="font-bold text-slate-800">{selectedTrip.source} to {selectedTrip.destination}</span></div>
                    <div><span className="block text-slate-400 font-bold uppercase">Planned Qty</span><span className="font-mono font-bold text-slate-800">{selectedTrip.estimatedQuantityTons} Tons</span></div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Tare Weight *"><input type="number" step="0.01" required value={form.tareWeight} onChange={(e) => handleNumberChange('tareWeight', e.target.value)} className="load-input font-mono font-bold" /></Field>
                <Field label="Gross Weight *"><input type="number" step="0.01" required value={form.grossWeight} onChange={(e) => handleNumberChange('grossWeight', e.target.value)} className="load-input font-mono font-bold" /></Field>
                <Field label="Net Weight *"><input type="number" step="0.01" required value={form.netWeight} onChange={(e) => handleNumberChange('netWeight', e.target.value)} className="load-input font-mono font-bold" /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Time & Date of Loading *"><input type="datetime-local" required value={form.loadingDateTime} onChange={(e) => setForm({ ...form, loadingDateTime: e.target.value })} className="load-input" /></Field>
                <Field label="U.O.M *"><select required value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="load-input">{UOM_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Ticket No. *"><input type="text" required value={form.ticketNo} onChange={(e) => setForm({ ...form, ticketNo: e.target.value.toUpperCase() })} className="load-input uppercase font-mono" /></Field>
                <Field label="Challan No. *"><input type="text" required value={form.challanNo} onChange={(e) => setForm({ ...form, challanNo: e.target.value.toUpperCase() })} className="load-input uppercase font-mono" /></Field>
              </div>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                Save Loading Entry <PackageCheck className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .load-input { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; padding: 0.625rem 0.75rem; color: #1e293b; outline: none; }
        .load-input:focus { border-color: rgb(37 99 235 / 0.65); box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}
