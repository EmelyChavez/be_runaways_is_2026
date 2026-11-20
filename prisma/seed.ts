import 'dotenv/config';
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  BookingStatus,
  DepositStatus,
  IdentityDocumentStatus,
  IdentityDocumentType,
  NotificationEventType,
  NotificationStatus,
  OriginModule,
  PropertyCategory,
  PropertyStatus,
  ReviewType,
  Role,
  TransactionType,
} from '../src/generated/prisma/enums.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SEED_TEST_PASSWORD = process.env.SEED_TEST_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;
const SEED_HOUSE_IMAGE_URL = 'https://images.unsplash.com/photo-1649704584931-50d1480cf10a?auto=format&fit=crop&w=1200&q=80';
const SEED_CAMERA_IMAGE_URL = 'https://images.unsplash.com/photo-1650291879584-0e3944c6c815?auto=format&fit=crop&w=1200&q=80';

if (!DATABASE_URL) throw new Error('DATABASE_URL debe configurarse para ejecutar el seed.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
const DAY_MS = 24 * 60 * 60 * 1000;
const TEST_ACCOUNTS = [
  //Propietaria Demo
  { email: 'owner.demo@runaways.test', name: 'Emely Chavez', role: Role.OWNER, isVerified: true },
  //Propietario Secundario
  { email: 'owner.second@runaways.test', name: 'Fernando Diaz', role: Role.OWNER, isVerified: true },
  //Arrendataria Verificada
  { email: 'tenant.verified@runaways.test', name: 'Karla Martinez', role: Role.TENANT, isVerified: true },
  //Arrendatario Demo
  { email: 'tenant.demo@runaways.test', name: 'Karina Perez', role: Role.TENANT, isVerified: true },
  // Arrendataria Pendiente
  { email: 'tenant.pending@runaways.test', name: 'Violeta Amaya', role: Role.TENANT, isVerified: false },
  // Arrendatario Rechazado
  { email: 'tenant.rejected@runaways.test', name: 'Natalia Coto', role: Role.TENANT, isVerified: false },
] as const;

function getElSalvadorDate(offsetDays: number): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localCalendarDay = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) + offsetDays,
  ));
  return localCalendarDay;
}

function daysFromNow(offsetDays: number): Date {
  return new Date(Date.now() + offsetDays * DAY_MS);
}

function createSeedPdf(): Buffer {
  const content = 'BT /F1 12 Tf 36 100 Td (Runaways seed identity verification document) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 144] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

async function seedIdentityDocumentUrl(fileName: string): Promise<string> {
  const cloudinaryValues = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ];
  const configuredCount = cloudinaryValues.filter(Boolean).length;
  if (configuredCount === 0) {
    return `https://example.invalid/runaways/documents/${fileName}`;
  }
  if (configuredCount !== cloudinaryValues.length) {
    throw new Error('Configura las tres credenciales de Cloudinary o ninguna para ejecutar el seed.');
  }

  cloudinary.config({
    cloud_name: cloudinaryValues[0],
    api_key: cloudinaryValues[1],
    api_secret: cloudinaryValues[2],
    secure: true,
  });
  const result = await cloudinary.uploader.upload(
    `data:application/pdf;base64,${createSeedPdf().toString('base64')}`,
    {
      folder: 'runaways/documents',
      public_id: fileName,
      resource_type: 'raw',
      type: 'authenticated',
      access_mode: 'authenticated',
      format: 'pdf',
      overwrite: true,
      use_filename: false,
      unique_filename: false,
    },
  );
  return result.secure_url;
}

async function seedPropertyImageUrl(sourceUrl: string, publicId: string): Promise<string> {
  const cloudinaryValues = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ];
  const configuredCount = cloudinaryValues.filter(Boolean).length;
  if (configuredCount === 0) return sourceUrl;
  if (configuredCount !== cloudinaryValues.length) {
    throw new Error('Configura las tres credenciales de Cloudinary o ninguna para ejecutar el seed.');
  }

  cloudinary.config({
    cloud_name: cloudinaryValues[0],
    api_key: cloudinaryValues[1],
    api_secret: cloudinaryValues[2],
    secure: true,
  });
  const result = await cloudinary.uploader.upload(sourceUrl, {
    folder: 'runaways/properties',
    public_id: publicId,
    overwrite: true,
    use_filename: false,
    unique_filename: false,
  });
  return result.secure_url;
}

async function assertSeedAccountsDoNotExist(): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { email: { in: TEST_ACCOUNTS.map(({ email }) => email) } },
    select: { email: true },
  });
  if (existing) {
    throw new Error(
      `Seed detenido: ya existe la cuenta de prueba ${existing.email}. Este seed genera IDs automáticamente y debe ejecutarse una sola vez por base de datos.`,
    );
  }
}

