import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@Auth';
import { JwtAuthGuard, RolesGuard } from '@Auth/guards';
import { HealthModule } from '@Health';
import { PrismaModule } from '@Prisma';
import { ProfileModule } from '@Profile';
import { PropertiesModule } from '@Properties';
import { NotificationsModule } from '@Notifications';
import { BookingsModule } from '@Bookings';
import { UsersModule } from '@Users';
import { PaymentsModule } from '@Payments';
import { IncomeModule } from '@Income';
import { validateEnv } from '@Config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Si falta DATABASE_URL o JWT_SECRET, la app no arranca.
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ProfileModule,
    PropertiesModule,
    NotificationsModule,
    BookingsModule,
    PaymentsModule,
    IncomeModule,
  ],
  providers: [
    {
      // Todo cerrado por defecto: las rutas públicas se abren con @Public().
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      // Corre después de JwtAuthGuard, que carga el usuario autenticado.
      provide: APP_GUARD,
      useExisting: RolesGuard,
    },
  ],
})
export class AppModule {}
