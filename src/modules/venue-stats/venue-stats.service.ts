import { Injectable, NotFoundException, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VenueStats, VenueStatsDocument } from '../../entities/venue-stats.entity';
import { UpsertVenueStatsDto } from './dto/upsert-venue-stats.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class VenueStatsService {
  private readonly logger = new Logger(VenueStatsService.name);

  constructor(
    @InjectModel(VenueStats.name) private venueStatsModel: Model<VenueStatsDocument>,
    private responseService: ResponseService,
  ) {}

  async getStatsByVenueId(venueId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const stats = await this.venueStatsModel.findOne({ venueId: new Types.ObjectId(venueId) }).exec();

      if (!stats) {
        // Return empty stats structure
        return this.responseService.successWithSingle(
          {},
          'No stats found for this venue',
          'STATS_NOT_FOUND',
          'No stats found for this venue',
          undefined,
          HttpStatus.OK,
        );
      }

      return this.responseService.successWithSingle(
        stats,
        'Venue stats retrieved successfully',
        'STATS_RETRIEVED',
        'Venue stats retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Error getting venue stats: ${error.message}`);
      return this.responseService.error(
        'Failed to get venue stats',
        'STATS_GET_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async upsertStats(venueId: string, dto: UpsertVenueStatsDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const stats = await this.venueStatsModel.findOneAndUpdate(
        { venueId: new Types.ObjectId(venueId) },
        {
          $set: {
            ...dto,
            venueId: new Types.ObjectId(venueId),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      ).exec();

      return this.responseService.successWithSingle(
        stats,
        'Venue stats saved successfully',
        'STATS_SAVED',
        'Venue stats saved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Error upserting venue stats: ${error.message}`);
      return this.responseService.error(
        'Failed to save venue stats',
        'STATS_SAVE_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

