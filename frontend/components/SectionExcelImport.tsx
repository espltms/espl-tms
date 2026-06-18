'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, Upload, X, CheckCircle2 } from 'lucide-react';

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
  ],
  'DO Master': [
    'do no', 'do number', 'do_no', 'do_number', 'delivery order no', 'delivery order number',
    'po no', 'po number', 'po_no', 'po_number', 'purchase order no', 'purchase order number',
    'siding', 'siding name',
    'mines', 'mine name', 'mine',
    'coal company', 'coal_company', 'company',
    'do qty', 'do quantity', 'quantity', 'qty', 'do_qty',
    'coal type', 'coal_type',
    'start date', 'start_date', 'validity start',
    'end date', 'end_date', 'validity end',
    'status'
  ],
  'RR Entry': [
    'do no', 'do number', 'do_no',
    'siding', 'siding name',
    'rr no', 'rr number', 'rr_no', 'railway receipt',
    'rr date', 'rr_date',
    'loading date', 'loading_date',
    'receipt date', 'receipt_date',
    'rr act qty', 'rr actual quantity', 'actual quantity', 'rr_act_qty',
    'rr ch qty', 'rr challan qty', 'challan qty', 'rr_ch_qty',
    'vll qty', 'vll quantity', 'vll', 'vll_qty',
    'grn qty', 'grn quantity', 'grn', 'grn_qty',
    'normalised qty', 'normalized qty', 'normalised_qty'
  ],
  'Quality Tracking': [
    'do no', 'do number', 'do_no',
    'rr no', 'rr number', 'rr_no',
    'tm', 'total moisture', 'tm %',
    'im', 'inherent moisture', 'im %',
    'ash', 'ash %',
    'vm', 'volatile matter', 'vm %',
    'fc', 'fixed carbon', 'fc %',
    'gcv adb', 'gcv_adb', 'gcv adb Basis',
    'gcv arb', 'gcv_arb',
    'quality penalty', 'penalty', 'quality_penalty'
  ],
  'Deduction & Penalty': [
    'do no', 'do number', 'do_no',
    'rr no', 'rr number', 'rr_no',
    'dead freight', 'dead_freight',
    'punitive', 'punitive charges',
    'dc', 'demurrage', 'demurrage charges',
    'shortage', 'shortage deduction', 'weight shortage',
    'quality slippage', 'quality_slippage',
    'railway leakage', 'railway_leakage',
    'final deduction', 'final_deduction', 'total deduction'
  ],
  'Billing & Payment': [
    'do no', 'do number', 'do_no',
    'bill no', 'bill number', 'bill_no', 'invoice number', 'invoice no',
    'bill date', 'bill_date', 'invoice date',
    'bill qty', 'bill quantity', 'billed qty',
    'bill amount', 'bill_amount', 'invoice amount',
    'tds', 'tds deduction',
    'advance paid', 'advance_paid', 'advance',
    'final payable', 'final_payable', 'net payable',
    'remarks', 'comment', 'comments'
  ]
};