async function seedUsers() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SEED_TEST_PASSWORD) {
    throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD y SEED_TEST_PASSWORD deben configurarse para ejecutar el seed.');
  }

  if (TEST_ACCOUNTS.some(({ email }) => email === ADMIN_EMAIL)) {
    throw new Error('ADMIN_EMAIL no puede coincidir con el correo reservado para una cuenta de prueba.');
  }

  const [adminPasswordHash, testPasswordHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, 12),
    bcrypt.hash(SEED_TEST_PASSWORD, 12),
  ]);
  const [pendingDocumentUrl, rejectedDocumentUrl] = await Promise.all([
    seedIdentityDocumentUrl('seed-pending-document.pdf'),
    seedIdentityDocumentUrl('seed-rejected-document.pdf'),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: 'Admin Runaways', passwordHash: adminPasswordHash, role: Role.ADMIN, isActive: true },
    create: {
      email: ADMIN_EMAIL,
      name: 'Admin Runaways',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });
  await prisma.profile.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id },
  });

  const users = new Map<string, string>([[admin.email, admin.id]]);
  for (const account of TEST_ACCOUNTS) {
    const user = await prisma.user.create({
      data: {
        email: account.email,
        name: account.name,
        passwordHash: testPasswordHash,
        role: account.role,
        isActive: true,
      },
    });
    users.set(account.email, user.id);

    const profile = await prisma.profile.create({
      data: { userId: user.id, isVerified: account.isVerified },
    });

    const document = account.email === 'tenant.pending@runaways.test'
      ? {
          documentType: IdentityDocumentType.DUI,
          documentNumber: '00000000-0',
          documentStatus: IdentityDocumentStatus.PENDING,
          rejectionReason: null,
          reviewedAt: null,
        }
      : account.email === 'tenant.rejected@runaways.test'
        ? {
            documentType: IdentityDocumentType.PASSPORT,
            documentNumber: 'SEED-PA1234567',
            documentStatus: IdentityDocumentStatus.REJECTED,
            rejectionReason: 'La imagen del documento no es legible.',
            reviewedAt: daysFromNow(-2),
          }
        : account.isVerified
          ? {
              documentType: IdentityDocumentType.DUI,
              documentNumber: '00000000-0',
              documentStatus: IdentityDocumentStatus.APPROVED,
              rejectionReason: null,
              reviewedAt: daysFromNow(-10),
            }
          : null;

    if (document) {
      const submittedAt = account.email === 'tenant.pending@runaways.test'
        ? daysFromNow(-1)
        : daysFromNow(-12);
      const documentUrl = account.email === 'tenant.pending@runaways.test'
        ? pendingDocumentUrl
        : account.email === 'tenant.rejected@runaways.test'
          ? rejectedDocumentUrl
          : `https://res.cloudinary.com/demo/raw/upload/authenticated/runaways/documents/${account.email.split('@')[0]}.pdf`;
      await prisma.identityDocument.create({
        data: {
          profileId: profile.id,
          ...document,
          documentUrl,
          submittedAt,
        },
      });
    }
  }

  return {
    adminId: admin.id,
    ownerId: users.get('owner.demo@runaways.test')!,
    secondOwnerId: users.get('owner.second@runaways.test')!,
    verifiedTenantId: users.get('tenant.verified@runaways.test')!,
    tenantId: users.get('tenant.demo@runaways.test')!,
    pendingTenantId: users.get('tenant.pending@runaways.test')!,
  };
}

