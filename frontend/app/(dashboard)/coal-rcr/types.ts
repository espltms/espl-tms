export interface DOMasterRecord {
  id: string;
  doNo: string;
  poNo?: string | null;
  month?: string | null;
  auctionDate?: string | null;
  siding?: string | null;
  mines: string;
  coalCompany?: string | null;
  doQty: number;
  coalType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  permitNo?: string | null;
  permitValidDate?: string | null;
  tolerance?: number;
  status: 'Open' | 'Completed' | 'Expired' | 'Active' | 'Cancelled';
  customer?: string | null;
  mode: 'RCR' | 'Road';
}

export interface RREntryRecord {
  id: string;
  doNo: string;
  siding: string;
  rrNo: string;
  rrDate?: string | null;
  invoiceDate?: string | null;
  receiptDate?: string | null;
  loadingDate?: string | null;
  from?: string | null;
  to?: string | null;
  ocp?: string | null;
  rrActQty: number;
  rrChQty: number;
  vllQty: number;
  grnQty: number;
  normalisedQty: number;
  noOfWagons?: number | null;
  udRemark?: string | null;
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
  pol1?: number;
  pol2?: number;
  enhc?: number;
  dcla?: number;
  fauc?: number;
  deadFreight: number;
  punitive: number;
  dc: number;
  shortage: number;
  qualitySlippage: number;
  railwayLeakage: number;
  mrExclGst?: number;
  finalDeduction: number;
  remarks?: string | null;
}

export interface BillingPaymentRecord {
  id: string;
  doNo: string;
  billNo: string;
  billDate: string;
  billQty: number;
  billAmount: number;
  linkedRRs?: string[]; // for reference
  tds: number;
  advancePaid: number;
  finalPayable: number;
  remarks: string;
}

export interface DOLiftingRecord {
  id: string;
  doNo: string;
  ocp?: string | null;
  customer?: string | null;
  passNo: string;
  passDate?: string | null;
  truckNo: string;
  mineralQty: number;
}