export default function SectionExcelImport({ sectionName }: { sectionName: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<ImportedSheet | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tms_imported_excel_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const confirmImport = () => {
    if (!pendingImport) return;

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

      const normalizeHeader = (value: string) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
      const row0 = nonEmptyRows[0] || [];
      const isUnified = row0.some(val => normalizeHeader(val) === 'vendorcode');

      const sheetNames = workbook.SheetNames;
      const isRCRSample = sheetNames.includes('SUMMARY') || sheetNames.some(s => s.toUpperCase().includes('KT'));

      let headers: string[] = [];
      let rows: string[][] = [];

      if (isRCRSample) {
        if (sectionName === 'DO Master') {
          const summarySheetName = sheetNames.find(s => s.toUpperCase() === 'SUMMARY') || sheetNames[0];
          const summarySheet = workbook.Sheets[summarySheetName];
          const matrix = XLSX.utils.sheet_to_json<unknown[]>(summarySheet, {
            header: 1,
            defval: '',
            blankrows: false,
          });
          const nonEmptyRows = matrix
             .map(row => row.map(normalize))
             .filter(row => row.some(Boolean));

          const headerRowIdx = nonEmptyRows.findIndex(row => row.some(val => normalizeHeader(val) === 'dono'));
          if (headerRowIdx === -1) {
            throw new Error('Could not find DO NO header in SUMMARY sheet.');
          }
          const rawHeaders = nonEmptyRows[headerRowIdx];
          const getColIdx = (aliases: string[]) => {
            const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
            return rawHeaders.findIndex(h => normAliases.includes(String(h).toLowerCase().replace(/[^a-z0-9]/g, '')));
          };

          const doNoIdx = getColIdx(['do no', 'do_no', 'do number']);
          const monthIdx = getColIdx(['month']);
          const ocpIdx = getColIdx(['ocp', 'mines', 'mine']);
          const qtyIdx = getColIdx(['qty', 'do qty', 'quantity', 'do qty']);
          const tolQtyIdx = getColIdx(['tolerance qty', 'tolerance_qty']);

          const dataRows = nonEmptyRows.slice(headerRowIdx + 1).filter(row => {
            const firstCol = String(row[0] || '').trim();
            const doNoVal = doNoIdx >= 0 ? String(row[doNoIdx] || '').trim() : '';
            return doNoVal && doNoVal !== '-' && !firstCol.toUpperCase().includes('TOTAL') && !doNoVal.toUpperCase().includes('TOTAL');
          });

          headers = ['do no', 'po no', 'siding', 'mines', 'coal company', 'do qty', 'coal type', 'month', 'tolerance', 'status'];
          rows = dataRows.map(row => {
            const doNo = doNoIdx >= 0 ? String(row[doNoIdx] || '').trim() : '';
            const month = monthIdx >= 0 ? String(row[monthIdx] || '').trim() : '';
            const mines = ocpIdx >= 0 ? String(row[ocpIdx] || '').trim() : '';
            const doQtyStr = qtyIdx >= 0 ? String(row[qtyIdx] || '').trim() : '';
            const tolQtyStr = tolQtyIdx >= 0 ? String(row[tolQtyIdx] || '').trim() : '';

            const doQty = parseFloat(doQtyStr) || 0;
            const tolQty = parseFloat(tolQtyStr) || 0;
            const tolerance = doQty > 0 ? ((tolQty / doQty) * 100).toFixed(2) : '0';

            // Find siding from detail sheet
            let siding = 'MVAA';
            const detailSheetName = sheetNames.find(s => s.toUpperCase().startsWith(mines.toUpperCase().substring(0, 4)));
            if (detailSheetName) {
              const dSheet = workbook.Sheets[detailSheetName];
              const dMatrix = XLSX.utils.sheet_to_json<unknown[]>(dSheet, { header: 1, defval: '' });
              const rrHeaderIdx = dMatrix.findIndex(r => Array.isArray(r) && r.some(v => String(v).toLowerCase().replace(/[^a-z0-9]/g, '') === 'rrno'));
              if (rrHeaderIdx !== -1 && dMatrix[rrHeaderIdx + 1]) {
                const nextRow = dMatrix[rrHeaderIdx + 1] as string[];
                if (nextRow && nextRow[6]) siding = String(nextRow[6]).trim(); // "To" column is index 6
              }
            }

            return [doNo, '', siding, mines, 'MCL', String(doQty), 'ROM', month, tolerance, 'Open'];
          });
        }
        else if (sectionName === 'RR Entry' || sectionName === 'Quality Tracking' || sectionName === 'Deduction & Penalty') {
          const allRRs: any[] = [];
          
          sheetNames.forEach(sheetName => {
            if (sheetName.toUpperCase() === 'SUMMARY') return;
            const sheet = workbook.Sheets[sheetName];
            const dMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
            const rrHeaderIdx = dMatrix.findIndex(r => Array.isArray(r) && r.some(v => String(v).toLowerCase().replace(/[^a-z0-9]/g, '') === 'rrno'));
            if (rrHeaderIdx === -1) return;

            const rrHeaders = (dMatrix[rrHeaderIdx] as string[]).map(h => String(h || '').trim());
            const getColIdx = (aliases: string[]) => {
              const normAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
              return rrHeaders.findIndex(h => normAliases.includes(String(h).toLowerCase().replace(/[^a-z0-9]/g, '')));
            };

            const cIdx = {
              rrNo: getColIdx(['rr no', 'rr number', 'rr_no', 'railway receipt']),
              rrDate: getColIdx(['rr date', 'rr_date']),
              invoiceDate: getColIdx(['invoice date', 'invoice_date']),
              receiptDate: getColIdx(['receipt date', 'receipt_date']),
              from: getColIdx(['from']),
              to: getColIdx(['to']),
              ocp: getColIdx(['ocp']),
              doNo: getColIdx(['do no', 'do_no', 'do no.']),
              rrChQty: getColIdx(['rr chargeable weight', 'rr chargeable wt', 'chargeable weight', 'rr_ch_qty']),
              rrActQty: getColIdx(['rr actual qty', 'rr actual quantity', 'actual quantity', 'rr_act_qty']),
              vllQty: getColIdx(['vll inm qty', 'vll qty', 'vll quantity']),
              grnQty: getColIdx(['grn qty', 'grn quantity', 'grn_qty']),
              normalisedQty: getColIdx(['normalise qty', 'normalised qty', 'normalized qty']),
              tm: getColIdx(['tm', 'tm%', 'total moisture']),
              im: getColIdx(['im', 'im%', 'inherent moisture']),
              vm: getColIdx(['vm', 'vm%', 'volatile matter']),
              ash: getColIdx(['ash', 'ash%', 'ash content']),
              fc: getColIdx(['fc', 'fc%', 'fixed carbon']),
              gcvAdb: getColIdx(['gcv adb', 'gcv kcl/kg (adb)']),
              gcvArb: getColIdx(['gcv arb', 'gcv kcl/kg (arb)']),
              pol1: getColIdx(['pol1/a', 'pol1']),
              pol2: getColIdx(['pol2']),
              enhc: getColIdx(['enhc']),
              dcla: getColIdx(['dcla']),
              fauc: getColIdx(['fauc']),
              deadFreight: getColIdx(['dead freight', 'dead freight ']),
              dc: getColIdx(['dc']),
              mrExclGst: getColIdx(['mr excl gst']),
              noOfWagons: getColIdx(['no of wagon', 'no of wagons', 'wagons']),
              udRemark: getColIdx(['u/d', 'ud remark', 'ud remarks', 'remark'])
            };

            for (let rIdx = rrHeaderIdx + 1; rIdx < dMatrix.length; rIdx++) {
              const row = dMatrix[rIdx] as string[];
              if (!row) continue;

              const firstCol = String(row[0] || '').trim();
              if (firstCol && (firstCol.toUpperCase().includes('TOTAL') || firstCol.toUpperCase().includes('COAL COST'))) {
                break;
              }

              const rrNoVal = cIdx.rrNo >= 0 ? String(row[cIdx.rrNo] || '').trim() : '';
              if (!rrNoVal || rrNoVal === '-') continue;

              const getVal = (idx: number) => idx >= 0 ? String(row[idx] || '').trim() : '';

              const doNoVal = getVal(cIdx.doNo);
              const sidingVal = getVal(cIdx.to) || 'MVAA';

              allRRs.push([
                doNoVal,
                sidingVal,
                rrNoVal,
                getVal(cIdx.rrDate),
                getVal(cIdx.rrDate), // loading date
                getVal(cIdx.receiptDate),
                getVal(cIdx.from),
                getVal(cIdx.to),
                getVal(cIdx.ocp),
                getVal(cIdx.rrActQty),
                getVal(cIdx.rrChQty),
                getVal(cIdx.vllQty),
                getVal(cIdx.grnQty),
                getVal(cIdx.normalisedQty),
                getVal(cIdx.noOfWagons),
                getVal(cIdx.udRemark),

                // Quality
                getVal(cIdx.tm),
                getVal(cIdx.im),
                getVal(cIdx.ash),
                getVal(cIdx.vm),
                getVal(cIdx.fc),
                getVal(cIdx.gcvAdb),
                getVal(cIdx.gcvArb),
                '0',

                // Deductions
                getVal(cIdx.pol1),
                getVal(cIdx.pol2),
                getVal(cIdx.enhc),
                getVal(cIdx.dcla),
                getVal(cIdx.fauc),
                getVal(cIdx.deadFreight),
                getVal(cIdx.dc),
                '0',
                '0',
                '0',
                getVal(cIdx.mrExclGst),
                '0',
                ''
              ]);
            }
          });

          if (sectionName === 'RR Entry') {
            headers = [
              'do no', 'siding', 'rr no', 'rr date', 'loading date', 'receipt date', 
              'from', 'to', 'ocp', 'rr act qty', 'rr ch qty', 'vll qty', 'grn qty', 'normalised qty', 
              'no of wagons', 'ud remark',
              'tm', 'im', 'ash', 'vm', 'fc', 'gcv adb', 'gcv arb', 'quality penalty',
              'pol1', 'pol2', 'enhc', 'dcla', 'fauc', 'dead freight', 'dc', 'shortage', 'quality slippage', 'railway leakage', 'mr excl gst', 'final deduction', 'remarks'
            ];
            rows = allRRs;
          }
          else if (sectionName === 'Quality Tracking') {
            headers = ['do no', 'rr no', 'tm', 'im', 'ash', 'vm', 'fc', 'gcv adb', 'gcv arb', 'quality penalty'];
            rows = allRRs.map(r => [r[0], r[2], r[16], r[17], r[18], r[19], r[20], r[21], r[22], r[23]]);
          }
          else if (sectionName === 'Deduction & Penalty') {
            headers = ['do no', 'rr no', 'dead freight', 'punitive', 'dc', 'shortage', 'quality slippage', 'railway leakage', 'final deduction'];
            rows = allRRs.map(r => {
              const dfVal = parseFloat(r[29]) || 0; 
              const dcVal = parseFloat(r[30]) || 0; 
              const finalDeductionVal = dfVal + dcVal;
              return [r[0], r[2], r[29], '0', r[30], '0', '0', '0', String(finalDeductionVal)];
            });
          }
        }
      } else if (isUnified) {
        const getLeftMetadata = (label: string): string => {
          const normLabel = normalizeHeader(label);
          for (const row of nonEmptyRows) {
            if (row[0] && normalizeHeader(row[0]) === normLabel) {
              return String(row[2] || '').trim();
            }
          }
          return '';
        };

        const doNo = getLeftMetadata('dono') || getLeftMetadata('dono.');
        const poNo = getLeftMetadata('po') || getLeftMetadata('pono') || getLeftMetadata('ponumber');
        const siding = getLeftMetadata('siding');
        const mines = getLeftMetadata('mines') || getLeftMetadata('mine');
        const coalCompany = getLeftMetadata('coalcompany');
        const doQty = getLeftMetadata('doqty') || getLeftMetadata('doqty.');
        const coalType = getLeftMetadata('coaltype');

        if (sectionName === 'DO Master') {
          headers = ['do no', 'po no', 'siding', 'mines', 'coal company', 'do qty', 'coal type', 'status'];
          rows = [[doNo, poNo, siding, mines, coalCompany, doQty, coalType, 'Active']];
        } 
        else if (sectionName === 'RR Entry' || sectionName === 'Quality Tracking' || sectionName === 'Deduction & Penalty') {
          const rrHeaderIdx = nonEmptyRows.findIndex(row => row[5] && normalizeHeader(row[5]) === 'rrno');
          
          if (rrHeaderIdx === -1) {
            throw new Error('Could not find RR table in the reconciliation sheet.');
          }

          const rrHeaders = nonEmptyRows[rrHeaderIdx].slice(5).map(h => String(h || '').trim());
          const dataRows: string[][] = [];

          for (let rIdx = rrHeaderIdx + 1; rIdx < nonEmptyRows.length; rIdx++) {
            const row = nonEmptyRows[rIdx];
            const firstCol = String(row[0] || '').trim();
            if (firstCol && (normalizeHeader(firstCol) === 'coalcost' || normalizeHeader(firstCol) === 'total' || normalizeHeader(firstCol) === 'po')) {
              break;
            }
            const rrNo = String(row[5] || '').trim();
            if (rrNo) {
              const vals = row.slice(5).map(v => String(v || '').trim());
              while (vals.length < rrHeaders.length) {
                vals.push('');
              }
              dataRows.push(vals);
            }
          }

          const getRRCellValue = (rowVals: string[], aliasList: string[]) => {
            const normAliases = aliasList.map(normalizeHeader);
            const idx = rrHeaders.findIndex(h => normAliases.includes(normalizeHeader(h)));
            return idx >= 0 ? rowVals[idx] : '';
          };

          if (sectionName === 'RR Entry') {
            headers = ['do no', 'siding', 'rr no', 'rr date', 'loading date', 'receipt date', 'rr act qty', 'rr ch qty', 'vll qty', 'grn qty', 'normalised qty'];
            rows = dataRows.map(rowVals => {
              const rrNo = getRRCellValue(rowVals, ['rr no', 'rr number', 'rr_no']);
              const rrDate = getRRCellValue(rowVals, ['rr date', 'rr_date']);
              const loadingDate = getRRCellValue(rowVals, ['date of loading', 'loading date', 'loading_date']);
              const receiptDate = getRRCellValue(rowVals, ['date of receipt', 'receipt date', 'receipt_date']);
              const rrActQty = getRRCellValue(rowVals, ['rr act qty', 'actual quantity']);
              const rrChQty = getRRCellValue(rowVals, ['rr ch qty', 'challan qty']);
              const vllQty = getRRCellValue(rowVals, ['vll qty', 'vll quantity']);
              const grnQty = getRRCellValue(rowVals, ['grn qty', 'grn quantity']);
              const normalisedQty = getRRCellValue(rowVals, ['normalised qty', 'normalized qty']);

              return [doNo, siding, rrNo, rrDate, loadingDate, receiptDate, rrActQty, rrChQty, vllQty, grnQty, normalisedQty];
            });
          } 
          else if (sectionName === 'Quality Tracking') {
            headers = ['do no', 'rr no', 'tm', 'im', 'ash', 'vm', 'fc', 'gcv adb', 'gcv arb', 'quality penalty'];
            rows = dataRows.map(rowVals => {
              const rrNo = getRRCellValue(rowVals, ['rr no', 'rr number', 'rr_no']);
              const tm = getRRCellValue(rowVals, ['tm']);
              const im = getRRCellValue(rowVals, ['im']);
              const ash = getRRCellValue(rowVals, ['ash']);
              const vm = getRRCellValue(rowVals, ['vm adb', 'vm', 'volatile matter']);
              const fc = getRRCellValue(rowVals, ['fc %', 'fc', 'fixed carbon']);
              const gcvAdb = getRRCellValue(rowVals, ['gcvadb', 'gcv adb']);
              const gcvArb = getRRCellValue(rowVals, ['gcvarb', 'gcv arb']);

              return [doNo, rrNo, tm, im, ash, vm, fc, gcvAdb, gcvArb, '0'];
            });
          } 
          else if (sectionName === 'Deduction & Penalty') {
            headers = ['do no', 'rr no', 'dead freight', 'punitive', 'dc', 'shortage', 'quality slippage', 'railway leakage', 'final deduction'];
            rows = dataRows.map(rowVals => {
              const rrNo = getRRCellValue(rowVals, ['rr no', 'rr number', 'rr_no']);
              const deadFreight = getRRCellValue(rowVals, ['dead freight']);
              const punitive = getRRCellValue(rowVals, ['punitive']);
              const dc = getRRCellValue(rowVals, ['dc']);
              const dfNum = parseFloat(deadFreight) || 0;
              const punNum = parseFloat(punitive) || 0;
              const dcNum = parseFloat(dc) || 0;
              const finalDeduction = dfNum + punNum + dcNum;

              return [doNo, rrNo, deadFreight, punitive, dc, '0', '0', '0', String(finalDeduction)];
            });
          }
        } 
        else if (sectionName === 'Billing & Payment') {
          const billHeaderIdx = nonEmptyRows.findIndex(row => row[0] && normalizeHeader(row[0]) === 'slno');

          if (billHeaderIdx === -1) {
            throw new Error('Could not find Billing table in the reconciliation sheet.');
          }

          headers = ['do no', 'bill no', 'bill date', 'bill qty', 'bill amount', 'tds', 'advance paid', 'final payable', 'remarks'];
          rows = [];

          for (let rIdx = billHeaderIdx + 1; rIdx < nonEmptyRows.length; rIdx++) {
            const row = nonEmptyRows[rIdx];
            const firstCol = String(row[0] || '').trim();
            if (firstCol && normalizeHeader(firstCol) === 'total') {
              break;
            }
            const slNo = firstCol;
            const billNo = String(row[1] || '').trim();
            if (slNo && billNo) {
              const billDate = String(row[2] || '').trim();
              const billQty = String(row[3] || '').trim();
              const billAmount = String(row[4] || '').trim();
              const tds = String(row[5] || '').trim();
              const advancePaid = String(row[6] || '').trim();
              const finalPayable = String(row[9] || '').trim();

              rows.push([doNo, billNo, billDate, billQty, billAmount, tds, advancePaid, finalPayable, '']);
            }
          }
        } else {
          throw new Error('Unsupported section for unified reconciliation sheet import.');
        }
      } else {
        const maxColumns = Math.max(...nonEmptyRows.map(row => row.length));
        const row1 = nonEmptyRows[1] || [];
        
        const isSubHeaderRow = row1.some(val => {
          const v = String(val).toLowerCase();
          return v === 'from' || v === 'to' || v.includes('validity') || v.includes('upto') || v === 'till';
        });

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
        const expectedAliases = SECTION_COLUMN_ALIASES[sectionName] || [];
        if (expectedAliases.length > 0) {
          const normalizedExpected = expectedAliases.map(normalizeHeader);
          const normalizedExcelHeaders = headers.map(normalizeHeader);
          const hasAnyMatch = normalizedExcelHeaders.some(h => normalizedExpected.includes(h));
          if (!hasAnyMatch) {
            throw new Error('The file structure or data is incorrect for this section.');
          }
        }

        rows = nonEmptyRows.slice(startRowIndex).map(row => headers.map((_, idx) => row[idx] || ''));
      }

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
              Preview Excel Import
            </h3>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{sectionName}</p>
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
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          {pendingImport && (
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
                    onClick={() => {
                      setPendingImport(null);
                      setOpen(false);
                    }}
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

