'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Truck, Plus, X, ArrowRight, User, FileText, RefreshCw } from 'lucide-react';

interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  type: string;
  capacity: string;
  fuelCard: string;
  health: number;
  status: 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE';
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

interface DriverData {
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

import { getDrivers, getTrucks } from '@/app/data/dataHelper';

type OnboardingMode = 'vehicle' | 'driver' | 'both';

const VEHICLE_TYPES = ['Tipper', 'Dalla', 'Tanker', 'Flatbed', 'Container Carrier', 'Bulker'];
const WHEELER_OPTIONS = ['6 Wheeler', '10 Wheeler', '12 Wheeler', '14 Wheeler', '16 Wheeler', '18 Wheeler', '22 Wheeler'];

const emptyVehicleForm = {
  plateNumber: '',
  model: '',
  type: 'Tipper',
  capacity: '',
  fuelCard: '',
  vendor: '',
  subVendor: '',
  wheeler: '12 Wheeler',
  rcDocumentName: '',
  insuranceDocumentName: '',
  pucDocumentName: '',
  assignedDriverId: '',
};

const emptyDriverForm = {
  fullName: '',
  phone: '+91 ',
  licenseNumber: '',
  aadharNumber: '',
  dlDocumentName: '',
  aadharDocumentName: '',
};

export default function FleetPage() {
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [drivers, setDrivers] = useState<DriverData[]>(() => getDrivers());
  const [filter, setFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<OnboardingMode>('both');
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [driverForm, setDriverForm] = useState(emptyDriverForm);
  const [reassigningTruck, setReassigningTruck] = useState<TruckData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const filteredTrucks = filter === 'ALL' ? trucks : trucks.filter(t => t.status === filter);
  const totalPages = Math.ceil(filteredTrucks.length / ITEMS_PER_PAGE);
  const paginatedTrucks = filteredTrucks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const persistLocalTrucks = (records: TruckData[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tms_local_trucks', JSON.stringify(records.filter(t => t.id.startsWith('local-truck-'))));
  };

  const persistLocalDrivers = (records: DriverData[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('tms_local_drivers', JSON.stringify(records.filter(d => d.id.startsWith('local-driver-'))));
  };

  const resetForms = () => {
    setVehicleForm(emptyVehicleForm);
    setDriverForm(emptyDriverForm);
    setOnboardingMode('both');
  };

  const selectedAssignedDriver = drivers.find(driver => driver.id === vehicleForm.assignedDriverId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const shouldCreateDriver = onboardingMode === 'driver' || onboardingMode === 'both';
    const shouldCreateVehicle = onboardingMode === 'vehicle' || onboardingMode === 'both';
    const newDriver: DriverData | null = shouldCreateDriver
      ? {
          id: `local-driver-${Date.now()}`,
          fullName: driverForm.fullName,
          phone: driverForm.phone,
          licenseNumber: driverForm.licenseNumber,
          aadharNumber: driverForm.aadharNumber,
          status: 'AVAILABLE',
          verified: Boolean(driverForm.licenseNumber && driverForm.aadharNumber),
        }
      : null;

    const driverForVehicle = newDriver || selectedAssignedDriver;
    const newTruck: TruckData | null = shouldCreateVehicle
      ? {
          id: `local-truck-${Date.now()}`,
          plateNumber: vehicleForm.plateNumber.toUpperCase(),
          model: vehicleForm.model,
          type: vehicleForm.type,
          capacity: `${parseFloat(vehicleForm.capacity || '0').toFixed(1)} Tons`,
          fuelCard: vehicleForm.fuelCard.toUpperCase() || 'PENDING',
          vendor: vehicleForm.vendor,
          subVendor: vehicleForm.subVendor,
          wheeler: vehicleForm.wheeler,
          rcDocumentName: vehicleForm.rcDocumentName,
          insuranceDocumentName: vehicleForm.insuranceDocumentName,
          pucDocumentName: vehicleForm.pucDocumentName,
          assignedDriverId: driverForVehicle?.id,
          assignedDriverName: driverForVehicle?.fullName,
          assignedDriverPhone: driverForVehicle?.phone,
          assignedDriverLicense: driverForVehicle?.licenseNumber,
          assignedDriverAadhar: driverForVehicle?.aadharNumber,
          health: 100,
          status: 'AVAILABLE',
        }
      : null;

    const nextDrivers = newDriver
      ? [...drivers, { ...newDriver, assignedTruckId: newTruck?.id, assignedTruckPlate: newTruck?.plateNumber }]
      : drivers;
    const nextTrucks = newTruck ? [...trucks, newTruck] : trucks;

    setDrivers(nextDrivers);
    setTrucks(nextTrucks);
    persistLocalDrivers(nextDrivers);
    persistLocalTrucks(nextTrucks);
    setShowModal(false);
    resetForms();
  };

  const handleReassignDriver = (driverId: string) => {
    if (!reassigningTruck) return;
    const driver = drivers.find(d => d.id === driverId);
    const nextTrucks = trucks.map(truck =>
      truck.id === reassigningTruck.id
        ? {
            ...truck,
            assignedDriverId: driver?.id,
            assignedDriverName: driver?.fullName,
            assignedDriverPhone: driver?.phone,
            assignedDriverLicense: driver?.licenseNumber,
            assignedDriverAadhar: driver?.aadharNumber,
          }
        : truck
    );
    const nextDrivers = drivers.map(existing =>
      existing.id === driverId
        ? { ...existing, assignedTruckId: reassigningTruck.id, assignedTruckPlate: reassigningTruck.plateNumber }
        : existing.assignedTruckId === reassigningTruck.id
          ? { ...existing, assignedTruckId: undefined, assignedTruckPlate: undefined }
          : existing
    );

    setTrucks(nextTrucks);
    setDrivers(nextDrivers);
    persistLocalTrucks(nextTrucks);
    persistLocalDrivers(nextDrivers);
    setReassigningTruck(null);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Fleet Control Specs</h2>
          <p className="text-xs text-slate-500 mt-1">Manage vehicle onboarding, vendor documents, driver linkage, and fleet health</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Fleet Onboarding
        </button>
      </div>

      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Utilization</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">
              {Math.round((trucks.filter(t => t.status === 'ON_TRIP').length / trucks.length) * 100) || 0}%
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">+2.4% vs last week</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Fuel Efficiency</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">4.8 Km / L</span>
            <span className="text-[10px] text-slate-400">Bulk Laden average</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Critical Health Alarms</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">{trucks.filter(t => t.health < 50).length} Vehicle</span>
            <span className="text-[10px] text-red-600 font-semibold">Immediate overhaul scheduled</span>
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Fleet Registry</h3>
          <div className="flex gap-2">
            <button onClick={() => { setFilter('ALL'); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === 'ALL' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>ALL</button>
            <button onClick={() => { setFilter('AVAILABLE'); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>AVAILABLE</button>
            <button onClick={() => { setFilter('MAINTENANCE'); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === 'MAINTENANCE' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>WORKSHOP</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Plate Number</th>
                <th className="px-6 py-4">Truck Specs</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Assigned Driver</th>
                <th className="px-6 py-4">Docs</th>
                <th className="px-6 py-4">Max Capacity</th>
                <th className="px-6 py-4">Active Fuel Card</th>
                <th className="px-6 py-4">Health Index</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {paginatedTrucks.map(truck => (
                <tr key={truck.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-800 font-mono tracking-wider">{truck.plateNumber}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-700">{truck.model} <span className="text-slate-400 font-normal">({truck.type})</span></div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{truck.wheeler || 'Wheeler not set'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-700">{truck.vendor || '—'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{truck.subVendor || 'No sub vendor'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-700">{truck.assignedDriverName || 'Not assigned'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{truck.assignedDriverPhone || truck.assignedDriverLicense || 'Use reassign to attach driver'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {[
                        ['RC', truck.rcDocumentName],
                        ['INS', truck.insuranceDocumentName],
                        ['PUC', truck.pucDocumentName],
                      ].map(([label, value]) => (
                        <span key={label} className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-500">{truck.capacity}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{truck.fuelCard}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${truck.health > 80 ? 'bg-emerald-500' : truck.health > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${truck.health}%` }} />
                      </div>
                      <span className={`font-bold text-[10px] ${truck.health > 80 ? 'text-emerald-600' : truck.health > 50 ? 'text-amber-600' : 'text-red-600'}`}>{truck.health}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setReassigningTruck(truck)}
                        className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-brand-primary/40 hover:text-brand-primary"
                        title="Edit or reassign driver"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                        truck.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        truck.status === 'ON_TRIP' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {truck.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedTrucks.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">No vehicles found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTrucks.length)} of {filteredTrucks.length} entries
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

      {/* Provision Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Fleet Onboarding</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Onboard vehicle, driver, or both as one linked record</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForms(); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
                {[
                  ['vehicle', 'Onboard Vehicle'],
                  ['driver', 'Onboard Driver'],
                  ['both', 'Onboard Both'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOnboardingMode(mode as OnboardingMode)}
                    className={`rounded-lg px-3 py-2 text-[10px] font-extrabold transition-all ${onboardingMode === mode ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(onboardingMode === 'vehicle' || onboardingMode === 'both') && (
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                    <Truck className="h-4 w-4 text-brand-primary" /> Vehicle Details
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Plate Number *">
                      <input type="text" required placeholder="e.g. OD-08-AB-1234" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm({...vehicleForm, plateNumber: e.target.value})} className="fleet-input uppercase font-mono" />
                    </Field>
                    <Field label="Truck Model *">
                      <input type="text" required placeholder="e.g. Tata Prima 4028.S" value={vehicleForm.model} onChange={(e) => setVehicleForm({...vehicleForm, model: e.target.value})} className="fleet-input" />
                    </Field>
                    <Field label="Vendor *">
                      <input type="text" required placeholder="Vendor company name" value={vehicleForm.vendor} onChange={(e) => setVehicleForm({...vehicleForm, vendor: e.target.value})} className="fleet-input" />
                    </Field>
                    <Field label="Sub Vendor">
                      <input type="text" placeholder="Sub vendor / owner name" value={vehicleForm.subVendor} onChange={(e) => setVehicleForm({...vehicleForm, subVendor: e.target.value})} className="fleet-input" />
                    </Field>
                    <Field label="Vehicle Type">
                      <select value={vehicleForm.type} onChange={(e) => setVehicleForm({...vehicleForm, type: e.target.value})} className="fleet-input">
                        {VEHICLE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </Field>
                    <Field label="Wheeler">
                      <select value={vehicleForm.wheeler} onChange={(e) => setVehicleForm({...vehicleForm, wheeler: e.target.value})} className="fleet-input">
                        {WHEELER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </Field>
                    <Field label="Max Capacity (Tons) *">
                      <input type="number" step="0.1" required placeholder="e.g. 40.5" value={vehicleForm.capacity} onChange={(e) => setVehicleForm({...vehicleForm, capacity: e.target.value})} className="fleet-input font-mono" />
                    </Field>
                    <Field label="Fuel Card No.">
                      <input type="text" placeholder="e.g. CARD-OD-8821" value={vehicleForm.fuelCard} onChange={(e) => setVehicleForm({...vehicleForm, fuelCard: e.target.value})} className="fleet-input uppercase font-mono" />
                    </Field>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FileUpload label="Vehicle RC" value={vehicleForm.rcDocumentName} onChange={(name) => setVehicleForm({...vehicleForm, rcDocumentName: name})} />
                    <FileUpload label="Vehicle Insurance" value={vehicleForm.insuranceDocumentName} onChange={(name) => setVehicleForm({...vehicleForm, insuranceDocumentName: name})} />
                    <FileUpload label="Vehicle PUC" value={vehicleForm.pucDocumentName} onChange={(name) => setVehicleForm({...vehicleForm, pucDocumentName: name})} />
                  </div>

                  {onboardingMode === 'vehicle' && (
                    <Field label="Attach Existing Driver *" className="mt-4">
                      <select required value={vehicleForm.assignedDriverId} onChange={(e) => setVehicleForm({...vehicleForm, assignedDriverId: e.target.value})} className="fleet-input">
                        <option value="">Choose driver...</option>
                        {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.fullName} - {driver.phone}</option>)}
                      </select>
                    </Field>
                  )}
                </section>
              )}

              {(onboardingMode === 'driver' || onboardingMode === 'both') && (
                <section className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                    <User className="h-4 w-4 text-brand-primary" /> Driver Details
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Driver Name *">
                      <input type="text" required placeholder="Driver full name" value={driverForm.fullName} onChange={(e) => setDriverForm({...driverForm, fullName: e.target.value})} className="fleet-input" />
                    </Field>
                    <Field label="Mobile No. *">
                      <input type="tel" required placeholder="+91 98765 43210" value={driverForm.phone} onChange={(e) => setDriverForm({...driverForm, phone: e.target.value})} className="fleet-input" />
                    </Field>
                    <Field label="Driving License No. *">
                      <input type="text" required placeholder="DL number" value={driverForm.licenseNumber} onChange={(e) => setDriverForm({...driverForm, licenseNumber: e.target.value.toUpperCase()})} className="fleet-input uppercase font-mono" />
                    </Field>
                    <Field label="Aadhar Card No. *">
                      <input type="text" required placeholder="12 digit Aadhar" value={driverForm.aadharNumber} onChange={(e) => setDriverForm({...driverForm, aadharNumber: e.target.value})} className="fleet-input font-mono" />
                    </Field>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FileUpload label="Driver DL Document" value={driverForm.dlDocumentName} onChange={(name) => setDriverForm({...driverForm, dlDocumentName: name})} />
                    <FileUpload label="Aadhar Card Document" value={driverForm.aadharDocumentName} onChange={(name) => setDriverForm({...driverForm, aadharDocumentName: name})} />
                  </div>
                </section>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowModal(false); resetForms(); }} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Complete Onboarding <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reassigningTruck && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Reassign Driver</h3>
                <p className="mt-1 text-[10px] font-semibold text-slate-500">{reassigningTruck.plateNumber}</p>
              </div>
              <button onClick={() => setReassigningTruck(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <select
              defaultValue={reassigningTruck.assignedDriverId || ''}
              onChange={(e) => handleReassignDriver(e.target.value)}
              className="fleet-input"
            >
              <option value="">Choose driver...</option>
              {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.fullName} - {driver.phone}</option>)}
            </select>
          </div>
        </div>
      )}

      <style jsx global>{`
        .fleet-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.625rem 0.75rem;
          color: #1e293b;
          outline: none;
        }
        .fleet-input:focus {
          border-color: rgb(37 99 235 / 0.65);
          box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function FileUpload({ label, value, onChange }: { label: string; value: string; onChange: (name: string) => void }) {
  return (
    <label className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      <span className="mb-2 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-brand-primary" /> {label}
      </span>
      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={(e) => onChange(e.target.files?.[0]?.name || '')}
        className="w-full text-[10px] text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-[10px] file:font-bold file:text-slate-600"
      />
      {value && <span className="mt-2 block truncate normal-case tracking-normal text-slate-700">{value}</span>}
    </label>
  );
}