async function seedProperties(ownerId: string, secondOwnerId: string, houseImage: string, cameraImage: string) {
  const ownerProperty = await prisma.property.create({
    data: {
      ownerId,
      title: 'Apartamento céntrico de prueba',
      description: 'Espacio de ejemplo en San Salvador para probar catálogo, disponibilidad, reservas y pagos.',
      category: PropertyCategory.PROPERTY,
      department: 'San Salvador',
      municipality: 'San Salvador',
      address: 'Centro de San Salvador',
      pricePerDay: '45.00',
      securityDeposit: '80.00',
      images: [houseImage],
      status: PropertyStatus.AVAILABLE,
      verifiedOnly: true,
    },
  });
  const ownerEquipment = await prisma.property.create({
    data: {
      ownerId,
      title: 'Cámara de prueba',
      description: 'Equipo fotográfico de ejemplo sin depósito de garantía.',
      category: PropertyCategory.EQUIPMENT,
      department: 'La Libertad',
      municipality: 'Santa Tecla',
      address: 'Santa Tecla',
      pricePerDay: '30.00',
      securityDeposit: '0.00',
      images: [cameraImage],
      status: PropertyStatus.AVAILABLE,
      verifiedOnly: true,
    },
  });
  const secondOwnerProperty = await prisma.property.create({
    data: {
      ownerId: secondOwnerId,
      title: 'Equipo de sonido pausado de prueba',
      description: 'Publicación de ejemplo pausada para los reportes del arrendador.',
      category: PropertyCategory.EQUIPMENT,
      department: 'La Libertad',
      municipality: 'Antiguo Cuscatlán',
      address: 'Antiguo Cuscatlán',
      pricePerDay: '25.00',
      securityDeposit: '40.00',
      images: [cameraImage],
      status: PropertyStatus.PAUSED,
      verifiedOnly: true,
    },
  });

  await prisma.noAvailability.create({
    data: {
      propertyId: ownerProperty.id,
      startDate: getElSalvadorDate(25),
      endDate: getElSalvadorDate(26),
    },
  });
  return { ownerPropertyId: ownerProperty.id, ownerEquipmentId: ownerEquipment.id, secondOwnerPropertyId: secondOwnerProperty.id };
}

async function seedBookings(
  tenantId: string,
  ownerId: string,
  properties: { ownerPropertyId: string; ownerEquipmentId: string; secondOwnerPropertyId: string },
) {
  const bookings = {
    pending: await prisma.booking.create({
      data: {
        propertyId: properties.ownerPropertyId,
        tenantId,
        startDate: getElSalvadorDate(5),
        endDate: getElSalvadorDate(6),
        subtotal: '90.00',
        status: BookingStatus.PENDING,
        expiresAt: daysFromNow(1),
        createdAt: daysFromNow(-1),
        updatedAt: daysFromNow(-1),
      },
    }),
    paid: await prisma.booking.create({
      data: {
        propertyId: properties.ownerPropertyId,
        tenantId,
        startDate: getElSalvadorDate(10),
        endDate: getElSalvadorDate(11),
        subtotal: '90.00',
        status: BookingStatus.PAID,
        expiresAt: daysFromNow(-5),
        createdAt: daysFromNow(-6),
        updatedAt: daysFromNow(-5),
      },
    }),
    completed: await prisma.booking.create({
      data: {
        propertyId: properties.ownerPropertyId,
        tenantId,
        startDate: getElSalvadorDate(-5),
        endDate: getElSalvadorDate(-3),
        subtotal: '135.00',
        status: BookingStatus.COMPLETED,
        expiresAt: daysFromNow(-20),
        createdAt: daysFromNow(-20),
        updatedAt: daysFromNow(-2),
      },
    }),
    reviewed: await prisma.booking.create({
      data: {
        propertyId: properties.ownerEquipmentId,
        tenantId,
        startDate: getElSalvadorDate(-10),
        endDate: getElSalvadorDate(-9),
        subtotal: '60.00',
        status: BookingStatus.COMPLETED,
        expiresAt: daysFromNow(-25),
        createdAt: daysFromNow(-25),
        updatedAt: daysFromNow(-8),
      },
    }),
    canceled: await prisma.booking.create({
      data: {
        propertyId: properties.secondOwnerPropertyId,
        tenantId,
        startDate: getElSalvadorDate(15),
        endDate: getElSalvadorDate(16),
        subtotal: '50.00',
        status: BookingStatus.CANCELED,
        expiresAt: daysFromNow(-10),
        createdAt: daysFromNow(-11),
        updatedAt: daysFromNow(-10),
      },
    }),
  };

  const payments = [
    { bookingId: bookings.paid.id, payerId: tenantId, receiptNumber: 'PAY-SEED-000001', rentalAmount: '90.00', depositAmount: '80.00', totalAmount: '170.00', last4Digits: '4242', createdAt: daysFromNow(-5) },
    { bookingId: bookings.completed.id, payerId: tenantId, receiptNumber: 'PAY-SEED-000002', rentalAmount: '135.00', depositAmount: '80.00', totalAmount: '215.00', last4Digits: '4242', createdAt: daysFromNow(-18) },
    { bookingId: bookings.reviewed.id, payerId: tenantId, receiptNumber: 'PAY-SEED-000003', rentalAmount: '60.00', depositAmount: '0.00', totalAmount: '60.00', last4Digits: '4242', createdAt: daysFromNow(-23) },
  ];
  for (const payment of payments) await prisma.payment.create({ data: payment });

  await prisma.deposit.create({
    data: { bookingId: bookings.completed.id, amount: '80.00', state: DepositStatus.PENDING },
  });
  await prisma.deposit.create({
    data: { bookingId: bookings.reviewed.id, amount: '0.00', state: DepositStatus.PENDING },
  });

  const charges = [
    { bookingId: bookings.paid.id, amount: '170.00', reason: 'Cobro semilla de alquiler y depósito.' },
    { bookingId: bookings.completed.id, amount: '215.00', reason: 'Cobro semilla de alquiler y depósito.' },
    { bookingId: bookings.reviewed.id, amount: '60.00', reason: 'Cobro semilla de alquiler.' },
  ];
  for (const charge of charges) {
    await prisma.transactionHistory.create({
      data: { ...charge, actorId: tenantId, type: TransactionType.CHARGE },
    });
  }

  await prisma.review.create({
    data: {
      reservationId: bookings.reviewed.id,
      propertyId: properties.ownerEquipmentId,
      authorId: tenantId,
      targetUserId: ownerId,
      reviewType: ReviewType.RENTER_TO_PROPERTY,
      propertyRating: 5,
      userRating: 5,
      comment: 'Buen equipo y entrega puntual.',
    },
  });
  await prisma.review.create({
    data: {
      reservationId: bookings.reviewed.id,
      propertyId: properties.ownerEquipmentId,
      authorId: ownerId,
      targetUserId: tenantId,
      reviewType: ReviewType.OWNER_TO_RENTER,
      propertyRating: null,
      userRating: 5,
      comment: 'Arrendatario responsable.',
    },
  });

  return bookings;
}

