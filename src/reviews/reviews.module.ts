import { Module } from '@nestjs/common';
import { PrismaModule } from '@Prisma';
import { OwnerRatingsController, ReviewsController, TenantReviewsController } from './controllers/index.js';
import { ReviewsRepository } from './repositories/reviews.repository.js';
import { ReviewsService } from './services/reviews.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController, TenantReviewsController, OwnerRatingsController],
  providers: [ReviewsRepository, ReviewsService],
})
export class ReviewsModule {}
