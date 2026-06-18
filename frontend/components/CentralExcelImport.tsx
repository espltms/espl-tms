'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Upload, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

type ImportedData = {
  fileName: string;
  doMasterRecords: any[];
  rrEntryRecords: any[];
};

const normalize = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const parseDateToYYYYMMDD = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }

  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const utcDate = new Date(Date.UTC(1899, 11, 30) + num * 24 * 60 * 60 * 1000);
    const dd = String(utcDate.getUTCDate()).padStart(2, '0');
    const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = utcDate.getUTCFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  let datePart = str;
  if (str.includes('T')) {
    datePart = str.split('T')[0];
  } else {
    const spaceParts = str.split(/\s+/);
    if (spaceParts.length > 1 && (spaceParts[0].includes('-') || spaceParts[0].includes('/') || spaceParts[0].includes('.'))) {
      datePart = spaceParts[0];
    }
  }

  const clean = datePart.replace(/[/\s.]+/g, '-');
  const parts = clean.split('-');
  const pad = (s: string) => s.padStart(2, '0');

  if (parts.length === 3) {
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];

    if (p0.length === 4) {
      return `${p0}-${pad(p1)}-${pad(p2)}`;
    }

    if (p2.length === 4) {
      const year = p2;
      const val0 = parseInt(p0, 10);
      const val1 = parseInt(p1, 10);

      if (val1 >= 1 && val1 <= 12) {
        return `${year}-${pad(p1)}-${pad(p0)}`;
      }
      if (val0 >= 1 && val0 <= 12) {
        return `${year}-${pad(p0)}-${pad(p1)}`;
      }
      return `${year}-${pad(p1)}-${pad(p0)}`;
    }

    if (p0.length === 2 && p2.length === 2) {
      const val0 = parseInt(p0, 10);
      const val1 = parseInt(p1, 10);
      const val2 = parseInt(p2, 10);

      const yrA = 2000 + val2;
      const yrB = 2000 + val0;
      const isYrBValid = yrB >= 2015 && yrB <= 2040;

      if (isYrBValid) {
        return `${yrB}-${pad(p1)}-${pad(p2)}`;
      } else {
        return `${yrA}-${pad(p1)}-${pad(p0)}`;
      }
    }
  }

  return str;
};

