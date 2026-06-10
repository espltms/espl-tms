export interface DOMasterRecord {
  id: string;
  doNo: string;
  poNo: string;
  siding: string;
  mines: string;
  coalCompany: string;
  doQty: number;
  coalType: string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Completed' | 'Cancelled';
}

export interface RREntryRecord {
  id: string;
  doNo: string;
  siding: string;
  rrNo: string;
  rrDate: string;
  loadingDate: string;
  receiptDate: string;
  rrActQty: number;
  rrChQty: number;
  vllQty: number;
  grnQty: number;
  normalisedQty: number;
}

export interface QualityTrackingRecord {
  id: string;
  doNo: string;
  rrNo: string;
  tm: number;
  im: number;
  ash: number;
  vm: number;
  fc: number;
  gcvAdb: number;
  gcvArb: number;
  qualityPenalty: number;
}

export interface DeductionPenaltyRecord {
  id: string;
  doNo: string;
  rrNo: string;
  deadFreight: number;
  punitive: number;
  dc: number;
  shortage: number;
  qualitySlippage: number;
  railwayLeakage: number;
  finalDeduction: number;
}

export interface BillingPaymentRecord {
  id: string;
  doNo: string;
  billNo: string;
  billDate: string;
  billQty: number;
  billAmount: number;
  tds: number;
  advancePaid: number;
  finalPayable: number;
  remarks: string;
}
