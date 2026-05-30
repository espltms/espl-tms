'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectLoadingPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/trips');
  }, [router]);

  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        <p className="text-xs text-slate-500 font-medium">Redirecting to consolidated Trip Dispatch & Loading...</p>
      </div>
    </div>
  );
}
