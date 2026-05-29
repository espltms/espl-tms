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
      const firstRow = nonEmptyRows[0] || [];
      const headers = Array.from({ length: maxColumns }, (_, idx) => firstRow[idx] || `Column ${idx + 1}`);
      const rows = nonEmptyRows.slice(1).map(row => headers.map((_, idx) => row[idx] || ''));

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

