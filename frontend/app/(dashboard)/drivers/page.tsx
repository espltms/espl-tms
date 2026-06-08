'use client';

import { useState, useEffect } from 'react';
import { 
  User, ShieldCheck, AlertOctagon, UserPlus, Clock, X, Check, 
  ChevronRight, ChevronLeft, Search, Filter, Phone, Mail, 
  MapPin, Calendar, FileText, CreditCard, Eye, Edit2, Trash2,
  AlertTriangle, IndianRupee, Star, Award, Briefcase
} from 'lucide-react';
import SectionExcelExport from '@/components/SectionExcelExport';
import SectionExcelImport from '@/components/SectionExcelImport';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import tmsData from '@/app/data/tms_data_client.json';

interface Driver {
  id: string;
  fullName: string;
  fatherName: string;
  license: string;
  licenseExpiry: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  dateOfBirth: string;
  joiningDate: string;
  aadharNumber: string;
  panNumber: string;
  bloodGroup: string;
  dutyHours: string;
  safetyScore: number;
  status: 'AVAILABLE' | 'ON_TRIP' | 'SUSPENDED' | 'OFF_DUTY' | 'ON_LEAVE';
  salary: number;
  experience: number;
  vehicleType: string;
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const parseImportedDateToYYYYMMDD = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }

  // 1. Check if it's an Excel serial number (numeric value)
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const jsDate = new Date((num - 25569) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }

  // 2. Regular date string
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    const parts = str.replace(/[/\s.]+/g, '-').split('-');
    if (parts.length === 3) {
      const p0 = parts[0];
      const p1 = parts[1];
      const p2 = parts[2];

      if (p0.length === 4) {
        const mm = parseInt(p1, 10);
        if (mm >= 1 && mm <= 12) {
          return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
        }
      }
      if (p2.length === 4) {
        return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
      }
    }
    return '';
  }
  return parsed.toISOString().split('T')[0];
};

const mapDriverDataToDriver = (d: any): Driver => ({
  id: d.id,
  fullName: d.fullName || '',
  fatherName: d.fatherName || '',
  license: d.licenseNumber || d.license || '',
  licenseExpiry: d.licenseExpiry || '',
  phone: d.phone || '',
  emergencyPhone: d.emergencyPhone || '',
  email: d.email || '',
  address: d.address || '',
  city: d.city || '',
  state: d.state || '',
  pincode: d.pincode || '',
  dateOfBirth: d.dateOfBirth || '',
  joiningDate: d.joiningDate || '',
  aadharNumber: d.aadharNumber || '',
  panNumber: d.panNumber || '',
  bloodGroup: d.bloodGroup || 'O+',
  dutyHours: d.dutyHours || (d.status === 'ON_TRIP' ? '6.0 / 11h' : '0.0 / 11h'),
  safetyScore: d.safetyScore !== undefined ? d.safetyScore : (d.verified ? 100 : 0),
  status: d.status || 'AVAILABLE',
  salary: d.salary || 0,
  experience: d.experience || 0,
  vehicleType: d.vehicleType || ''
});

import { getDrivers } from '@/app/data/dataHelper';

