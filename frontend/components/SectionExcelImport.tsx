'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Trash2, Upload, X, CheckCircle2 } from 'lucide-react';

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
};

const normalize = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const SECTION_COLUMN_ALIASES: Record<string, string[]> = {
  'Fleet Master': [
    'vehicle no', 'vehicle_no', 'plate number', 'vehicle number', 'vehicle no.',
    'vendor', 'vendor name', 'vendor company',
    'sub vendor', 'sub-vendor', 'sub_vendor', 'subvendor', 'owner', 'owner name',
    'vehicle type', 'truck type', 'type',
    'wheeler', 'wheelers', 'no of wheels',
    'rc no', 'rc number', 'rc', 'registration',
    'fitness validity from', 'fitness from', 'fitness start',
    'fitness validity to', 'fitness to', 'fitness end', 'fitness expiry',
    'insurance validity upto', 'insurance validity', 'insurance upto', 'insurance expiry', 'insurance',
    'puc validity', 'puc', 'puc expiry',
    'name of the driver', 'driver name', 'driver', 'name of driver',
    'dl', 'dl no', 'dl number', 'driving license', 'license', 'licence',
    'dl validity till', 'dl validity', 'dl expiry', 'license expiry',
    'mob no of the driver', 'mob no', 'mobile', 'mobile no', 'phone', 'driver phone', 'driver mobile', 'contact'
  ],
  'Sub-Vendor Master': [
    'sub-vendor', 'sub vendor', 'sub_vendor', 'subvendor', 'owner', 'owner name', 'name',
    'mobile', 'mobile no', 'phone', 'contact',
    'pan', 'pan no', 'pan number',
    'gstin', 'gst', 'gstin no', 'gstin number'
  ],
  'Vendor Master': [
    'vendor', 'vendor name', 'vendor company', 'name',
    'mobile', 'mobile no', 'phone', 'contact',
    'pan', 'pan no', 'pan number',
    'gstin', 'gst', 'gstin no', 'gstin number'
  ],
  'Trip Dispatch & Loading': [
    'truck', 'truck plate', 'vehicle', 'vehicle no', 'vehicle number', 'plate number', 'no plate', 'vehicle_no',
    'po number', 'po no', 'purchase order', 'purchase order contract', 'contract', 'po',
    'gross', 'gross weight', 'gross wt', 'gross wt.', 'gross tons', 'gross_weight', 'grosswt',
    'tare', 'tare weight', 'tare wt', 'tare wt.', 'tare tons', 'tare_weight', 'tarewt',
    'net wt', 'net wt.', 'net weight', 'netwt', 'netwt.', 'netweight', 'net tons', 'net qty', 'netqty', 'qty', 'quantity', 'estimated quantity', 'actual loaded', 'qty/net',
    'ticket', 'ticket no', 'ticket number', 'weigh ticket', 'ticket_no',
    'challan', 'challan no', 'challan number', 'challan_no',
    'date', 'loading date', 'timestamp', 'datetime', 'time', 'date_val', 'time and date of loading',
    'location', 'destination', 'unloading', 'unloading point', 'destination unloading', 'location/destination',
    'source', 'origin', 'loading point', 'loading_point', 'source loading',
    'vendor', 'vendor company', 'transporter', 'carrier', 'vendor name', 'company',
    'vehicle type', 'truck type', 'type', 'vehicle_type', 'wheeler',
    'driver', 'driver name', 'driver partner', 'driver_name',
    'driver phone', 'phone', 'mobile', 'driver_phone', 'phone no', 'phone number',
    'commodity', 'material', 'product', 'cargo', 'item',
    'trip', 'trip no', 'trip number', 'trip_no'
  ],
  'Driver Duty Logs': [
    'full name', 'driver name', 'name', 'driver',
    'father name', 'fathers name', 'father\'s name', 'father',
    'license', 'license number', 'license no', 'licence', 'dl', 'dl no', 'dl number',
    'license expiry', 'license validity', 'dl validity', 'dl expiry',
    'phone', 'phone number', 'mobile', 'mobile number', 'mobile no', 'contact',
    'emergency phone', 'emergency mobile', 'emergency contact', 'emergency no',
    'email', 'email id', 'email address',
    'address', 'street', 'residential address',
    'city', 'town',
    'state', 'province',
    'pincode', 'pin code', 'pin', 'zip', 'zipcode',
    'date of birth', 'dob', 'birth date',
    'joining date', 'date of joining', 'doj',
    'aadhar', 'aadhar number', 'aadhar no', 'adhaar',
    'pan', 'pan number', 'pan no',
    'blood group', 'blood',
    'salary', 'wages', 'monthly salary',
    'experience', 'exp', 'years of experience',
    'vehicle type', 'truck type', 'vehicle expertise'
  ],
  'HR & Payroll Center': [
    'name', 'full name', 'employee name', 'employee',
    'email', 'corporate email', 'email address', 'email id',
    'department', 'role', 'dept',
    'salary', 'base salary', 'monthly salary', 'pay',
    'allowance', 'transit allowance', 'daily allowance',
    'safety score', 'safety index', 'safety score (%)', 'safety',
    'join date', 'joining date', 'hire date', 'doj'
  ],
  'Fuel Finances': [
    'vehicle no', 'vehicle number', 'plate number', 'vehicle', 'truck',
    'date', 'transaction date', 'timestamp',
    'service', 'fuel type', 'consumable', 'type',
    'quantity', 'qty', 'litres', 'liters', 'volume',
    'rate', 'price per unit', 'rate per unit',
    'value', 'total value', 'cost', 'total cost', 'amount'
  ]
};