export default function CentralExcelImport({ onImportSuccess }: { onImportSuccess: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportedData | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const confirmImport = async () => {
    if (!pendingImport) return;

    setImporting(true);
    setError('');

    try {
      const token = localStorage.getItem('tms_token');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      // 1. Post DO Master records first
      const doResponse = await fetch('/api/coal-rcr/do-master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify(pendingImport.doMasterRecords)
      });

      if (!doResponse.ok) {
        const errData = await doResponse.json();
        throw new Error(errData.error || 'Failed to upload DO Master records');
      }

      // 2. Post RR Entry records (with nested Quality and Deductions)
      const rrResponse = await fetch('/api/coal-rcr/rr-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify(pendingImport.rrEntryRecords)
      });

      if (!rrResponse.ok) {
        const errData = await rrResponse.json();
        throw new Error(errData.error || 'Failed to upload RR Entry records');
      }

      const doResData = await doResponse.json();
      const rrResData = await rrResponse.json();

      setToast(`Successfully imported ${doResData.count || 0} DO Masters and ${rrResData.count || 0} RR Entries (with Quality/Deductions)!`);
      setPendingImport(null);
      setOpen(false);
      onImportSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server error occurred during import.');
    } finally {
      setImporting(false);
    }
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
      const sheetNames = workbook.SheetNames;

      const summarySheetName = sheetNames.find(s => s.toUpperCase() === 'SUMMARY');
      if (!summarySheetName) {
        throw new Error('This Excel file does not have a "SUMMARY" sheet. Central import requires an RCR Excel file containing a SUMMARY sheet.');
      }

      // 1. Parse DO Master records from SUMMARY sheet
      const summarySheet = workbook.Sheets[summarySheetName];
      const summaryMatrix = XLSX.utils.sheet_to_json<unknown[]>(summarySheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      const nonEmptySummaryRows = summaryMatrix
         .map(row => row.map(normalize))
         .filter(row => row.some(Boolean));

      const normalizeHeader = (value: string) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
      const headerRowIdx = nonEmptySummaryRows.findIndex(row => row.some(val => normalizeHeader(val) === 'dono'));
      if (headerRowIdx === -1) {
        throw new Error('Could not find DO NO header in SUMMARY sheet.');
      }

      const rawHeaders = nonEmptySummaryRows[headerRowIdx];
      const getColIdx = (aliases: string[]) => {
        const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return rawHeaders.findIndex(h => normAliases.includes(String(h).toLowerCase().replace(/[^a-z0-9]/g, '')));
      };

      const doNoIdx = getColIdx(['do no', 'do_no', 'do number']);
      const monthIdx = getColIdx(['month']);
      const ocpIdx = getColIdx(['ocp', 'mines', 'mine']);
      const qtyIdx = getColIdx(['qty', 'do qty', 'quantity', 'do qty']);
      const tolQtyIdx = getColIdx(['tolerance qty', 'tolerance_qty']);

      const doRows = nonEmptySummaryRows.slice(headerRowIdx + 1).filter(row => {
        const firstCol = String(row[0] || '').trim();
        const doNoVal = doNoIdx >= 0 ? String(row[doNoIdx] || '').trim() : '';
        return doNoVal && doNoVal !== '-' && !firstCol.toUpperCase().includes('TOTAL') && !doNoVal.toUpperCase().includes('TOTAL');
      });

      const doMasterRecords: any[] = [];
      const rrEntryRecords: any[] = [];

      doRows.forEach(row => {
        const doNo = doNoIdx >= 0 ? String(row[doNoIdx] || '').trim() : '';
        const month = monthIdx >= 0 ? String(row[monthIdx] || '').trim() : '';
        const mines = ocpIdx >= 0 ? String(row[ocpIdx] || '').trim() : '';
        const doQtyStr = qtyIdx >= 0 ? String(row[qtyIdx] || '').trim() : '';
        const tolQtyStr = tolQtyIdx >= 0 ? String(row[tolQtyIdx] || '').trim() : '';

        const doQty = parseFloat(doQtyStr) || 0;
        const tolQty = parseFloat(tolQtyStr) || 0;
        const tolerance = doQty > 0 ? parseFloat(((tolQty / doQty) * 100).toFixed(2)) : 0;

        // Find siding and RR list from detail sheet for this OCP mine
        let siding = 'MVAA';
        const detailSheetName = sheetNames.find(s => {
          if (s.toUpperCase() === 'SUMMARY') return false;
          const sNorm = s.toUpperCase().replace(/[^A-Z]/g, '');
          const mNorm = mines.toUpperCase().replace(/[^A-Z]/g, '');
          
          if (sNorm.includes(mNorm) || mNorm.includes(sNorm)) return true;
          if (mNorm === 'JAGANNATH' && (sNorm.includes('JNATH') || sNorm.includes('JAG'))) return true;
          if (mNorm === 'BHARATPUR' && (sNorm.includes('BPUR') || sNorm.includes('BHA') || sNorm.includes('BP'))) return true;
          return false;
        });
        if (detailSheetName) {
          const dSheet = workbook.Sheets[detailSheetName];
          const dMatrix = XLSX.utils.sheet_to_json<unknown[]>(dSheet, { header: 1, defval: '' });
          
          // Find RR header row in OCP detail sheet
          const rrHeaderIdx = dMatrix.findIndex(r => Array.isArray(r) && r.some(v => String(v).toLowerCase().replace(/[^a-z0-9]/g, '') === 'rrno'));
          if (rrHeaderIdx !== -1) {
            const rrHeaders = (dMatrix[rrHeaderIdx] as string[]).map(h => String(h || '').trim());
            const getDetailColIdx = (aliases: string[]) => {
              const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
              return rrHeaders.findIndex(h => normAliases.includes(String(h).toLowerCase().replace(/[^a-z0-9]/g, '')));
            };

            const cIdx = {
              rrNo: getDetailColIdx(['rr no', 'rr number', 'rr_no', 'railway receipt']),
              rrDate: getDetailColIdx(['rr date', 'rr_date']),
              invoiceDate: getDetailColIdx(['invoice date', 'invoice_date']),
              receiptDate: getDetailColIdx(['receipt date', 'receipt_date']),
              from: getDetailColIdx(['from']),
              to: getDetailColIdx(['to']),
              ocp: getDetailColIdx(['ocp']),
              doNo: getDetailColIdx(['do no', 'do_no', 'do no.']),
              rrChQty: getDetailColIdx(['rr chargeable weight', 'rr chargeable wt', 'chargeable weight', 'rr_ch_qty']),
              rrActQty: getDetailColIdx(['rr actual qty', 'rr actual quantity', 'actual quantity', 'rr_act_qty']),
              vllQty: getDetailColIdx(['vll inm qty', 'vll qty', 'vll quantity', 'vll in-motion qty']),
              grnQty: getDetailColIdx(['grn qty', 'grn quantity', 'grn_qty']),
              normalisedQty: getDetailColIdx(['normalise qty', 'normalised qty', 'normalized qty']),
              tm: getDetailColIdx(['tm', 'tm%', 'total moisture', 'tm(arb)', 'tm% (arb)', 'tm%(arb)', 'tm arb', 'total moisture (arb)']),
              im: getDetailColIdx(['im', 'im%', 'inherent moisture', 'im(adb)', 'im% (adb)', 'im%(adb)', 'im adb', 'inherent moisture (adb)', 'im % (adb)']),
              vm: getDetailColIdx(['vm', 'vm%', 'volatile matter', 'vm(adb)', 'vm% (adb)', 'vm%(adb)', 'vm adb', 'volatile matter (adb)', 'vm % (adb)']),
              ash: getDetailColIdx(['ash', 'ash%', 'ash content', 'ash(adb)', 'ash% (adb)', 'ash%(adb)', 'ash adb', 'ash content (adb)', 'ash % (adb)']),
              fc: getDetailColIdx(['fc', 'fc%', 'fixed carbon', 'fc(adb)', 'fc% (adb)', 'fc%(adb)', 'fc adb', 'fixed carbon (adb)', 'fc % (adb)']),
              gcvAdb: getDetailColIdx(['gcv adb', 'gcv kcl/kg (adb)']),
              gcvArb: getDetailColIdx(['gcv arb', 'gcv kcl/kg (arb)']),
              pol1: getDetailColIdx(['pol1/a', 'pol1']),
              pol2: getDetailColIdx(['pol2']),
              enhc: getDetailColIdx(['enhc']),
              dcla: getDetailColIdx(['dcla']),
              fauc: getDetailColIdx(['fauc']),
              deadFreight: getDetailColIdx(['dead freight', 'dead freight ']),
              dc: getDetailColIdx(['dc']),
              mrExclGst: getDetailColIdx(['mr excl gst']),
              noOfWagons: getDetailColIdx(['no of wagon', 'no of wagons', 'wagons']),
              udRemark: getDetailColIdx(['u/d', 'ud remark', 'ud remarks', 'remark'])
            };

            // Read RRs for this DO
            for (let rIdx = rrHeaderIdx + 1; rIdx < dMatrix.length; rIdx++) {
              const rrRow = dMatrix[rIdx] as string[];
              if (!rrRow) continue;

              const firstColVal = String(rrRow[0] || '').trim();
              if (firstColVal && (firstColVal.toUpperCase().includes('TOTAL') || firstColVal.toUpperCase().includes('COAL COST'))) {
                break;
              }

              const rrNoVal = cIdx.rrNo >= 0 ? String(rrRow[cIdx.rrNo] || '').trim() : '';
              if (!rrNoVal || rrNoVal === '-') continue;

              const getVal = (idx: number) => idx >= 0 ? String(rrRow[idx] || '').trim() : '';

              const rowDoNo = getVal(cIdx.doNo) || doNo;
              const rowSiding = getVal(cIdx.to) || 'MVAA';
              siding = rowSiding; // update DO siding

              const grnQty = parseFloat(getVal(cIdx.grnQty)) || 0;
              const normalisedQty = parseFloat(getVal(cIdx.normalisedQty) || getVal(cIdx.grnQty)) || 0;

              const pol1Val = parseFloat(getVal(cIdx.pol1)) || 0;
              const pol2Val = parseFloat(getVal(cIdx.pol2)) || 0;
              const enhcVal = parseFloat(getVal(cIdx.enhc)) || 0;
              const dclaVal = parseFloat(getVal(cIdx.dcla)) || 0;
              const faucVal = parseFloat(getVal(cIdx.fauc)) || 0;
              const dfVal = parseFloat(getVal(cIdx.deadFreight)) || 0;
              const dcVal = parseFloat(getVal(cIdx.dc)) || 0;
              const mrVal = parseFloat(getVal(cIdx.mrExclGst)) || 0;

              const finalDeduction = pol1Val + pol2Val + enhcVal + dclaVal + faucVal + dfVal + dcVal + mrVal;

              rrEntryRecords.push({
                doNo: rowDoNo,
                siding: rowSiding,
                rrNo: rrNoVal,
                rrDate: parseDateToYYYYMMDD(getVal(cIdx.rrDate)) || null,
                invoiceDate: parseDateToYYYYMMDD(getVal(cIdx.invoiceDate)) || null,
                receiptDate: parseDateToYYYYMMDD(getVal(cIdx.receiptDate)) || null,
                loadingDate: parseDateToYYYYMMDD(getVal(cIdx.rrDate)) || null,
                from: getVal(cIdx.from) || null,
                to: rowSiding || null,
                ocp: getVal(cIdx.ocp) || mines || null,
                rrActQty: parseFloat(getVal(cIdx.rrActQty)) || 0,
                rrChQty: parseFloat(getVal(cIdx.rrChQty)) || 0,
                vllQty: parseFloat(getVal(cIdx.vllQty)) || 0,
                grnQty,
                normalisedQty,
                noOfWagons: getVal(cIdx.noOfWagons) ? parseInt(getVal(cIdx.noOfWagons)) || null : null,
                udRemark: getVal(cIdx.udRemark) || null,
                quality: {
                  tm: parseFloat(getVal(cIdx.tm)) || 0,
                  im: parseFloat(getVal(cIdx.im)) || 0,
                  ash: parseFloat(getVal(cIdx.ash)) || 0,
                  vm: parseFloat(getVal(cIdx.vm)) || 0,
                  fc: parseFloat(getVal(cIdx.fc)) || 0,
                  gcvAdb: parseFloat(getVal(cIdx.gcvAdb)) || 0,
                  gcvArb: parseFloat(getVal(cIdx.gcvArb)) || 0,
                  qualityPenalty: 0
                },
                deductions: {
                  pol1: pol1Val,
                  pol2: pol2Val,
                  enhc: enhcVal,
                  dcla: dclaVal,
                  fauc: faucVal,
                  deadFreight: dfVal,
                  dc: dcVal,
                  shortage: 0,
                  qualitySlippage: 0,
                  railwayLeakage: 0,
                  mrExclGst: mrVal,
                  finalDeduction: finalDeduction,
                  remarks: getVal(cIdx.udRemark) || null
                }
              });
            }
          }
        }

        doMasterRecords.push({
          doNo,
          poNo: '',
          month,
          siding,
          mines,
          coalCompany: 'MCL',
          doQty,
          coalType: 'ROM',
          tolerance,
          status: 'Open'
        });
      });

      if (doMasterRecords.length === 0) {
        throw new Error('No DO records could be parsed from SUMMARY sheet.');
      }

      setPendingImport({
        fileName: file.name,
        doMasterRecords,
        rrEntryRecords
      });
      setOpen(true);
    } catch (err: any) {
      setError(err.message || 'Unable to parse this central Excel file.');
      setOpen(true);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toastContent = toast && (
    <div className="fixed top-5 right-5 z-[300] flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/95 backdrop-blur-md px-4 py-3 shadow-2xl animate-slide-in max-w-sm">
      <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 animate-bounce" />
      <div className="flex-1">
        <h4 className="text-[11px] font-bold text-emerald-950 uppercase tracking-wider">Central Excel Imported</h4>
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
              Preview Central RCR Excel Import
            </h3>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Restructures & Populates Everything</p>
          </div>
          <button 
            onClick={() => {
              setOpen(false);
              setPendingImport(null);
              setError('');
            }} 
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {pendingImport && (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 font-extrabold text-blue-950">
                    <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                    <span>{pendingImport.fileName}</span>
                  </div>
                  <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                    DO Masters found: {pendingImport.doMasterRecords.length} | RR Entries found: {pendingImport.rrEntryRecords.length}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={confirmImport}
                    disabled={importing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm and Upload
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setPendingImport(null);
                      setOpen(false);
                    }}
                    disabled={importing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    Discard
                  </button>
                </div>
              </div>

              {/* Preview DO Masters */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Parsed DO Masters ({pendingImport.doMasterRecords.length})</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 sticky top-0">
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">DO No</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">OCP Mine</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">Siding</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">DO Qty (MT)</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">Tolerance %</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">Month</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {pendingImport.doMasterRecords.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{d.doNo}</td>
                          <td className="px-4 py-2">{d.mines}</td>
                          <td className="px-4 py-2">{d.siding}</td>
                          <td className="px-4 py-2">{d.doQty.toLocaleString()}</td>
                          <td className="px-4 py-2">{d.tolerance}%</td>
                          <td className="px-4 py-2">{d.month}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Preview RR Entries */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wide">Parsed RR Entries & Penalties ({pendingImport.rrEntryRecords.length})</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-60 overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 sticky top-0">
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">RR No</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">DO No</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">OCP Mine</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">Act Qty (MT)</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">GRN Qty (MT)</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">TM % (ARB)</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">GCV (ARB)</th>
                        <th className="px-4 py-2 font-bold uppercase tracking-wider">Deductions (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {pendingImport.rrEntryRecords.slice(0, 15).map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-semibold text-slate-900">{r.rrNo}</td>
                          <td className="px-4 py-2">{r.doNo}</td>
                          <td className="px-4 py-2">{r.ocp}</td>
                          <td className="px-4 py-2">{r.rrActQty.toLocaleString()}</td>
                          <td className="px-4 py-2">{r.grnQty.toLocaleString()}</td>
                          <td className="px-4 py-2">{r.quality?.tm}%</td>
                          <td className="px-4 py-2">{r.quality?.gcvArb}</td>
                          <td className="px-4 py-2 text-red-600 font-medium">₹{r.deductions?.finalDeduction.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {pendingImport.rrEntryRecords.length > 15 && (
                    <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400 py-2 bg-slate-50 border-t border-slate-100">
                      Showing first 15 rows of preview
                    </p>
                  )}
                </div>
              </div>
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
        className="flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all"
        title="Import Excel"
        disabled={loading}
      >
        <Upload className="h-4 w-4" />
        <span>{loading ? 'Reading File...' : 'Central Excel Import'}</span>
      </button>

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
