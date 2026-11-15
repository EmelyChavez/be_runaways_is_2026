import { Module } from '@nestjs/common';
import { AuthModule } from '@Auth';
import { ProfileController } from '@Profile/controllers';
import { ProfileRoleRepository } from '@Profile/repositories';
import { ProfileRoleService } from '@Profile/services';
import { IdentityDocumentModule } from '@IdentityDocument';

@Module({
  imports: [AuthModule, IdentityDocumentModule],
  controllers: [ProfileController],
  providers: [ProfileRoleRepository, ProfileRoleService],
})
export class ProfileModule {}
