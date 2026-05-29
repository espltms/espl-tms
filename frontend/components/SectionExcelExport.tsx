'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSpreadsheet, Filter, RefreshCw, X } from 'lucide-react';

interface ExportTable {
  id: string;
  name: string;
  headers: string[];
  rows: string[][];
}

const normalizeCell = (value: string) => value.replace(/\s+/g, ' ').trim();

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const downloadExcelTable = (filename: string, headers: string[], rows: string[][]) => {
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th { background: #1d4ed8; color: #ffffff; font-weight: 700; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; mso-number-format:"\\@"; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows
              .map(row => `<tr>${headers.map((_, idx) => `<td>${escapeHtml(row[idx] || '')}</td>`).join('')}</tr>`)
              .join('')}
          </tbody>
        </table>
      </body>
    </html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function SectionExcelExport({ sectionName }: { sectionName: string }) {
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<ExportTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<number, string>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const collectTables = () => {
    const extracted = Array.from(document.querySelectorAll('main table')).map((table, index) => {
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => normalizeCell(th.textContent || ''));
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'))
        .map(row => Array.from(row.querySelectorAll('td')).map(td => normalizeCell(td.textContent || '')))
        .filter(row => row.some(Boolean));

      const fallbackHeaders = bodyRows[0]?.map((_, idx) => `Column ${idx + 1}`) || [];
      const finalHeaders = headers.length ? headers : fallbackHeaders;
      const title =
        table.closest('.glass-panel, .bg-white, .rounded-2xl')?.querySelector('h3')?.textContent ||
        table.closest('section')?.querySelector('h2, h3')?.textContent ||
        `Table ${index + 1}`;

      return {
        id: `table-${index}`,
        name: normalizeCell(title),
        headers: finalHeaders,
        rows: bodyRows,
      };
    }).filter(table => table.headers.length && table.rows.length);

    setTables(extracted);
    setSelectedTableId(current => extracted.some(table => table.id === current) ? current : extracted[0]?.id || '');
  };

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setColumnFilters({});
    collectTables();
  }, [open, sectionName]);

  const selectedTable = tables.find(table => table.id === selectedTableId);

  const filteredRows = useMemo(() => {
    if (!selectedTable) return [];
    const globalSearch = search.toLowerCase().trim();
    return selectedTable.rows.filter(row => {
      const matchesSearch = !globalSearch || row.some(cell => cell.toLowerCase().includes(globalSearch));
      const matchesColumns = Object.entries(columnFilters).every(([idx, value]) => {
        const filterValue = value.toLowerCase().trim();
        return !filterValue || (row[Number(idx)] || '').toLowerCase().includes(filterValue);
      });
      return matchesSearch && matchesColumns;
    });
  }, [selectedTable, search, columnFilters]);

  const handleDownload = () => {
    if (!selectedTable) return;
    const safeSection = sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    const safeTable = selectedTable.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'data';
    downloadExcelTable(`${safeSection}-${safeTable}`, selectedTable.headers, filteredRows);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-100 active:scale-[0.98] sm:px-3.5"
        title="Export Excel"
      >
        <FileSpreadsheet className="h-4 w-4" />
        <span className="hidden sm:inline">Export Excel</span>
      </button>

      {mounted && typeof document !== 'undefined' && open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">Export Section Data</h3>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{sectionName}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              {tables.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs font-semibold text-slate-500">
                  No table data is visible in this section right now.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <select
                      value={selectedTableId}
                      onChange={(e) => {
                        setSelectedTableId(e.target.value);
                        setColumnFilters({});
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-primary"
                    >
                      {tables.map(table => (
                        <option key={table.id} value={table.id}>
                          {table.name} ({table.rows.length})
                        </option>
                      ))}
                    </select>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-brand-primary"
                      placeholder="Search all columns..."
                    />
                    <button
                      type="button"
                      onClick={collectTables}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>

                  {selectedTable && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Filter className="h-3.5 w-3.5" />
                        Column Filters
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {selectedTable.headers.map((header, idx) => (
                          <input
                            key={`${header}-${idx}`}
                            value={columnFilters[idx] || ''}
                            onChange={(e) => setColumnFilters({ ...columnFilters, [idx]: e.target.value })}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-brand-primary"
                            placeholder={`Filter ${header}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-slate-500">
                      {filteredRows.length} of {selectedTable?.rows.length || 0} rows will be exported
                    </span>
                    <button
                      onClick={handleDownload}
                      disabled={!selectedTable || filteredRows.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-2.5 font-extrabold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      Download Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
