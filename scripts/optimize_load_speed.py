import os

files = {
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\do-master\page.tsx": {
        "cache_load": """  useEffect(() => {
    const local = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = local && local.length > 0;
    if (hasCache) {
      setRecords(local);
    }
    fetchData(!hasCache);
  }, []);"""
    },
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\rr-entry\page.tsx": {
        "cache_load": """  useEffect(() => {
    const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = localRRs && localRRs.length > 0;
    if (hasCache) {
      setRecords(localRRs);
    }
    if (localDOs && localDOs.length > 0) {
      setDoRecords(localDOs);
    }
    fetchData(!hasCache);
  }, []);"""
    },
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\quality-tracking\page.tsx": {
        "cache_load": """  useEffect(() => {
    const localQualities = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
    const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = localQualities && localQualities.length > 0;
    if (hasCache) {
      setRecords(localQualities);
    }
    if (localRRs && localRRs.length > 0) {
      setRrRecords(localRRs);
    }
    if (localDOs && localDOs.length > 0) {
      setDoRecords(localDOs);
    }
    fetchData(!hasCache);
  }, []);"""
    },
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\deduction-penalty\page.tsx": {
        "cache_load": """  useEffect(() => {
    const localDeductions = readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
    const localQualities = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
    const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = localDeductions && localDeductions.length > 0;
    if (hasCache) {
      setRecords(localDeductions);
    }
    if (localQualities && localQualities.length > 0) {
      setQualityRecords(localQualities);
    }
    if (localRRs && localRRs.length > 0) {
      setRrRecords(localRRs);
    }
    if (localDOs && localDOs.length > 0) {
      setDoRecords(localDOs);
    }
    fetchData(!hasCache);
  }, []);"""
    },
    r"c:\Users\prave\Desktop\tms\frontend\app\(dashboard)\coal-rcr\billing-payment\page.tsx": {
        "cache_load": """  useEffect(() => {
    const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
    const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = localBillings && localBillings.length > 0;
    if (hasCache) {
      setRecords(localBillings);
    }
    if (localDOs && localDOs.length > 0) {
      setDoRecords(localDOs);
    }
    fetchData(!hasCache);
  }, []);"""
    }
}

for filepath, patches in files.items():
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} - file does not exist")
        continue
        
    print(f"Processing {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Update fetchData signature
    old_fetch_sig = "  const fetchData = async () => {\n    setLoading(true);"
    new_fetch_sig = "  const fetchData = async (showLoadingSpinner = true) => {\n    if (showLoadingSpinner) {\n      setLoading(true);\n    }"
    content = content.replace(old_fetch_sig, new_fetch_sig)

    # 2. Update mount useEffect
    old_use_effect = "  useEffect(() => {\n    fetchData();\n  }, []);"
    content = content.replace(old_use_effect, patches["cache_load"])

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

print("Optimization patches applied successfully!")
