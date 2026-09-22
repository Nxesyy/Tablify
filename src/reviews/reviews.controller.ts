import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { JwtAuthGuard } from '../helper/jwt.auth.guard.js';
import { RolesGuard } from '../helper/roles-guard.js';
import { Roles } from '../helper/roles.decorator.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Mengirim ulasan & rating fasilitas (Khusus Member setelah sesi reservasi selesai)
   * Route: POST /reviews
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  @Post('reviews')
  createReview(@Body() dto: CreateReviewDto, @Req() req: any) {
    return this.reviewsService.createReview(dto, req.user.id);
  }

  /**
   * Mengambil riwayat seluruh ulasan yang pernah dikirim oleh member
   * Route: GET /reviews/my-reviews
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MEMBER')
  @Get('reviews/my-reviews')
  getMyReviews(@Req() req: any) {
    return this.reviewsService.getMyReviews(req.user.id);
  }

  /**
   * Mengambil seluruh ulasan pelanggan untuk gerai milik Admin yang sedang login
   * Route: GET /reviews/admin
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_SPACE')
  @Get('reviews/admin')
  getAdminReviews(
    @Req() req: any,
    @Query('space_id') spaceId?: string,
    @Query('rating') rating?: string,
    @Query('search') search?: string,
  ) {
    return this.reviewsService.getOwnerReviews(req.user.id, {
      space_id: spaceId ? +spaceId : undefined,
      rating: rating ? +rating : undefined,
      search,
    });
  }

  /**
   * Melihat ulasan & agregasi rating berdasarkan space
   * Route: GET /spaces/:id/reviews
   */
  @Get('spaces/:id/reviews')
  getSpaceReviews(@Param('id') id: string) {
    return this.reviewsService.getSpaceReviews(+id);
  }

  /**
   * Endpoint alias: GET /reviews/space/:id
   */
  @Get('reviews/space/:id')
  getReviewsBySpaceAlias(@Param('id') id: string) {
    return this.reviewsService.getSpaceReviews(+id);
  }
}
