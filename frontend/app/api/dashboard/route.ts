import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type DashboardPayload = {
  revenueKPI: number;
  expenseKPI: number;
  netMarginKPI: number;
  reconciliationQueueCount: number;
  disputedQueueCount: number;
  activeTripsCount: number;
  fleetUtilization: number;
  totalTrucks: number;
  totalDrivers: number;
  totalTrips: number;
  completedTrips: number;
  revenueHistory: { date: string; tons: number; revenue: number }[];
  poUsage: { name: string; allocated: number; total: number }[];
};

let dashboardCache: { payload: DashboardPayload; expiresAt: number } | null = null;
const DASHBOARD_CACHE_MS = 15_000;

const emptyDashboardPayload: DashboardPayload = {
  revenueKPI: 0,
  expenseKPI: 0,
  netMarginKPI: 0,
  reconciliationQueueCount: 0,
  disputedQueueCount: 0,
  activeTripsCount: 0,
  fleetUtilization: 0,
  totalTrucks: 0,
  totalDrivers: 0,
  totalTrips: 0,
  completedTrips: 0,
  revenueHistory: [],
  poUsage: [],
};

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    const isRegAdmin = user?.role === 'REGION_ADMIN' || user?.role === 'PARAMANANDPUR_ADMIN' || user?.role === 'DHARAMGARH_ADMIN';
    if (isRegAdmin) {
      return NextResponse.json(emptyDashboardPayload, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }

    const now = Date.now();
    if (dashboardCache && dashboardCache.expiresAt > now) {
      return NextResponse.json(dashboardCache.payload, {
        headers: { 'Cache-Control': 'private, max-age=15' },
      });
    }

    const [
      totalTrucks,
      activeTrucks,
      totalDrivers,
      totalTrips,
      activeTrips,
      completedTrips,
      revenueRows,
      ticketStats,
      revenueHistoryRows,
      pos,
    ] = await Promise.all([
      prisma.truck.count(),
      prisma.truck.count({ where: { status: { in: ['ON_TRIP', 'IN_TRANSIT'] as any } } }),
      prisma.driver.count(),
      prisma.trip.count(),
      prisma.trip.count({ where: { status: { in: ['IN_TRANSIT', 'EN_ROUTE'] as any } } }),
      prisma.trip.count({ where: { status: 'COMPLETED' } }),
      prisma.$queryRaw<{ revenue: unknown }[]>`
        SELECT COALESCE(SUM(COALESCE(t."actualDeliveredTons", t."estimatedQuantityTons", 0) * po."ratePerTon"), 0) AS revenue
        FROM "Trip" t
        INNER JOIN "PurchaseOrder" po ON po.id = t."purchaseOrderId"
      `,
      prisma.weighTicket.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.$queryRaw<{ day: Date; tons: unknown; revenue: unknown }[]>`
        SELECT
          DATE(t."scheduledStartDate") AS day,
          COALESCE(SUM(COALESCE(t."actualDeliveredTons", t."estimatedQuantityTons", 0)), 0) AS tons,
          COALESCE(SUM(COALESCE(t."actualDeliveredTons", t."estimatedQuantityTons", 0) * po."ratePerTon"), 0) AS revenue
        FROM "Trip" t
        INNER JOIN "PurchaseOrder" po ON po.id = t."purchaseOrderId"
        GROUP BY DATE(t."scheduledStartDate")
        ORDER BY day DESC
        LIMIT 7
      `,
      prisma.purchaseOrder.findMany({
        select: { poNumber: true, totalQuantityTons: true, allocatedQuantityTons: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    const totalRevenue = Number(revenueRows[0]?.revenue || 0);

    const fleetUtilization = totalTrucks > 0 ? parseFloat(((activeTrucks / totalTrucks) * 100).toFixed(1)) : 0;
    const totalExpenses = totalRevenue * 0.42;
    const netMargin = totalRevenue - totalExpenses;

    const verifiedTickets = ticketStats.find((t) => t.status === 'VERIFIED')?._count?.id || 0;
    const rejectedTickets = ticketStats.find((t) => t.status === 'REJECTED')?._count?.id || 0;

    const revenueHistory = revenueHistoryRows.reverse().map((row) => {
      const d = new Date(row.day);
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tons: Math.round(Number(row.tons || 0)),
        revenue: Math.round(Number(row.revenue || 0)),
      };
    });

    // PO usage
    const poUsage = pos.map((po) => ({
      name: po.poNumber.replace('-01', '').replace('-02', ''),
      allocated: Math.round(Number(po.allocatedQuantityTons)),
      total: Math.round(Number(po.totalQuantityTons)),
    }));

    const payload = {
      revenueKPI: totalRevenue,
      expenseKPI: totalExpenses,
      netMarginKPI: netMargin,
      reconciliationQueueCount: verifiedTickets,
      disputedQueueCount: rejectedTickets,
      activeTripsCount: activeTrips,
      fleetUtilization,
      totalTrucks,
      totalDrivers,
      totalTrips,
      completedTrips,
      revenueHistory,
      poUsage,
    };

    dashboardCache = { payload, expiresAt: now + DASHBOARD_CACHE_MS };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