const INITIAL_DRIVERS: Driver[] = getDrivers().map((d) => mapDriverDataToDriver(d));

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const VEHICLE_TYPES = ['Multi-Axle Trailer', 'Tanker', 'Tipper', 'Dalla', 'Flatbed', 'Container Carrier', 'Bulker', 'LPG Carrier', 'Car Carrier'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const emptyDriver: Omit<Driver, 'id'> = {
  fullName: '', fatherName: '', license: '', licenseExpiry: '', phone: '+91 ',
  emergencyPhone: '+91 ', email: '', address: '', city: '', state: '',
  pincode: '', dateOfBirth: '', joiningDate: new Date().toISOString().split('T')[0],
  aadharNumber: '', panNumber: '', bloodGroup: 'O+', dutyHours: '0.0 / 11h',
  safetyScore: 100, status: 'AVAILABLE', salary: 25000, experience: 0, vehicleType: 'Multi-Axle Trailer'
};

export default function DriversPage() {
  const { user } = useAuthStore();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showProfile, setShowProfile] = useState<Driver | null>(null);
  const [formStep, setFormStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formData, setFormData] = useState<Omit<Driver, 'id'>>(emptyDriver);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const persistDriversState = (allDrivers: Driver[]) => {
    const defaultIds = new Set((tmsData.drivers || []).map((d: any) => d.id));
    const localDrivers = allDrivers.filter(d => !defaultIds.has(d.id));
    saveSyncedValue('tms_local_drivers', localDrivers);
  };

  /* ── Load from synced storage ── */
  useEffect(() => {
    // 1. Instant local load
    const initialDrivers = getDrivers().map(mapDriverDataToDriver);
    setDrivers(initialDrivers);

    // 2. Background Database sync
    fetchSyncedValue<any[]>('tms_local_drivers', []).then((syncedLocalDrivers) => {
      const isRegionalAdmin = () => {
        if (typeof window === 'undefined') return false;
        try {
          const u = JSON.parse(window.localStorage.getItem('tms_user') || 'null');
          return u?.role === 'REGION_ADMIN';
        } catch {
          return false;
        }
      };
      
      const defaultDrivers = isRegionalAdmin() ? [] : (tmsData.drivers || []);
      const combined = [...syncedLocalDrivers, ...defaultDrivers].map(mapDriverDataToDriver);
      setDrivers(combined);
    });
  }, []);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  /* ── Excel Import Event Listener ── */
  useEffect(() => {
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '';
    };

    const handleExcelImport = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: { id: string; fileName: string; importedAt: string; headers: string[]; rows: string[][] } }>).detail;
      if (!detail || detail.sectionName !== 'Driver Duty Logs') return;

      const importedDrivers = detail.import.rows.map((row, index): Driver => {
        const fullName = getCellValue(detail.import.headers, row, ['full name', 'driver name', 'name', 'driver']);
        const fatherName = getCellValue(detail.import.headers, row, ['father name', 'fathers name', 'father\'s name', 'father']);
        const license = getCellValue(detail.import.headers, row, ['license', 'license number', 'license no', 'licence', 'dl', 'dl no', 'dl number']).toUpperCase();
        const licenseExpiry = parseImportedDateToYYYYMMDD(getCellValue(detail.import.headers, row, ['license expiry', 'license validity', 'dl validity', 'dl expiry']));
        const phone = getCellValue(detail.import.headers, row, ['phone', 'phone number', 'mobile', 'mobile number', 'mobile no', 'contact']);
        const emergencyPhone = getCellValue(detail.import.headers, row, ['emergency phone', 'emergency mobile', 'emergency contact', 'emergency no']);
        const email = getCellValue(detail.import.headers, row, ['email', 'email id', 'email address']);
        const address = getCellValue(detail.import.headers, row, ['address', 'street', 'residential address']);
        const city = getCellValue(detail.import.headers, row, ['city', 'town']);
        const state = getCellValue(detail.import.headers, row, ['state', 'province']);
        const pincode = getCellValue(detail.import.headers, row, ['pincode', 'pin code', 'pin', 'zip', 'zipcode']);
        const dateOfBirth = parseImportedDateToYYYYMMDD(getCellValue(detail.import.headers, row, ['date of birth', 'dob', 'birth date']));
        const joiningDate = parseImportedDateToYYYYMMDD(getCellValue(detail.import.headers, row, ['joining date', 'date of joining', 'doj'])) || new Date().toISOString().split('T')[0];
        const aadharNumber = getCellValue(detail.import.headers, row, ['aadhar', 'aadhar number', 'aadhar no', 'adhaar']);
        const panNumber = getCellValue(detail.import.headers, row, ['pan', 'pan number', 'pan no']).toUpperCase();
        
        let bloodGroup = getCellValue(detail.import.headers, row, ['blood group', 'blood']).toUpperCase().replace(/\s/g, '');
        if (!BLOOD_GROUPS.includes(bloodGroup)) {
          bloodGroup = 'O+';
        }

        const salaryVal = getCellValue(detail.import.headers, row, ['salary', 'wages', 'monthly salary']);
        const salary = parseFloat(salaryVal) || 25000;

        const experienceVal = getCellValue(detail.import.headers, row, ['experience', 'exp', 'years of experience']);
        const experience = parseFloat(experienceVal) || 0;

        const vehicleType = getCellValue(detail.import.headers, row, ['vehicle type', 'truck type', 'vehicle expertise']);

        return {
          id: `drv-import-${Date.now()}-${index}`,
          fullName,
          fatherName,
          license,
          licenseExpiry,
          phone,
          emergencyPhone,
          email,
          address,
          city,
          state,
          pincode,
          dateOfBirth,
          joiningDate,
          aadharNumber,
          panNumber,
          bloodGroup,
          dutyHours: '0.0 / 11h',
          safetyScore: 100,
          status: 'AVAILABLE',
          salary,
          experience,
          vehicleType,
        };
      }).filter(d => d.fullName && d.license);

      if (importedDrivers.length === 0) return;

      setDrivers(prev => {
        const next = [...prev];
        importedDrivers.forEach(idr => {
          const cleanLicense = (l: string) => l.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const idx = next.findIndex(r => r.license && cleanLicense(r.license) === cleanLicense(idr.license));
          if (idx >= 0) {
            const merged = { ...next[idx] };
            Object.keys(idr).forEach(key => {
              const val = idr[key as keyof Driver];
              if (val !== undefined && val !== '-' && val !== '') {
                (merged as any)[key] = val;
              }
            });
            next[idx] = merged;
          } else {
            next.push(idr);
          }
        });
        persistDriversState(next);
        return next;
      });
      setCurrentPage(1);
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [drivers]);

  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.license.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.phone.includes(searchQuery) ||
      d.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredDrivers.length / ITEMS_PER_PAGE);
  const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const stats = {
    total: drivers.length,
    available: drivers.filter(d => d.status === 'AVAILABLE').length,
    onTrip: drivers.filter(d => d.status === 'ON_TRIP').length,
    suspended: drivers.filter(d => d.status === 'SUSPENDED').length,
    avgSafety: drivers.length > 0 ? Math.round(drivers.reduce((sum, d) => sum + d.safetyScore, 0) / drivers.length * 10) / 10 : 0,
    totalSalary: drivers.reduce((sum, d) => sum + d.salary, 0),
  };

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    if (step === 0) {
      if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
      if (!formData.fatherName.trim()) errors.fatherName = 'Father\'s name is required';
      if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
      if (!formData.phone || formData.phone.length < 10) errors.phone = 'Valid phone number is required';
      if (!formData.email.includes('@')) errors.email = 'Valid email is required';
      if (!formData.bloodGroup) errors.bloodGroup = 'Blood group is required';
    } else if (step === 1) {
      if (!formData.license.trim()) errors.license = 'License number is required';
      if (!formData.licenseExpiry) errors.licenseExpiry = 'License expiry is required';
      if (!formData.aadharNumber || formData.aadharNumber.replace(/\s/g, '').length < 12) errors.aadharNumber = 'Valid 12-digit Aadhar number is required';
      if (!formData.panNumber || formData.panNumber.length < 10) errors.panNumber = 'Valid PAN number is required';
      if (!formData.vehicleType) errors.vehicleType = 'Vehicle type expertise is required';
    } else if (step === 2) {
      if (!formData.address.trim()) errors.address = 'Address is required';
      if (!formData.city.trim()) errors.city = 'City is required';
      if (!formData.state) errors.state = 'State is required';
      if (!formData.pincode || formData.pincode.length < 6) errors.pincode = 'Valid 6-digit pincode is required';
      if (!formData.emergencyPhone || formData.emergencyPhone.length < 10) errors.emergencyPhone = 'Emergency phone is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(formStep)) {
      setFormStep(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    if (!validateStep(2)) return;

    let nextDrivers = [...drivers];
    if (editingId) {
      nextDrivers = drivers.map(d => d.id === editingId ? { ...formData, id: editingId } : d);
      setDrivers(nextDrivers);
      setSuccessMessage(`Driver ${formData.fullName} updated successfully!`);
    } else {
      const newDriver: Driver = {
        ...formData,
        id: Date.now().toString(),
      };
      nextDrivers = [...drivers, newDriver];
      setDrivers(nextDrivers);
      setSuccessMessage(`Driver ${formData.fullName} onboarded successfully!`);
    }
    persistDriversState(nextDrivers);
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setFormStep(0);
    setFormData(emptyDriver);
    setEditingId(null);
    setFormErrors({});
  };

  const openEdit = (driver: Driver) => {
    const { id, ...rest } = driver;
    setFormData(rest);
    setEditingId(id);
    setFormStep(0);
    setShowModal(true);
  };

  const confirmDelete = (id: string) => {
    const nextDrivers = drivers.filter(d => d.id !== id);
    setDrivers(nextDrivers);
    persistDriversState(nextDrivers);
    setShowDeleteConfirm(null);
    setSuccessMessage('Driver removed from system.');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-brand-success/10 text-brand-success border-brand-success/20';
      case 'ON_TRIP': return 'bg-brand-primary/10 text-brand-primary border-brand-primary/20';
      case 'SUSPENDED': return 'bg-brand-danger/10 text-brand-danger border-brand-danger/20';
      case 'OFF_DUTY': return 'bg-gray-500/10 text-slate-500 border-gray-500/20';
      case 'ON_LEAVE': return 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20';
      default: return 'bg-gray-500/10 text-slate-500 border-gray-500/20';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const STEPS = ['Personal Details', 'License & KYC', 'Address & Emergency'];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Success Toast */}
      {successMessage && (
        <div className="fixed top-20 right-6 z-[200] flex items-center gap-3 rounded-xl bg-brand-success/20 border border-brand-success/30 px-5 py-3.5 text-sm font-bold text-brand-success shadow-2xl animate-slide-in backdrop-blur-md">
          <Check className="h-5 w-5" />
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Driver Control Tower</h2>
          <p className="text-xs text-slate-500 mt-1">Audit crew duty logs, safety records, and driver hours of service constraints</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="Driver Duty Logs" />}
          <SectionExcelExport sectionName="Driver Duty Logs" />
          <button
            onClick={() => { setFormData(emptyDriver); setEditingId(null); setFormStep(0); setShowModal(true); }}
            id="onboard-new-driver-btn"
            className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-glass-glow"
          >
            <UserPlus className="h-4 w-4" /> Onboard New Driver
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="glass-card rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Crew</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.total}</span>
            <span className="text-[10px] text-slate-400">Registered Drivers</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-success">{stats.available}</span>
            <span className="text-[10px] text-brand-success font-semibold">Ready for dispatch</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On Active Trip</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-primary">{stats.onTrip}</span>
            <span className="text-[10px] text-slate-400">Currently driving</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Safety Score</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.avgSafety}</span>
            <span className="text-[10px] text-brand-success font-semibold">/ 100</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Monthly Payroll</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-brand-secondary">{formatCurrency(stats.totalSalary)}</span>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="glass-panel rounded-2xl border border-brand-slate p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, license, phone, or city..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-all"
            id="driver-search-input"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'AVAILABLE', 'ON_TRIP', 'SUSPENDED', 'OFF_DUTY', 'ON_LEAVE'].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
                statusFilter === status 
                  ? 'bg-brand-primary text-white' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900'
              }`}
            >
              {status === 'ALL' ? 'ALL' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Driver Grid Table */}
      <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden">
        <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Crew Duty Registry</h3>
          <span className="text-[10px] text-slate-400 font-semibold">{filteredDrivers.length} of {drivers.length} drivers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">SL.</th>
                <th className="px-6 py-4">Driver Name</th>
                <th className="px-6 py-4">License</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">City</th>
                <th className="px-6 py-4">Duty Timer (HOS)</th>
                <th className="px-6 py-4">Safety Index</th>
                <th className="px-6 py-4">Salary</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
              {paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <User className="h-8 w-8 text-slate-400" />
                      <span className="text-sm font-semibold">No drivers found</span>
                      <span className="text-xs">Try adjusting your search or filters</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedDrivers.map((driver, idx) => (
                <tr key={driver.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-400">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-800 block">{driver.fullName}</span>
                        <span className="text-[10px] text-slate-400">{driver.experience} yrs • {driver.vehicleType}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px]">{driver.license}</td>
                  <td className="px-6 py-4 text-slate-500">{driver.phone}</td>
                  <td className="px-6 py-4 text-slate-500">{driver.city}, {driver.state}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-brand-primary" />
                      <span>{driver.dutyHours}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-[#e2e8f0] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${driver.safetyScore > 85 ? 'bg-brand-success' : driver.safetyScore > 60 ? 'bg-brand-warning' : 'bg-brand-danger'}`} 
                          style={{ width: `${driver.safetyScore}%` }} 
                        />
                      </div>
                      <span className={`font-bold text-[10px] ${driver.safetyScore > 85 ? 'text-brand-success' : driver.safetyScore > 60 ? 'text-brand-warning' : 'text-brand-danger'}`}>
                        {driver.safetyScore}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-brand-secondary text-[11px]">{formatCurrency(driver.salary)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${getStatusColor(driver.status)}`}>
                      {driver.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setShowProfile(driver)}
                        className="rounded-lg p-1.5 hover:bg-brand-primary/10 text-slate-500 hover:text-brand-primary transition-all"
                        title="View Profile"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => openEdit(driver)}
                        className="rounded-lg p-1.5 hover:bg-brand-secondary/10 text-slate-500 hover:text-brand-secondary transition-all"
                        title="Edit Driver"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(driver.id)}
                        className="rounded-lg p-1.5 hover:bg-brand-danger/10 text-slate-500 hover:text-brand-danger transition-all"
                        title="Remove Driver"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredDrivers.length)} of {filteredDrivers.length} entries
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

      {/* ======================== ONBOARD / EDIT MODAL ======================== */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-[#e2e8f0] shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e2e8f0] bg-white px-6 py-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">
                  {editingId ? 'Edit Driver Profile' : 'Onboard New Driver'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingId ? 'Update driver information and credentials' : 'Register a new crew member to the fleet management system'}
                </p>
              </div>
              <button onClick={closeModal} className="rounded-xl p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Progress Indicator */}
            <div className="px-6 pt-5">
              <div className="flex items-center gap-2">
                {STEPS.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center justify-center h-7 w-7 rounded-full text-[10px] font-bold transition-all shrink-0 ${
                      idx < formStep ? 'bg-brand-success text-white' :
                      idx === formStep ? 'bg-brand-primary text-white shadow-glass-glow' :
                      'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}>
                      {idx < formStep ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    <span className={`text-[10px] font-semibold truncate ${
                      idx <= formStep ? 'text-slate-800' : 'text-slate-400'
                    }`}>{step}</span>
                    {idx < STEPS.length - 1 && (
                      <div className={`flex-1 h-px ${idx < formStep ? 'bg-brand-success' : 'bg-[#e2e8f0]'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-5">
              {/* Step 0 — Personal Details */}
              {formStep === 0 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Full Name *" error={formErrors.fullName} icon={<User className="h-4 w-4" />}>
                      <input
                        type="text" placeholder="e.g. Rajesh Kumar Sharma"
                        value={formData.fullName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="form-input-field"
                        id="driver-full-name"
                      />
                    </FormField>
                    <FormField label="Father's Name *" error={formErrors.fatherName} icon={<User className="h-4 w-4" />}>
                      <input
                        type="text" placeholder="e.g. Ramesh Sharma"
                        value={formData.fatherName}
                        onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Date of Birth *" error={formErrors.dateOfBirth} icon={<Calendar className="h-4 w-4" />}>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="Blood Group *" error={formErrors.bloodGroup}>
                      <select
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                        className="form-input-field"
                      >
                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                      </select>
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Mobile Number *" error={formErrors.phone} icon={<Phone className="h-4 w-4" />}>
                      <input
                        type="tel" placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="Email Address *" error={formErrors.email} icon={<Mail className="h-4 w-4" />}>
                      <input
                        type="email" placeholder="driver@company.in"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {/* Step 1 — License & KYC */}
              {formStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Driving License No. *" error={formErrors.license} icon={<CreditCard className="h-4 w-4" />}>
                      <input
                        type="text" placeholder="e.g. DL-2024-1948271"
                        value={formData.license}
                        onChange={(e) => setFormData(prev => ({ ...prev, license: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="License Expiry *" error={formErrors.licenseExpiry} icon={<Calendar className="h-4 w-4" />}>
                      <input
                        type="date"
                        value={formData.licenseExpiry}
                        onChange={(e) => setFormData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Aadhar Number *" error={formErrors.aadharNumber} icon={<FileText className="h-4 w-4" />}>
                      <input
                        type="text" placeholder="e.g. 4532 8821 9948"
                        value={formData.aadharNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, aadharNumber: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="PAN Number *" error={formErrors.panNumber} icon={<FileText className="h-4 w-4" />}>
                      <input
                        type="text" placeholder="e.g. ABCPS1234F"
                        value={formData.panNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                        className="form-input-field uppercase"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="Vehicle Type Expertise *" error={formErrors.vehicleType} icon={<Briefcase className="h-4 w-4" />}>
                      <select
                        value={formData.vehicleType}
                        onChange={(e) => setFormData(prev => ({ ...prev, vehicleType: e.target.value }))}
                        className="form-input-field"
                      >
                        {VEHICLE_TYPES.map(vt => <option key={vt} value={vt}>{vt}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Experience (Years)" icon={<Award className="h-4 w-4" />}>
                      <input
                        type="number" min="0" max="50" placeholder="0"
                        value={formData.experience}
                        onChange={(e) => setFormData(prev => ({ ...prev, experience: parseInt(e.target.value) || 0 }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="Monthly Salary (₹)" icon={<IndianRupee className="h-4 w-4" />}>
                      <input
                        type="number" min="10000" step="1000" placeholder="25000"
                        value={formData.salary}
                        onChange={(e) => setFormData(prev => ({ ...prev, salary: parseInt(e.target.value) || 0 }))}
                        className="form-input-field"
                      />
                    </FormField>
                  </div>
                </div>
              )}

              {/* Step 2 — Address & Emergency */}
              {formStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <FormField label="Residential Address *" error={formErrors.address} icon={<MapPin className="h-4 w-4" />}>
                    <input
                      type="text" placeholder="e.g. 45-B, Sector 12, Industrial Area"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      className="form-input-field"
                    />
                  </FormField>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField label="City *" error={formErrors.city}>
                      <input
                        type="text" placeholder="e.g. Gurgaon"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="State *" error={formErrors.state}>
                      <select
                        value={formData.state}
                        onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                        className="form-input-field"
                      >
                        <option value="">Select State</option>
                        {INDIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Pincode *" error={formErrors.pincode}>
                      <input
                        type="text" maxLength={6} placeholder="e.g. 122001"
                        value={formData.pincode}
                        onChange={(e) => setFormData(prev => ({ ...prev, pincode: e.target.value.replace(/\D/g, '') }))}
                        className="form-input-field"
                      />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Emergency Contact Phone *" error={formErrors.emergencyPhone} icon={<Phone className="h-4 w-4" />}>
                      <input
                        type="tel" placeholder="+91 98765 43211"
                        value={formData.emergencyPhone}
                        onChange={(e) => setFormData(prev => ({ ...prev, emergencyPhone: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                    <FormField label="Joining Date">
                      <input
                        type="date"
                        value={formData.joiningDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, joiningDate: e.target.value }))}
                        className="form-input-field"
                      />
                    </FormField>
                  </div>
                  <FormField label="Initial Status">
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Driver['status'] }))}
                      className="form-input-field"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="OFF_DUTY">Off Duty</option>
                      <option value="ON_LEAVE">On Leave</option>
                    </select>
                  </FormField>
                </div>
              )}
            </div>

            {/* Modal Footer — Navigation */}
            <div className="sticky bottom-0 flex items-center justify-between border-t border-[#e2e8f0] bg-white px-6 py-4">
              <button
                onClick={() => formStep > 0 ? setFormStep(prev => prev - 1) : closeModal()}
                className="flex items-center gap-2 rounded-xl border border-[#d1d5db] bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-gray-500 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                {formStep > 0 ? 'Previous' : 'Cancel'}
              </button>

              {formStep < STEPS.length - 1 ? (
                <button
                  onClick={handleNextStep}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-glass-glow"
                >
                  Next Step <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  id="submit-driver-btn"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-success to-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all"
                >
                  <Check className="h-4 w-4" />
                  {editingId ? 'Save Changes' : 'Complete Onboarding'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================== DRIVER PROFILE MODAL ======================== */}
      {showProfile && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-[#e2e8f0] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] px-6 py-4">
              <h3 className="text-lg font-extrabold text-slate-800">Driver Profile</h3>
              <button onClick={() => setShowProfile(null)} className="rounded-xl p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-brand-primary to-blue-600 flex items-center justify-center shadow-glass-glow">
                  <User className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-extrabold text-slate-800">{showProfile.fullName}</h4>
                  <p className="text-xs text-slate-500">S/o {showProfile.fatherName}</p>
                  <span className={`inline-block mt-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${getStatusColor(showProfile.status)}`}>
                    {showProfile.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <ProfileItem label="License" value={showProfile.license} />
                <ProfileItem label="License Expiry" value={showProfile.licenseExpiry} />
                <ProfileItem label="Phone" value={showProfile.phone} />
                <ProfileItem label="Email" value={showProfile.email} />
                <ProfileItem label="Aadhar" value={showProfile.aadharNumber} />
                <ProfileItem label="PAN" value={showProfile.panNumber} />
                <ProfileItem label="Blood Group" value={showProfile.bloodGroup} />
                <ProfileItem label="Date of Birth" value={showProfile.dateOfBirth} />
                <ProfileItem label="City" value={`${showProfile.city}, ${showProfile.state}`} />
                <ProfileItem label="Pincode" value={showProfile.pincode} />
                <ProfileItem label="Vehicle Expertise" value={showProfile.vehicleType} />
                <ProfileItem label="Experience" value={`${showProfile.experience} Years`} />
                <ProfileItem label="Safety Score" value={`${showProfile.safetyScore} / 100`} highlight={showProfile.safetyScore > 85 ? 'success' : 'danger'} />
                <ProfileItem label="Monthly Salary" value={formatCurrency(showProfile.salary)} highlight="secondary" />
                <ProfileItem label="Emergency Contact" value={showProfile.emergencyPhone} />
                <ProfileItem label="Joined" value={showProfile.joiningDate} />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowProfile(null); openEdit(showProfile); }}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 py-2.5 text-xs font-bold text-brand-primary hover:bg-brand-primary/20 transition-all"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit Profile
                </button>
                <button
                  onClick={() => setShowProfile(null)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[#d1d5db] bg-white py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================== DELETE CONFIRM MODAL ======================== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm mx-4 rounded-2xl bg-white border border-brand-danger/20 shadow-2xl p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-brand-danger" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-800">Remove Driver?</h4>
                <p className="text-xs text-slate-500 mt-1">This action will permanently remove the driver from the fleet management system. This cannot be undone.</p>
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 rounded-xl border border-[#d1d5db] bg-white py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(showDeleteConfirm)}
                  className="flex-1 rounded-xl bg-brand-danger py-2.5 text-xs font-bold text-white hover:bg-brand-danger/90 transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-slide-in { animation: slide-in 0.4s ease-out; }
        .form-input-field {
          width: 100%;
          border-radius: 0.75rem;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #1e293b;
          font-size: 0.8rem;
          padding: 0.625rem 0.75rem;
          outline: none;
          transition: all 0.2s;
        }
        .form-input-field:focus {
          border-color: rgba(37, 99, 235, 0.5);
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        .form-input-field::placeholder {
          color: #94a3b8;
        }
        select.form-input-field {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          padding-right: 2rem;
        }
        select.form-input-field option {
          background: #ffffff;
          color: #1e293b;
        }
      `}</style>
    </div>
  );
}

// ======================== HELPER COMPONENTS ========================

function FormField({ label, error, icon, children }: { 
  label: string; 
  error?: string; 
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {icon && <span className="text-slate-400">{icon}</span>}
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[10px] text-brand-danger font-semibold flex items-center gap-1">
          <AlertOctagon className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

function ProfileItem({ label, value, highlight }: { 
  label: string; 
  value: string; 
  highlight?: 'success' | 'danger' | 'secondary';
}) {
  const highlightColor = highlight === 'success' ? 'text-brand-success' : 
    highlight === 'danger' ? 'text-brand-danger' : 
    highlight === 'secondary' ? 'text-brand-secondary' : 'text-slate-800';

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
      <span className={`text-xs font-semibold mt-1 block ${highlightColor}`}>{value}</span>
    </div>
  );
}
