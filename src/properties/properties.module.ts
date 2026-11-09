import { Module } from '@nestjs/common';
import { PropertiesController } from '@Properties/controllers';
import { PropertyRepository } from '@Properties/repositories';
import { CloudinaryService, PropertiesService } from '@Properties/services';

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertyRepository, CloudinaryService],
})
export class PropertiesModule {}
