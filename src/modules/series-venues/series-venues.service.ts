import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SeriesVenue } from '../../entities/series-venue.entity';
import { AddVenueToSeriesDto } from './dto/add-venue-to-series.dto';
import { UpdateSeriesVenueDto } from './dto/update-series-venue.dto';
import { QuerySeriesVenuesDto } from './dto/query-series-venues.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';
import { Venue } from '../../entities/venue.entity';

@Injectable()
export class SeriesVenuesService {
  private readonly logger = new Logger(SeriesVenuesService.name);

  constructor(
    @InjectModel(SeriesVenue.name) private seriesVenueModel: Model<SeriesVenue>,
    @InjectModel(Venue.name) private venueModel: Model<Venue>,
    private readonly responseService: ResponseService,
  ) {}

  async addVenueToSeries(
    seriesId: string,
    addVenueDto: AddVenueToSeriesDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      // Validate seriesId
      if (!seriesId || !Types.ObjectId.isValid(seriesId)) {
        return this.responseService.error(
          'Invalid series ID',
          'INVALID_SERIES_ID',
          'Series ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const venueId = addVenueDto.venueId || (addVenueDto as any).venueId;
      
      if (!venueId) {
        return this.responseService.error(
          'Venue ID is required',
          'VENUE_ID_REQUIRED',
          'Venue ID must be provided',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate venueId format
      if (!Types.ObjectId.isValid(venueId)) {
        return this.responseService.error(
          'Invalid venue ID',
          'INVALID_VENUE_ID',
          'Venue ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if venue already exists in this series
      const existing = await this.seriesVenueModel.findOne({
        seriesId: new Types.ObjectId(seriesId),
        venueId: new Types.ObjectId(venueId),
      });

      if (existing) {
        return this.responseService.error(
          'Venue already exists in this series',
          'VENUE_ALREADY_EXISTS',
          'This venue is already associated with the series',
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      // Verify venue exists
      const venue = await this.venueModel.findById(venueId);
      if (!venue) {
        return this.responseService.error(
          'Venue not found',
          'VENUE_NOT_FOUND',
          'The specified venue does not exist',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Get max priority for this series to set next priority
      const maxPriority = await this.seriesVenueModel
        .findOne({ seriesId: new Types.ObjectId(seriesId) })
        .sort({ priority: -1 })
        .select('priority')
        .lean();

      const seriesVenue = new this.seriesVenueModel({
        seriesId: new Types.ObjectId(seriesId),
        venueId: new Types.ObjectId(venueId),
        isActive: addVenueDto.isActive !== undefined ? addVenueDto.isActive : true,
        priority: addVenueDto.priority !== undefined ? addVenueDto.priority : (maxPriority?.priority ? maxPriority.priority + 1 : 0),
      });

      this.logger.debug('Saving series venue', { seriesId, venueId });
      await seriesVenue.save();
      this.logger.debug('Series venue saved successfully', { id: seriesVenue._id });

      // Populate venue data
      try {
        await seriesVenue.populate('venueId', 'name city country state capacity');
        this.logger.debug('Venue populated successfully');
      } catch (populateError: any) {
        this.logger.warn('Failed to populate venue, continuing without populate', populateError.message);
        // Continue without populate - the venueId will still be available
      }

      return this.responseService.successWithSingle(
        seriesVenue,
        'Venue added to series successfully',
        'VENUE_ADDED_TO_SERIES',
        'Venue added to series successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      this.logger.error('Error in addVenueToSeries', error.stack || error.message || error);
      if (error.code === 11000) {
        return this.responseService.error(
          'Venue already exists in this series',
          'VENUE_ALREADY_EXISTS',
          'Duplicate key error: ' + error.message,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }
      return this.responseService.error(
        'Failed to add venue to series',
        'ADD_VENUE_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSeriesVenues(
    seriesId: string,
    query: QuerySeriesVenuesDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const filter: any = {
        seriesId: new Types.ObjectId(seriesId),
      };

      if (query.isActive !== undefined) {
        filter.isActive = query.isActive;
      }

      if (query.venueId) {
        filter.venueId = new Types.ObjectId(query.venueId);
      }

      let venues = await this.seriesVenueModel
        .find(filter)
        .populate('venueId', 'name city country state capacity image')
        .sort({ priority: 1, createdAt: 1 })
        .lean();

      // Apply search filter if provided
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        venues = venues.filter((sv: any) => {
          const venue = sv.venueId;
          if (typeof venue === 'object' && venue !== null) {
            return (
              venue.name?.toLowerCase().includes(searchLower) ||
              venue.city?.toLowerCase().includes(searchLower) ||
              venue.country?.toLowerCase().includes(searchLower) ||
              venue.state?.toLowerCase().includes(searchLower)
            );
          }
          return false;
        });
      }

      return this.responseService.successWithSingle(
        venues,
        'Series venues retrieved successfully',
        'SERIES_VENUES_RETRIEVED',
        'Series venues retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to retrieve series venues',
        'GET_VENUES_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeVenueFromSeries(
    seriesId: string,
    venueId: string,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const seriesVenue = await this.seriesVenueModel.findOneAndDelete({
        seriesId: new Types.ObjectId(seriesId),
        venueId: new Types.ObjectId(venueId),
      });

      if (!seriesVenue) {
        return this.responseService.error(
          'Venue not found in series',
          'VENUE_NOT_IN_SERIES',
          'The specified venue is not associated with this series',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        seriesVenue,
        'Venue removed from series successfully',
        'VENUE_REMOVED_FROM_SERIES',
        'Venue removed from series successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to remove venue from series',
        'REMOVE_VENUE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateSeriesVenue(
    seriesId: string,
    venueId: string,
    updateDto: UpdateSeriesVenueDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const updateData: any = {};

      if (updateDto.isActive !== undefined) {
        updateData.isActive = updateDto.isActive;
      }

      if (updateDto.priority !== undefined) {
        updateData.priority = updateDto.priority;
      }

      const seriesVenue = await this.seriesVenueModel.findOneAndUpdate(
        {
          seriesId: new Types.ObjectId(seriesId),
          venueId: new Types.ObjectId(venueId),
        },
        updateData,
        { new: true },
      );

      if (!seriesVenue) {
        return this.responseService.error(
          'Venue not found in series',
          'VENUE_NOT_IN_SERIES',
          'The specified venue is not associated with this series',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      await seriesVenue.populate('venueId', 'name city country state capacity image');

      return this.responseService.successWithSingle(
        seriesVenue,
        'Series venue updated successfully',
        'SERIES_VENUE_UPDATED',
        'Series venue updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update series venue',
        'UPDATE_VENUE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

