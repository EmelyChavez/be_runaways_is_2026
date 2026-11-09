import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenService } from '@Auth/services';
import {
  BookingStatus,
  DepositStatus,
  PropertyStatus,
  Role,
} from '@PrismaClient';
import { RoleChangeResponseDto } from '@Profile/dto';
import {
  ConcurrentRoleChangeError,
  ProfileRoleRepository,
} from '@Profile/repositories';

@Injectable()
export class ProfileRoleService {
  constructor(
    private readonly profileRoleRepository: ProfileRoleRepository,
    private readonly tokenService: TokenService,
  ) {}

  async changeRole(
    userId: string,
    requestedRole: Role,
  ): Promise<RoleChangeResponseDto> {
    try {
      const result = await this.profileRoleRepository.inSerializableTransaction(
        async (repository) => {
          const user = await repository.findUserWithProfile(userId);

          if (!user || !user.isActive) {
            throw new UnauthorizedException({
              code: 'UNAUTHORIZED',
              message: 'La sesión no corresponde a una cuenta activa.',
            });
          }

          if (user.role === Role.ADMIN) {
            throw new ForbiddenException({
              code: 'FORBIDDEN',
              message: 'ADMIN no puede cambiar su rol por este medio.',
            });
          }

          if (user.role === requestedRole) {
            throw new ConflictException({
              code: 'ROLE_UNCHANGED',
              message: 'El usuario ya tiene el rol solicitado.',
            });
          }

          if (
            user.role === Role.TENANT &&
            requestedRole === Role.OWNER &&
            !user.profile?.isVerified
          ) {
            throw new ForbiddenException({
              code: 'ACCOUNT_NOT_VERIFIED',
              message: 'Debes verificar tu cuenta antes de cambiar a OWNER.',
            });
          }

          const hasActiveBooking = await repository.hasBookingWithStatuses(
            userId,
            [BookingStatus.PENDING, BookingStatus.PAID],
          );
          const hasPendingDeposit = await repository.hasDepositWithState(
            userId,
            DepositStatus.PENDING,
          );

          if (hasActiveBooking || hasPendingDeposit) {
            throw new ConflictException({
              code: 'ROLE_CHANGE_BLOCKED',
              message:
                'No se puede cambiar el rol mientras haya reservas activas o depósitos pendientes de decisión.',
            });
          }

          const previousRole = user.role;

          if (requestedRole === Role.TENANT) {
            await repository.pauseProperties(
              userId,
              PropertyStatus.AVAILABLE,
              PropertyStatus.PAUSED,
            );
          }

          const updatedUser = await repository.updateUserRole(
            userId,
            requestedRole,
          );

          return { user: updatedUser, previousRole };
        },
      );

      const tokens = await this.tokenService.issueTokenPair(result.user);
      return RoleChangeResponseDto.from(
        result.user,
        result.previousRole,
        tokens,
      );
    } catch (error) {
      if (error instanceof ConcurrentRoleChangeError) {
        throw new ConflictException({
          code: 'ROLE_CHANGE_BLOCKED',
          message:
            'No se puede cambiar el rol mientras haya reservas activas o depósitos pendientes de decisión.',
        });
      }

      throw error;
    }
  }
}
