import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Venue, VenueDocument } from '../../entities/venue.entity';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { QueryVenueDto } from './dto/query-venue.dto';
import { IVenue } from '../../interfaces/venue.interface';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class VenuesService {
  constructor(
    @InjectModel(Venue.name) private venueModel: Model<VenueDocument>,
    private responseService: ResponseService,
  ) {}

  async create(createVenueDto: CreateVenueDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const venue = new this.venueModel({
        ...createVenueDto,
        timezone: createVenueDto.timezone || 'UTC',
        pitchType: createVenueDto.pitchType || 'balanced',
        isActive: createVenueDto.isActive !== undefined ? createVenueDto.isActive : true,
      });
      const savedVenue = await venue.save();
      // Note: logoId will be set by gateway interceptor
      return this.responseService.successWithSingle(
        this.toIVenue(savedVenue),
        'Venue created successfully',
        'VENUE_CREATED',
        'Venue created successfully',
        undefined, // logoId will be set by gateway interceptor
        HttpStatus.CREATED,
      );
    } catch (error: any) {
      return this.responseService.error(
        'Failed to create venue',
        'VENUE_CREATE_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        { result: null },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: QueryVenueDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};

      // Search by name or country
      if (query.search) {
        filter.$or = [
          { name: { $regex: query.search, $options: 'i' } },
          { country: { $regex: query.search, $options: 'i' } },
        ];
      }

      const [venues, total] = await Promise.all([
        this.venueModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
        this.venueModel.countDocuments(filter).exec(),
      ]);

      return this.responseService.successWithPagination(
        venues.map((v) => this.toIVenue(v)),
        {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        'Venues fetched successfully',
        'VENUES_FETCHED',
        'Venues retrieved successfully',
      );
    } catch (error: any) {
      return this.responseService.error(
        'Failed to fetch venues',
        'VENUES_FETCH_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        {
          result: [],
          pagination: {
            total: 0,
            page: query.page || 1,
            limit: query.limit || 10,
            totalPages: 0,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const venue = await this.venueModel.findById(id).exec();
      if (!venue) {
        return this.responseService.notFound(
          'Venue not found',
          'VENUE_NOT_FOUND',
          `Venue with ID ${id} not found`,
        );
      }
      return this.responseService.successWithSingle(
        this.toIVenue(venue),
        'Venue fetched successfully',
        'VENUE_FETCHED',
        'Venue retrieved successfully',
      );
    } catch (error: any) {
      return this.responseService.error(
        'Failed to fetch venue',
        'VENUE_FETCH_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        { result: null },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateVenueDto: UpdateVenueDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const venue = await this.venueModel.findByIdAndUpdate(
        id,
        { $set: updateVenueDto },
        { new: true, runValidators: true },
      ).exec();

      if (!venue) {
        return this.responseService.error(
          'Venue not found',
          'VENUE_NOT_FOUND',
          `Venue with ID ${id} not found`,
          undefined,
          { result: null },
        );
      }

      return this.responseService.successWithSingle(
        this.toIVenue(venue),
        'Venue updated successfully',
        'VENUE_UPDATED',
        'Venue updated successfully',
      );
    } catch (error: any) {
      return this.responseService.error(
        'Failed to update venue',
        'VENUE_UPDATE_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        { result: null },
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const venue = await this.venueModel.findByIdAndDelete(id).exec();
      if (!venue) {
        return this.responseService.notFound(
          'Venue not found',
          'VENUE_NOT_FOUND',
          `Venue with ID ${id} not found`,
        );
      }
      return this.responseService.successWithSingle(
        this.toIVenue(venue),
        'Venue deleted successfully',
        'VENUE_DELETED',
        'Venue deleted successfully',
      );
    } catch (error: any) {
      return this.responseService.error(
        'Failed to delete venue',
        'VENUE_DELETE_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        { result: null },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private toIVenue(doc: VenueDocument): IVenue {
    const obj = doc.toObject();
    return {
      _id: obj._id.toString(),
      name: obj.name,
      city: obj.city,
      state: obj.state,
      country: obj.country,
      capacity: obj.capacity,
      established: obj.established,
      yearOfFirstMatch: obj.yearOfFirstMatch,
      knownAs: obj.knownAs,
      association: obj.association,
      image: obj.image,
      timezone: obj.timezone,
      coordinates: obj.coordinates,
      pitchType: obj.pitchType as 'batting' | 'bowling' | 'balanced',
      suitedFor: obj.suitedFor as 'pace' | 'spin' | undefined,
      avgFirstInningsScore: obj.avgFirstInningsScore,
      groundSize: obj.groundSize as 'small' | 'medium' | 'large' | undefined,
      groundDimensions: obj.groundDimensions,
      pitchDescription: obj.pitchDescription,
      bio: obj.bio,
      isActive: obj.isActive,
      createdAt: obj.createdAt,
    };
  }
}

