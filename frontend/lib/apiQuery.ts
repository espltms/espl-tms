import { NextRequest } from 'next/server';

export function getPagination(req: NextRequest, defaultLimit = 50, maxLimit = 100) {
  const rawPage = Number.parseInt(req.nextUrl.searchParams.get('page') || '1', 10);
  const rawLimit = Number.parseInt(req.nextUrl.searchParams.get('limit') || String(defaultLimit), 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function getSearchParam(req: NextRequest, key: string) {
  return (req.nextUrl.searchParams.get(key) || '').trim();
}
