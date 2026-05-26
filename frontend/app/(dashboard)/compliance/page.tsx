'use client';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  AlertTriangle, 
  Check, 
  X,
  FileDown
} from 'lucide-react';
import { getDrivers, getTrucks } from '@/app/data/dataHelper';

interface ComplianceRecord {
  id: string;
  documentType: string;
  documentNumber: string;
  documentUrl: string;
  expiryDate: string;
  status: 'PENDING' | 'APPROVED' | 'EXPIRED' | 'REJECTED';
  rejectionReason?: string;
  driver?: { fullName: string; licenseNumber: string };
  truck?: { plateNumber: string; model: string };
  verifiedBy?: { fullName: string };
}

export default function CompliancePage() {
  const datasetDrivers = getDrivers();
  const datasetTrucks = getTrucks();
  const compliantDrivers = datasetDrivers.filter(driver => driver.verified).length;
  const compliantTrucks = datasetTrucks.filter(truck => truck.status !== 'MAINTENANCE').length;
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    drivers: {
      total: datasetDrivers.length,
      compliant: compliantDrivers,
      nonCompliant: datasetDrivers.length - compliantDrivers,
    },
    trucks: {
      total: datasetTrucks.length,
      compliant: compliantTrucks,
      nonCompliant: datasetTrucks.length - compliantTrucks,
    },
    pendingReviews: 0,
    expiringSoon: 0,
  });

  const [records, setRecords] = useState<ComplianceRecord[]>([]);

  const [reviewingRecord, setReviewingRecord] = useState<ComplianceRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    setLoading(false);
  };

  const handleVerify = async (recordId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('tms_token');

      const response = await fetch(`${apiUrl}/api/compliance/records/${recordId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
        }),
      });

      if (!response.ok) throw new Error('API failed to verify');

      fetchComplianceData();
    } catch (err) {
      // Offline fallback state update
      setRecords(prev =>
        prev.map(rec =>
          rec.id === recordId
            ? {
                ...rec,
                status,
                rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
                verifiedBy: { fullName: 'Local Coordinator' },
              }
            : rec
        )
      );

      // Adjust metrics
      setSummary(prev => {
        const updatedPending = prev.pendingReviews - 1;
        return {
          ...prev,
          pendingReviews: updatedPending >= 0 ? updatedPending : 0,
          drivers: {
            ...prev.drivers,
            compliant: status === 'APPROVED' ? prev.drivers.compliant + 1 : prev.drivers.compliant
          }
        };
      });
    } finally {
      setReviewingRecord(null);
      setRejectionReason('');
    }
  };

  const openReviewModal = (record: ComplianceRecord) => {
    setReviewingRecord(record);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-success/20 bg-brand-success/15 px-2.5 py-0.5 text-[9px] font-bold text-brand-success tracking-wide uppercase">
            <CheckCircle className="h-3 w-3" /> Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-danger/20 bg-brand-danger/15 px-2.5 py-0.5 text-[9px] font-bold text-brand-danger tracking-wide uppercase">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-warning/20 bg-brand-warning/15 px-2.5 py-0.5 text-[9px] font-bold text-brand-warning tracking-wide uppercase">
            <Calendar className="h-3 w-3" /> Pending Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-500/20 bg-gray-500/15 px-2.5 py-0.5 text-[9px] font-bold text-slate-500 tracking-wide uppercase">
            Expired
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Fleet Compliance & Auditing</h2>
        <p className="text-xs text-slate-500 mt-1">Verify truck registrations, driver licenses, and active cargo permits</p>
      </div>

      {/* Compliance Overview Panel */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Drivers Compliance</div>
          <div className="mt-4 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold text-slate-800">{summary.drivers.compliant}</div>
            <div className="text-xs text-slate-400">/ {summary.drivers.total} compliant</div>
          </div>
          {summary.drivers.nonCompliant > 0 ? (
            <div className="mt-2 text-[10px] text-brand-danger font-semibold flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> <span>{summary.drivers.nonCompliant} non-compliant locked</span>
            </div>
          ) : (
            <div className="mt-2 text-[10px] text-brand-success font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> <span>All active drivers clear</span>
            </div>
          )}
        </div>

        {/* Card 2 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Vehicle Fleet Clearance</div>
          <div className="mt-4 flex items-baseline gap-2">
            <div className="text-2xl font-extrabold text-slate-800">{summary.trucks.compliant}</div>
            <div className="text-xs text-slate-400">/ {summary.trucks.total} clearance</div>
          </div>
          {summary.trucks.nonCompliant > 0 ? (
            <div className="mt-2 text-[10px] text-brand-danger font-semibold flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> <span>{summary.trucks.nonCompliant} vehicle in maintenance</span>
            </div>
          ) : (
            <div className="mt-2 text-[10px] text-brand-success font-semibold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> <span>All vehicles certified</span>
            </div>
          )}
        </div>

        {/* Card 3 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Licensing Pending Review</div>
          <div className="mt-4 text-2xl font-extrabold text-brand-warning">{summary.pendingReviews} Records</div>
          <div className="mt-2 text-[10px] text-slate-400">Requires manual audit verification</div>
        </div>

        {/* Card 4 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Documents Expiring Soon</div>
          <div className="mt-4 text-2xl font-extrabold text-brand-secondary">{summary.expiringSoon} Records</div>
          <div className="mt-2 text-[10px] text-brand-secondary font-semibold">Expirations within 30 days</div>
        </div>
      </div>

      {/* Verification Ledger Table */}
      <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden">
        <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Regulatory Document Ledger</h3>
          <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] text-brand-primary font-bold">LATEST RECORDS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Assigned Entity</th>
                <th className="px-6 py-4">Document Details</th>
                <th className="px-6 py-4">Serial Number</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4">Audit Status</th>
                <th className="px-6 py-4">Verified By</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
              {records.map(rec => (
                <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {rec.driver ? (
                      <div>
                        <span>{rec.driver.fullName}</span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">DRIVER</div>
                      </div>
                    ) : rec.truck ? (
                      <div>
                        <span>{rec.truck.plateNumber}</span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{rec.truck.model}</div>
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-primary" />
                      <span className="font-bold tracking-wide">{rec.documentType.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono">{rec.documentNumber || 'N/A'}</td>
                  <td className="px-6 py-4">
                    {new Date(rec.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(rec.status)}
                    {rec.rejectionReason && (
                      <div className="text-[10px] text-brand-danger mt-1 italic max-w-xs">{rec.rejectionReason}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-400">{rec.verifiedBy?.fullName || '—'}</td>
                  <td className="px-6 py-4 text-right">
                    {rec.status === 'PENDING' ? (
                      <button
                        onClick={() => openReviewModal(rec)}
                        className="rounded-lg bg-brand-primary text-white font-extrabold px-3 py-1.5 hover:brightness-110 active:scale-[0.97] transition-all"
                      >
                        Audit Verify
                      </button>
                    ) : (
                      <button 
                        disabled
                        className="text-slate-400 cursor-not-allowed flex items-center justify-end gap-1 w-full"
                      >
                        <ShieldCheck className="h-4 w-4" /> Locked
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    No compliance document records are present in the imported dataset.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Review Modal Overlay */}
      {reviewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-brand-slate shadow-glass shadow-glass-glow animate-scale-up">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Compliance Document Audit</h3>
              <button 
                onClick={() => setReviewingRecord(null)}
                className="rounded-lg hover:bg-slate-100 p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-xl bg-white border border-[#e2e8f0] p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Document Type:</span>
                  <span className="font-bold text-slate-800 text-right">{reviewingRecord.documentType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial No:</span>
                  <span className="font-mono text-slate-800 text-right">{reviewingRecord.documentNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Target Entity:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {reviewingRecord.driver?.fullName || reviewingRecord.truck?.plateNumber}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleVerify(reviewingRecord.id, 'APPROVED')}
                  className="flex-1 rounded-xl bg-brand-success text-white py-3 font-extrabold flex items-center justify-center gap-1.5 hover:brightness-105 transition-all"
                >
                  <Check className="h-4 w-4 stroke-[3]" /> Approve Permit
                </button>
                <button
                  onClick={() => handleVerify(reviewingRecord.id, 'REJECTED')}
                  className="flex-1 rounded-xl border border-brand-danger/30 bg-brand-danger/5 text-brand-danger py-3 font-extrabold flex items-center justify-center gap-1.5 hover:bg-brand-danger/10 transition-all"
                >
                  <X className="h-4 w-4 stroke-[3]" /> Reject Permit
                </button>
              </div>

              <div className="mt-2 text-center">
                <a 
                  href="#"
                  className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                >
                  <FileDown className="h-3.5 w-3.5" /> Download S3 Document Scan
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
