'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchSyncedValue } from '@/lib/syncedStorage';
import {
  ASSIGNED_TRIPS_KEY,
  FLEET_FINANCE_ENTRIES_KEY,
  LOADING_RECORDS_KEY,
} from '@/lib/workflowAutomation';
import { normalizeOperationalStatus } from '@/lib/operationalStatus';

type TripRecord = {
  id: string;
  tripNumber?: string;
  status?: string;
};

type LoadingRecord = {
  id: string;
  tripId?: string;
  tripNumber?: string;
  truckPlate?: string;
  loadingDateTime?: string;
  unloadingDateTime?: string;
  unloadingTruckStatus?: string;
};

type FinanceEntry = {
  id: string;
  loadingRecordId: string;
};

export default function WorkflowAlerts() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>([]);
  const [financeEntries, setFinanceEntries] = useState<FinanceEntry[]>([]);

  useEffect(() => {
    fetchSyncedValue<TripRecord[]>(ASSIGNED_TRIPS_KEY, []).then(setTrips);
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setLoadingRecords);
    fetchSyncedValue<FinanceEntry[]>(FLEET_FINANCE_ENTRIES_KEY, []).then(setFinanceEntries);
  }, []);

  const alerts = useMemo(() => {
    const missingLoading = trips.filter(trip =>
      normalizeOperationalStatus(trip.status) === 'SCHEDULED' &&
      !loadingRecords.some(record => record.tripId === trip.id || record.tripNumber === trip.tripNumber)
    );
    const missingUnloading = loadingRecords.filter(record => !record.unloadingDateTime);
    const missingFinance = loadingRecords.filter(record =>
      record.unloadingDateTime &&
      normalizeOperationalStatus(record.unloadingTruckStatus) !== 'COMPLETED' &&
      !financeEntries.some(entry => entry.loadingRecordId === record.id)
    );

    return [
      ...missingLoading.slice(0, 2).map(trip => `Trip ${trip.tripNumber || trip.id} is assigned but loading is pending.`),
      ...missingUnloading.slice(0, 2).map(record => `Vehicle ${record.truckPlate || record.id} is loaded but unloading is pending.`),
      ...missingFinance.slice(0, 2).map(record => `Vehicle ${record.truckPlate || record.id} is unloaded but finance completion is pending.`),
    ];
  }, [financeEntries, loadingRecords, trips]);

  if (alerts.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-brand-success/20 bg-brand-success/5 p-3.5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-success" />
        <div>
          <div className="text-xs font-bold text-slate-800">WORKFLOW CLEAR</div>
          <div className="mt-1 text-[10px] text-slate-500">No pending loading, unloading, or fleet finance automation alerts.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div key={`${alert}-${index}`} className="flex items-start gap-3 rounded-xl border border-brand-warning/20 bg-brand-warning/5 p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-warning" />
          <div>
            <div className="text-xs font-bold text-slate-800">WORKFLOW ALERT</div>
            <div className="mt-1 text-[10px] text-slate-500">{alert}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