async function seedMessagingAndNotifications(
  tenantId: string,
  ownerId: string,
  ownerPropertyId: string,
  pendingBookingId: string,
  paidBookingId: string,
) {
  const conversation = await prisma.conversation.create({
    data: { propertyId: ownerPropertyId, tenantId },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: tenantId,
      content: '¿El apartamento tiene estacionamiento?',
      isRead: true,
    },
  });
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: ownerId,
      content: 'Sí, incluye un espacio de estacionamiento.',
      isRead: false,
    },
  });

  const notifications = [
    {
      recipientId: tenantId,
      eventType: NotificationEventType.RESERVATION_CREATED,
      originModule: OriginModule.RESERVATIONS,
      title: 'Reserva creada',
      message: 'Tu reserva de prueba está pendiente de pago.',
      referenceId: pendingBookingId,
      status: NotificationStatus.UNREAD,
    },
    {
      recipientId: ownerId,
      eventType: NotificationEventType.PAYMENT_CONFIRMED,
      originModule: OriginModule.PAYMENTS,
      title: 'Pago confirmado',
      message: 'Se registró un pago de prueba para uno de tus bienes.',
      referenceId: paidBookingId,
      status: NotificationStatus.UNREAD,
    },
    {
      recipientId: tenantId,
      eventType: NotificationEventType.DOCUMENT_REJECTED,
      originModule: OriginModule.VERIFICATION,
      title: 'Documento revisado',
      message: 'El documento semilla de prueba fue rechazado.',
      referenceId: null,
      status: NotificationStatus.READ,
    },
  ];
  for (const notification of notifications) await prisma.notification.create({ data: notification });
}

async function main() {
  await assertSeedAccountsDoNotExist();
  const users = await seedUsers();
  const [houseImageUrl, cameraImageUrl] = await Promise.all([
    seedPropertyImageUrl(SEED_HOUSE_IMAGE_URL, 'seed-house'),
    seedPropertyImageUrl(SEED_CAMERA_IMAGE_URL, 'seed-camera'),
  ]);
  const properties = await seedProperties(users.ownerId, users.secondOwnerId, houseImageUrl, cameraImageUrl);
  const bookings = await seedBookings(users.tenantId, users.ownerId, properties);
  await seedMessagingAndNotifications(
    users.tenantId,
    users.ownerId,
    properties.ownerPropertyId,
    bookings.pending.id,
    bookings.paid.id,
  );

  console.log('Datos semilla listos. Cuentas de prueba:');
  console.log('  owner.demo@runaways.test');
  console.log('  owner.second@runaways.test');
  console.log('  tenant.verified@runaways.test');
  console.log('  tenant.demo@runaways.test');
  console.log('  tenant.pending@runaways.test');
  console.log('  tenant.rejected@runaways.test');
  console.log('Usa SEED_TEST_PASSWORD para iniciar sesión con las cuentas de prueba.');
  console.log(`ADMIN: ${ADMIN_EMAIL}`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
