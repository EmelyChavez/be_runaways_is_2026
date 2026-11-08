import { Module } from '@nestjs/common';
import { AuthModule } from '@Auth';
import { ProfileController } from '@Profile/controllers';
import { ProfileRoleRepository } from '@Profile/repositories';
import { ProfileRoleService } from '@Profile/services';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController],
  providers: [ProfileRoleRepository, ProfileRoleService],
})
export class ProfileModule {}
