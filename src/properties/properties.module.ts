import { Module } from '@nestjs/common';
import { PropertiesController } from '@Properties/controllers';
import { PropertiesRepository } from '@Properties/repositories';
import { CloudinaryService, PropertiesService } from '@Properties/services';

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertiesRepository, CloudinaryService],
})
export class PropertiesModule {}