const storageKeyFor = (sectionName: string) => {
  const slug = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
  return `tms_imported_excel_${slug}`;
};

export default function SectionExcelImport({ sectionName }: { sectionName: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imports, setImports] = useState<ImportedSheet[]>([]);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportedSheet | null>(null);

  const storageKey = useMemo(() => storageKeyFor(sectionName), [sectionName]);
  const latestImport = imports[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setImports(saved ? JSON.parse(saved) : []);
    } catch {
      localStorage.removeItem(storageKey);
      setImports([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const persistImports = (nextImports: ImportedSheet[]) => {
    localStorage.setItem(storageKey, JSON.stringify(nextImports));
    setImports(nextImports);
  };

  const confirmImport = () => {
    if (!pendingImport) return;

    const nextImports = [pendingImport, ...imports];
    persistImports(nextImports);

    window.dispatchEvent(new CustomEvent('tms:excel-imported', {
      detail: {
        sectionName,
        import: pendingImport,
      },
    }));

    setToast(`"${pendingImport.fileName}" imported successfully and reflected in the page.`);
    setPendingImport(null);
    setOpen(false);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setLoading(true);
    setPendingImport(null);

    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error('No sheet found in this file.');
      }

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheetName], {
        header: 1,
        defval: '',
        blankrows: false,
      });

      const nonEmptyRows = matrix
         .map(row => row.map(normalize))
         .filter(row => row.some(Boolean));

      if (nonEmptyRows.length === 0) {
        throw new Error('This file does not contain readable rows.');
      }

      const maxColumns = Math.max(...nonEmptyRows.map(row => row.length));
      const row0 = nonEmptyRows[0] || [];
      const row1 = nonEmptyRows[1] || [];
      
      const isSubHeaderRow = row1.some(val => {
        const v = String(val).toLowerCase();
        return v === 'from' || v === 'to' || v.includes('validity') || v.includes('upto') || v === 'till';
      });

      let headers: string[] = [];
      let startRowIndex = 1;

      if (isSubHeaderRow) {
        startRowIndex = 2; // skips the sub-header row as data
        let lastParentHeader = '';
        for (let idx = 0; idx < maxColumns; idx++) {
          const parent = (row0[idx] || '').trim();
          const child = (row1[idx] || '').trim();
          
          if (parent) {
            lastParentHeader = parent;
          }
          
          let combined = '';
          if (lastParentHeader && child) {
            if (child.toLowerCase() === lastParentHeader.toLowerCase()) {
              combined = lastParentHeader;
            } else {
              combined = `${lastParentHeader} ${child}`;
            }
          } else {
            combined = child || lastParentHeader || `Column ${idx + 1}`;
          }
          headers.push(combined);
        }
      } else {
        headers = Array.from({ length: maxColumns }, (_, idx) => row0[idx] || `Column ${idx + 1}`);
      }

      // Validate headers against expected section columns
      const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      const expectedAliases = SECTION_COLUMN_ALIASES[sectionName] || [];
      if (expectedAliases.length > 0) {
        const normalizedExpected = expectedAliases.map(normalizeHeader);
        const normalizedExcelHeaders = headers.map(normalizeHeader);
        const hasAnyMatch = normalizedExcelHeaders.some(h => normalizedExpected.includes(h));
        if (!hasAnyMatch) {
          throw new Error('The file structure or data is incorrect for this section.');
        }
      }

      const rows = nonEmptyRows.slice(startRowIndex).map(row => headers.map((_, idx) => row[idx] || ''));

      const importedSheet: ImportedSheet = {
        id: `${Date.now()}-${file.name}`,
        fileName: file.name,
        importedAt: new Date().toISOString(),
        headers,
        rows,
      };

      setPendingImport(importedSheet);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read this Excel file.');
      setOpen(true);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clearImport = (id: string) => {
    persistImports(imports.filter(item => item.id !== id));
  };

  const toastContent = toast && (
    <div className="fixed top-5 right-5 z-[300] flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/95 backdrop-blur-md px-4 py-3 shadow-2xl animate-slide-in max-w-sm">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 animate-bounce" />
      <div className="flex-1">
        <h4 className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider">Excel Sheet Imported</h4>
        <p className="text-[10px] text-emerald-700 mt-0.5">{toast}</p>
      </div>
      <button 
        onClick={() => setToast(null)} 
        className="rounded-lg p-1 text-emerald-400 hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const modalContent = open && (
    <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-6 shrink-0">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">
              {pendingImport ? 'Preview Excel Import' : 'Imported Excel Data'}
            </h3>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{sectionName}</p>
          </div>
          <button 
            onClick={() => {
              setOpen(false);
              setPendingImport(null);
            }} 
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {pendingImport ? (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-extrabold text-amber-950">
                    <FileSpreadsheet className="h-4 w-4 text-amber-600" />
                    <span>{pendingImport.fileName}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    Ready to import: {pendingImport.rows.length} rows found
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={confirmImport}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Import This
                  </button>
                  <button
                    onClick={() => setPendingImport(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    Discard
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      {pendingImport.headers.map((header, idx) => (
                        <th key={`${header}-${idx}`} className="px-4 py-3 font-bold uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {pendingImport.rows.slice(0, 20).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50">
                        {pendingImport.headers.map((_, idx) => (
                          <td key={idx} className="px-4 py-3">
                            {row[idx]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pendingImport.rows.length > 20 && (
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Showing first 20 rows of preview
                </p>
              )}
            </>
          ) : !latestImport ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs font-semibold text-slate-500">
              No Excel file has been imported for this section yet.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-extrabold text-slate-800">{latestImport.fileName}</div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {latestImport.rows.length} rows imported on {new Date(latestImport.importedAt).toLocaleString('en-IN')}
                  </div>
                </div>
                <button
                  onClick={() => clearImport(latestImport.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      {latestImport.headers.map((header, idx) => (
                        <th key={`${header}-${idx}`} className="px-4 py-3 font-bold uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {latestImport.rows.slice(0, 50).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50">
                        {latestImport.headers.map((_, idx) => (
                          <td key={idx} className="px-4 py-3">
                            {row[idx]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {latestImport.rows.length > 50 && (
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Showing first 50 imported rows
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      <button
        onClick={() => inputRef.current?.click()}
        className="flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-all hover:bg-blue-100 active:scale-[0.98] sm:px-3.5"
        title="Import Excel"
        disabled={loading}
      >
        <Upload className="h-4 w-4" />
        <span className="hidden sm:inline">{loading ? 'Importing...' : 'Import Excel'}</span>
      </button>

      {imports.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 lg:flex"
          title="View imported Excel data"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>{imports.length}</span>
        </button>
      )}

      {mounted && typeof document !== 'undefined' && createPortal(
        <>
          {toastContent}
          {modalContent}
        </>,
        document.body
      )}
    </>
  );
}

