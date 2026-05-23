import { PrismaClient, UserRole, DriverStatus, TruckStatus, DocumentType, ComplianceStatus, POStatus, TripStatus, GatepassType, GatepassStatus, ExpenseCategory, ExpenseStatus, InvoiceType, InvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding TMS database with Indian Logistics parameters (₹ / INR)...');

  // 1. Clean existing records
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

  // 2. Create Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@logistics.com',
      fullName: 'Vikram Sharma',
      passwordHash,
      role: UserRole.SYS_ADMIN,
      phone: '+919876543210',
    },
  });

  const dispatcher = await prisma.user.create({
    data: {
      email: 'dispatcher@logistics.com',
      fullName: 'Rajesh Kumar',
      passwordHash,
      role: UserRole.DISPATCHER,
      phone: '+919876543211',
    },
  });

  const complianceOfficer = await prisma.user.create({
    data: {
      email: 'compliance@logistics.com',
      fullName: 'Arjun Mehta',
      passwordHash,
      role: UserRole.COMPLIANCE_OFFICER,
      phone: '+919876543212',
    },
  });

  const financeOfficer = await prisma.user.create({
    data: {
      email: 'finance@logistics.com',
      fullName: 'Priya Iyer',
      passwordHash,
      role: UserRole.FINANCE_OFFICER,
      phone: '+919876543213',
    },
  });

  const gateOperator = await prisma.user.create({
    data: {
      email: 'gate@logistics.com',
      fullName: 'Sanjay Singh',
      passwordHash,
      role: UserRole.GATE_OPERATOR,
      phone: '+919876543214',
    },
  });

  console.log('Seeded Users.');

  // 3. Create Drivers with Indian driving parameters
  const driver1 = await prisma.driver.create({
    data: {
      fullName: 'Ramesh Yadav',
      licenseNumber: 'IND-DL-5819028',
      licenseExpiry: new Date('2028-12-15'),
      status: DriverStatus.AVAILABLE,
      phone: '+919111222333',
      complianceVerified: true,
    },
  });

  const driver2 = await prisma.driver.create({
    data: {
      fullName: 'Gurpreet Singh',
      licenseNumber: 'IND-DL-2918374',
      licenseExpiry: new Date('2027-06-20'),
      status: DriverStatus.ON_TRIP,
      phone: '+919222333444',
      complianceVerified: true,
    },
  });

  const driver3 = await prisma.driver.create({
    data: {
      fullName: 'Anil Deshmukh',
      licenseNumber: 'IND-DL-1092837',
      licenseExpiry: new Date('2025-05-10'), // Expired
      status: DriverStatus.SUSPENDED,
      phone: '+919333444555',
      complianceVerified: false,
    },
  });

  const driver4 = await prisma.driver.create({
    data: {
      fullName: 'Karthik Raja',
      licenseNumber: 'IND-DL-7728391',
      licenseExpiry: new Date('2029-01-30'),
      status: DriverStatus.AVAILABLE,
      phone: '+919444555666',
      complianceVerified: true,
    },
  });

  console.log('Seeded Drivers.');

  // 4. Create Trucks with Indian plates and AIS-140 standard GPS Devices
  const truck1 = await prisma.truck.create({
    data: {
      plateNumber: 'MH-12-QG-4810',
      model: 'Tata Prima 4028.S Multi-Axle',
      capacityTons: 40.00,
      type: 'Tipper',
      status: TruckStatus.AVAILABLE,
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
      status: TruckStatus.ON_TRIP,
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
      status: TruckStatus.MAINTENANCE,
      gpsDeviceId: 'AIS140-BB-1928',
      complianceVerified: false,
    },
  });

  console.log('Seeded Trucks.');

  // 5. Seeding Indian regulatory compliance documents
  await prisma.complianceRecord.create({
    data: {
      documentType: DocumentType.DRIVING_LICENSE,
      documentNumber: 'IND-DL-5819028',
      documentUrl: 'https://tms-bucket.s3.amazonaws.com/compliance/dl-ramesh.pdf',
      expiryDate: new Date('2028-12-15'),
      status: ComplianceStatus.APPROVED,
      driverId: driver1.id,
      verifiedById: complianceOfficer.id,
    },
  });

  await prisma.complianceRecord.create({
    data: {
      documentType: DocumentType.VEHICLE_REGISTRATION,
      documentNumber: 'REG-MH-12-QG-4810',
      documentUrl: 'https://tms-bucket.s3.amazonaws.com/compliance/rc-4810.pdf',
      expiryDate: new Date('2029-05-15'),
      status: ComplianceStatus.APPROVED,
      truckId: truck1.id,
      verifiedById: complianceOfficer.id,
    },
  });

  console.log('Seeded Compliance Records.');

  // 6. Create Transporters (Vendors)
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

  // 7. Create Purchase Orders with Indian rates (₹ / Ton)
  const po1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-2026-COAL-KORBA-01',
      clientName: 'NTPC Power Generation Ltd',
      commodity: 'Thermal Coal (Grade A)',
      totalQuantityTons: 10000.00,
      allocatedQuantityTons: 450.00,
      ratePerTon: 3200.00, // ₹3,200 per ton
      currency: 'INR',
      contractUrl: 'https://tms-bucket.s3.amazonaws.com/contracts/po-ntpc-coal.pdf',
      status: POStatus.ACTIVE,
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
      ratePerTon: 5400.00, // ₹5,400 per ton
      currency: 'INR',
      status: POStatus.ACTIVE,
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-10-15'),
    },
  });

  console.log('Seeded Purchase Orders.');

  // 8. Create Indian Heavy Freight Trips (Korba Mines to Mundra Port GJ)
  const trip1 = await prisma.trip.create({
    data: {
      tripNumber: 'TRIP-99801',
      purchaseOrderId: po1.id,
      driverId: driver2.id, // Gurpreet Singh (ON_TRIP)
      truckId: truck2.id,   // Ashok Leyland (ON_TRIP)
      source: 'Korba Coal Fields, Chhattisgarh (Mines Loading)',
      destination: 'Mundra Port Terminal, Gujarat (Unloading)',
      distanceKm: 1350.00,
      estimatedQuantityTons: 38.50,
      actualLoadedTons: 38.20,
      status: TripStatus.EN_ROUTE,
      scheduledStartDate: new Date('2026-05-22T08:00:00Z'),
      actualStartDate: new Date('2026-05-22T09:15:00Z'),
    },
  });

  const trip3 = await prisma.trip.create({
    data: {
      tripNumber: 'TRIP-99803',
      purchaseOrderId: po1.id,
      driverId: driver4.id, // Karthik Raja
      truckId: truck1.id,   // Tata Prima
      vendorId: vendor1.id, // Subcontracted to Gati
      source: 'Korba Coal Fields, Chhattisgarh (Mines Loading)',
      destination: 'Mundra Port Terminal, Gujarat (Unloading)',
      distanceKm: 1350.00,
      estimatedQuantityTons: 39.00,
      actualLoadedTons: 39.10,
      actualDeliveredTons: 39.05, // 0.05 ton shrinkage
      status: TripStatus.COMPLETED,
      scheduledStartDate: new Date('2026-05-18T08:00:00Z'),
      actualStartDate: new Date('2026-05-18T08:45:00Z'),
      actualEndDate: new Date('2026-05-20T14:30:00Z'),
    },
  });

  console.log('Seeded Trips.');

  // 9. Seeding weighing tickets for Gatepasses
  await prisma.gatepass.create({
    data: {
      gatepassNumber: 'GP-OUT-99801',
      tripId: trip1.id,
      type: GatepassType.OUTBOUND,
      status: GatepassStatus.USED,
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
      type: GatepassType.OUTBOUND,
      status: GatepassStatus.USED,
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
      type: GatepassType.INBOUND,
      status: GatepassStatus.USED,
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

  // 10. Seeding Indian Fuel & Toll Expenses
  await prisma.expense.create({
    data: {
      tripId: trip1.id,
      category: ExpenseCategory.FUEL,
      amount: 45000.00, // ₹45,000 for long-haul diesel
      currency: 'INR',
      description: 'Diesel refueling en-route at Indian Oil pump, NH-47',
      status: ExpenseStatus.APPROVED,
      approvedById: financeOfficer.id,
    },
  });

  await prisma.expense.create({
    data: {
      tripId: trip1.id,
      category: ExpenseCategory.TOLL,
      amount: 8500.00, // ₹8,500 NHAI Fastag electronic deduction
      currency: 'INR',
      description: 'Fastag tolls across NH-27',
      status: ExpenseStatus.PENDING,
    },
  });

  await prisma.expense.create({
    data: {
      tripId: trip3.id,
      category: ExpenseCategory.FUEL,
      amount: 43000.00,
      currency: 'INR',
      description: 'Fuel card top-up',
      status: ExpenseStatus.DISBURSED,
      approvedById: financeOfficer.id,
    },
  });

  console.log('Seeded Expenses.');

  // 11. Create Invoices (3-Way Matching reconciliation in Rupees)
  const rate = po1.ratePerTon.toNumber(); // ₹3200
  const netWeight = 39.05; // delivered tons
  const subtotal = rate * netWeight; // ₹1,24,960.00
  const tax = subtotal * 0.05; // 5% GST = ₹6,248.00
  const total = subtotal + tax; // ₹1,31,208.00

  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-VEN-491028',
      tripId: trip3.id,
      vendorId: vendor1.id,
      type: InvoiceType.VENDOR_INVOICE,
      subtotal: subtotal,
      taxAmount: tax,
      totalAmount: total,
      status: InvoiceStatus.PENDING_RECONCILIATION,
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
          varianceWithinLimit: true, // tolerance <= 0.50%
          approvedAutomatically: true
        }
      }),
      validatedAt: new Date('2026-05-21T09:00:00Z'),
    },
  });

  console.log('Seeded Invoices.');

  // 12. Seeding Indian geography GPS logs for Trip1 (Central-West transit corridor)
  const routePoints = [
    { lat: 22.3597, lng: 82.6841 }, // Korba mine CG
    { lat: 22.0797, lng: 82.1399 }, // Bilaspur
    { lat: 21.2514, lng: 81.6296 }, // Raipur
    { lat: 21.1458, lng: 79.0882 }, // Nagpur
    { lat: 23.2599, lng: 77.4126 }, // Bhopal
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

  // 13. Create Audit Logs
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
