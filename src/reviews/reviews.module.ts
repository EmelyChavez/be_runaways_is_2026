import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { ReviewsController } from './controllers/reviews.controller.js';
import { ReviewsRepository } from './repositories/reviews.repository.js';
import { ReviewsService } from './services/reviews.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsRepository, ReviewsService],
})
export class ReviewsModule {}
