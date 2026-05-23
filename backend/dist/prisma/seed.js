"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding TMS database with Indian Logistics parameters (₹ / INR)...');
    await prisma.auditLog.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.gPSPing.deleteMany({});
    await prisma.gatepass.deleteMany({});
    await prisma.trip.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.vendor.deleteMany({});
    await prisma.complianceRecord.deleteMany({});
    await prisma.truck.deleteMany({});
    await prisma.driver.deleteMany({});
    await prisma.user.deleteMany({});
    const defaultPassword = 'TMSAdminPassword2026!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const admin = await prisma.user.create({
        data: {
            email: 'admin@logistics.com',
            fullName: 'Vikram Sharma',
            passwordHash,
            role: client_1.UserRole.SYS_ADMIN,
            phone: '+919876543210',
        },
    });
    const dispatcher = await prisma.user.create({
        data: {
            email: 'dispatcher@logistics.com',
            fullName: 'Rajesh Kumar',
            passwordHash,
            role: client_1.UserRole.DISPATCHER,
            phone: '+919876543211',
        },
    });
    const complianceOfficer = await prisma.user.create({
        data: {
            email: 'compliance@logistics.com',
            fullName: 'Arjun Mehta',
            passwordHash,
            role: client_1.UserRole.COMPLIANCE_OFFICER,
            phone: '+919876543212',
        },
    });
    const financeOfficer = await prisma.user.create({
        data: {
            email: 'finance@logistics.com',
            fullName: 'Priya Iyer',
            passwordHash,
            role: client_1.UserRole.FINANCE_OFFICER,
            phone: '+919876543213',
        },
    });
    const gateOperator = await prisma.user.create({
        data: {
            email: 'gate@logistics.com',
            fullName: 'Sanjay Singh',
            passwordHash,
            role: client_1.UserRole.GATE_OPERATOR,
            phone: '+919876543214',
        },
    });
    console.log('Seeded Users.');
    const driver1 = await prisma.driver.create({
        data: {
            fullName: 'Ramesh Yadav',
            licenseNumber: 'IND-DL-5819028',
            licenseExpiry: new Date('2028-12-15'),
            status: client_1.DriverStatus.AVAILABLE,
            phone: '+919111222333',
            complianceVerified: true,
        },
    });
    const driver2 = await prisma.driver.create({
        data: {
            fullName: 'Gurpreet Singh',
            licenseNumber: 'IND-DL-2918374',
            licenseExpiry: new Date('2027-06-20'),
            status: client_1.DriverStatus.ON_TRIP,
            phone: '+919222333444',
            complianceVerified: true,
        },
    });
    const driver3 = await prisma.driver.create({
        data: {
            fullName: 'Anil Deshmukh',
            licenseNumber: 'IND-DL-1092837',
            licenseExpiry: new Date('2025-05-10'),
            status: client_1.DriverStatus.SUSPENDED,
            phone: '+919333444555',
            complianceVerified: false,
        },
    });
    const driver4 = await prisma.driver.create({
        data: {
            fullName: 'Karthik Raja',
            licenseNumber: 'IND-DL-7728391',
            licenseExpiry: new Date('2029-01-30'),
            status: client_1.DriverStatus.AVAILABLE,
            phone: '+919444555666',
            complianceVerified: true,
        },
    });
    console.log('Seeded Drivers.');
    const truck1 = await prisma.truck.create({
        data: {
            plateNumber: 'MH-12-QG-4810',
            model: 'Tata Prima 4028.S Multi-Axle',
            capacityTons: 40.00,
            type: 'Tipper',
            status: client_1.TruckStatus.AVAILABLE,
            gpsDeviceId: 'AIS140-TATA-4810',
            complianceVerified: true,
        },
    });
    const truck2 = await prisma.truck.create({
        data: {
            plateNumber: 'GJ-12-AT-2918',
            model: 'Ashok Leyland U-4019',
            capacityTons: 35.00,
            type: 'Tanker',
            status: client_1.TruckStatus.ON_TRIP,
            gpsDeviceId: 'AIS140-AL-2918',
            complianceVerified: true,
        },
    });
    const truck3 = await prisma.truck.create({
        data: {
            plateNumber: 'HR-55-CK-1928',
            model: 'BharatBenz 4023T',
            capacityTons: 45.00,
            type: 'Flatbed',
            status: client_1.TruckStatus.MAINTENANCE,
            gpsDeviceId: 'AIS140-BB-1928',
            complianceVerified: false,
        },
    });
    console.log('Seeded Trucks.');
    await prisma.complianceRecord.create({
        data: {
            documentType: client_1.DocumentType.DRIVING_LICENSE,
            documentNumber: 'IND-DL-5819028',
            documentUrl: 'https://tms-bucket.s3.amazonaws.com/compliance/dl-ramesh.pdf',
            expiryDate: new Date('2028-12-15'),
            status: client_1.ComplianceStatus.APPROVED,
            driverId: driver1.id,
            verifiedById: complianceOfficer.id,
        },
    });
    await prisma.complianceRecord.create({
        data: {
            documentType: client_1.DocumentType.VEHICLE_REGISTRATION,
            documentNumber: 'REG-MH-12-QG-4810',
            documentUrl: 'https://tms-bucket.s3.amazonaws.com/compliance/rc-4810.pdf',
            expiryDate: new Date('2029-05-15'),
            status: client_1.ComplianceStatus.APPROVED,
            truckId: truck1.id,
            verifiedById: complianceOfficer.id,
        },
    });
    console.log('Seeded Compliance Records.');
    const vendor1 = await prisma.vendor.create({
        data: {
            name: 'Gati Freight Carriers Pvt Ltd',
            taxId: 'GSTIN-27AAAAA1111A1Z1',
            email: 'ops@gatifreight.in',
            phone: '+91222839485',
            address: 'Kalamboli Transport Hub, Navi Mumbai',
            paymentTermsDays: 45,
            complianceVerified: true,
        },
    });
    const vendor2 = await prisma.vendor.create({
        data: {
            name: 'VRL Heavy Transporters',
            taxId: 'GSTIN-29BBBBB2222B2Z2',
            email: 'dispatch@vrlgroup.in',
            phone: '+91802938485',
            address: 'Sanjay Gandhi Transport Nagar, New Delhi',
            paymentTermsDays: 30,
            complianceVerified: true,
        },
    });
    console.log('Seeded Transporter Vendors.');
    const po1 = await prisma.purchaseOrder.create({
        data: {
            poNumber: 'PO-2026-COAL-KORBA-01',
            clientName: 'NTPC Power Generation Ltd',
            commodity: 'Thermal Coal (Grade A)',
            totalQuantityTons: 10000.00,
            allocatedQuantityTons: 450.00,
            ratePerTon: 3200.00,
            currency: 'INR',
            contractUrl: 'https://tms-bucket.s3.amazonaws.com/contracts/po-ntpc-coal.pdf',
            status: client_1.POStatus.ACTIVE,
            startDate: new Date('2026-05-01'),
            endDate: new Date('2026-08-30'),
        },
    });
    const po2 = await prisma.purchaseOrder.create({
        data: {
            poNumber: 'PO-2026-CEMENT-JAIPUR-02',
            clientName: 'UltraTech Cement Corp',
            commodity: 'Ordinary Portland Cement',
            totalQuantityTons: 5000.00,
            allocatedQuantityTons: 120.00,
            ratePerTon: 5400.00,
            currency: 'INR',
            status: client_1.POStatus.ACTIVE,
            startDate: new Date('2026-04-15'),
            endDate: new Date('2026-10-15'),
        },
    });
    console.log('Seeded Purchase Orders.');
    const trip1 = await prisma.trip.create({
        data: {
            tripNumber: 'TRIP-99801',
            purchaseOrderId: po1.id,
            driverId: driver2.id,
            truckId: truck2.id,
            source: 'Korba Coal Fields, Chhattisgarh (Mines Loading)',
            destination: 'Mundra Port Terminal, Gujarat (Unloading)',
            distanceKm: 1350.00,
            estimatedQuantityTons: 38.50,
            actualLoadedTons: 38.20,
            status: client_1.TripStatus.EN_ROUTE,
            scheduledStartDate: new Date('2026-05-22T08:00:00Z'),
            actualStartDate: new Date('2026-05-22T09:15:00Z'),
        },
    });
    const trip3 = await prisma.trip.create({
        data: {
            tripNumber: 'TRIP-99803',
            purchaseOrderId: po1.id,
            driverId: driver4.id,
            truckId: truck1.id,
            vendorId: vendor1.id,
            source: 'Korba Coal Fields, Chhattisgarh (Mines Loading)',
            destination: 'Mundra Port Terminal, Gujarat (Unloading)',
            distanceKm: 1350.00,
            estimatedQuantityTons: 39.00,
            actualLoadedTons: 39.10,
            actualDeliveredTons: 39.05,
            status: client_1.TripStatus.COMPLETED,
            scheduledStartDate: new Date('2026-05-18T08:00:00Z'),
            actualStartDate: new Date('2026-05-18T08:45:00Z'),
            actualEndDate: new Date('2026-05-20T14:30:00Z'),
        },
    });
    console.log('Seeded Trips.');
    await prisma.gatepass.create({
        data: {
            gatepassNumber: 'GP-OUT-99801',
            tripId: trip1.id,
            type: client_1.GatepassType.OUTBOUND,
            status: client_1.GatepassStatus.USED,
            tareWeightTons: 15.20,
            grossWeightTons: 53.40,
            netWeightTons: 38.20,
            sealNumber: 'SEAL-KORBA-4910',
            remarks: 'Tata vehicle loaded with coal. Tarpaulin secured. AIS-140 GPS checked.',
            qrCodeUrl: 'https://tms-bucket.s3.amazonaws.com/gatepasses/gp-out-99801.png',
            issuedAt: new Date('2026-05-22T08:15:00Z'),
            expiresAt: new Date('2026-05-22T20:15:00Z'),
            scannedAt: new Date('2026-05-22T09:10:00Z'),
        },
    });
    await prisma.gatepass.create({
        data: {
            gatepassNumber: 'GP-OUT-99803',
            tripId: trip3.id,
            type: client_1.GatepassType.OUTBOUND,
            status: client_1.GatepassStatus.USED,
            tareWeightTons: 15.30,
            grossWeightTons: 54.40,
            netWeightTons: 39.10,
            sealNumber: 'SEAL-KORBA-4421',
            qrCodeUrl: 'https://tms-bucket.s3.amazonaws.com/gatepasses/gp-out-99803.png',
            issuedAt: new Date('2026-05-18T08:00:00Z'),
            expiresAt: new Date('2026-05-18T20:00:00Z'),
            scannedAt: new Date('2026-05-18T08:40:00Z'),
        },
    });
    await prisma.gatepass.create({
        data: {
            gatepassNumber: 'GP-IN-99803',
            tripId: trip3.id,
            type: client_1.GatepassType.INBOUND,
            status: client_1.GatepassStatus.USED,
            tareWeightTons: 15.30,
            grossWeightTons: 54.35,
            netWeightTons: 39.05,
            remarks: 'Seal matched weighment. Verification complete.',
            qrCodeUrl: 'https://tms-bucket.s3.amazonaws.com/gatepasses/gp-in-99803.png',
            issuedAt: new Date('2026-05-20T13:45:00Z'),
            expiresAt: new Date('2026-05-21T01:45:00Z'),
            scannedAt: new Date('2026-05-20T14:15:00Z'),
        },
    });
    console.log('Seeded Gatepasses.');
    await prisma.expense.create({
        data: {
            tripId: trip1.id,
            category: client_1.ExpenseCategory.FUEL,
            amount: 45000.00,
            currency: 'INR',
            description: 'Diesel refueling en-route at Indian Oil pump, NH-47',
            status: client_1.ExpenseStatus.APPROVED,
            approvedById: financeOfficer.id,
        },
    });
    await prisma.expense.create({
        data: {
            tripId: trip1.id,
            category: client_1.ExpenseCategory.TOLL,
            amount: 8500.00,
            currency: 'INR',
            description: 'Fastag tolls across NH-27',
            status: client_1.ExpenseStatus.PENDING,
        },
    });
    await prisma.expense.create({
        data: {
            tripId: trip3.id,
            category: client_1.ExpenseCategory.FUEL,
            amount: 43000.00,
            currency: 'INR',
            description: 'Fuel card top-up',
            status: client_1.ExpenseStatus.DISBURSED,
            approvedById: financeOfficer.id,
        },
    });
    console.log('Seeded Expenses.');
    const rate = po1.ratePerTon.toNumber();
    const netWeight = 39.05;
    const subtotal = rate * netWeight;
    const tax = subtotal * 0.05;
    const total = subtotal + tax;
    await prisma.invoice.create({
        data: {
            invoiceNumber: 'INV-VEN-491028',
            tripId: trip3.id,
            vendorId: vendor1.id,
            type: client_1.InvoiceType.VENDOR_INVOICE,
            subtotal: subtotal,
            taxAmount: tax,
            totalAmount: total,
            status: client_1.InvoiceStatus.PENDING_RECONCILIATION,
            dueDate: new Date('2026-06-20'),
            reconciliationLog: JSON.stringify({
                matchingResults: {
                    purchaseOrderMatch: true,
                    poNumber: 'PO-2026-COAL-KORBA-01',
                    rateMatched: true,
                    gatepassTonsMatch: true,
                    outboundNetTons: 39.10,
                    inboundNetTons: 39.05,
                    weightVarianceTons: 0.05,
                    weightVariancePercentage: 0.12,
                    varianceWithinLimit: true,
                    approvedAutomatically: true
                }
            }),
            validatedAt: new Date('2026-05-21T09:00:00Z'),
        },
    });
    console.log('Seeded Invoices.');
    const routePoints = [
        { lat: 22.3597, lng: 82.6841 },
        { lat: 22.0797, lng: 82.1399 },
        { lat: 21.2514, lng: 81.6296 },
        { lat: 21.1458, lng: 79.0882 },
        { lat: 23.2599, lng: 77.4126 },
    ];
    for (let i = 0; i < routePoints.length; i++) {
        await prisma.gPSPing.create({
            data: {
                tripId: trip1.id,
                latitude: routePoints[i].lat,
                longitude: routePoints[i].lng,
                speedKmh: 65.50,
                heading: 260,
                timestamp: new Date(Date.now() - (routePoints.length - i) * 600000),
            },
        });
    }
    console.log('Seeded GPS Pings.');
    await prisma.auditLog.create({
        data: {
            userId: dispatcher.id,
            action: 'TRIP_DISPATCHED',
            entity: 'Trip',
            entityId: trip1.id,
            payload: {
                tripNumber: 'TRIP-99801',
                status: 'EN_ROUTE',
                driver: 'Gurpreet Singh',
                truck: 'GJ-12-AT-2918',
            },
            ipAddress: '192.168.1.104',
        },
    });
    console.log('Database Seeding with Indian Parameters Completed successfully.');
}
main()
    .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map