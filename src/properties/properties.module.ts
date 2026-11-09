import { Module } from '@nestjs/common';
import { PropertiesController } from '@Properties/controllers';
import { PropertiesRepository } from '@Properties/repositories';
import { PropertiesService } from '@Properties/services';

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesRepository, PropertiesService],
})
export class PropertiesModule {}
