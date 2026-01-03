import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Series } from '../../entities/series.entity';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { QuerySeriesDto } from './dto/query-series.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class SeriesService {
  constructor(
    @InjectModel(Series.name) private seriesModel: Model<Series>,
    private readonly responseService: ResponseService,
  ) {}

  async create(createSeriesDto: CreateSeriesDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // Check if series with same key already exists
      const existingSeries = await this.seriesModel.findOne({ key: createSeriesDto.key });
      if (existingSeries) {
        return this.responseService.error(
          'Series with this key already exists',
          'SERIES_KEY_EXISTS',
          'A series with the same key is already registered in the system',
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      const series = new this.seriesModel(createSeriesDto);
      await series.save();

      return this.responseService.successWithSingle(
        series,
        'Series created successfully',
        'SERIES_CREATED',
        'Series created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      if (error.code === 11000) {
        return this.responseService.error(
          'Series with this key already exists',
          'SERIES_KEY_EXISTS',
          'Duplicate key error: ' + error.message,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }
      return this.responseService.error(
        'Failed to create series',
        'SERIES_CREATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: QuerySeriesDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const { 
        search, 
        seriesType,
        category,
        format,
        gender,
        status, 
        year,
        isFeatured,
        onHome,
        startDateFrom,
        startDateTo,
        endDateFrom,
        endDateTo,
        page = 1, 
        limit = 10 
      } = query;
      const skip = (page - 1) * limit;

      // Build search filter
      const filter: any = {};
      const andConditions: any[] = [];

      // Search filter using $or
      if (search) {
        andConditions.push({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { shortName: { $regex: search, $options: 'i' } },
            { fantasyName: { $regex: search, $options: 'i' } },
            { key: { $regex: search, $options: 'i' } },
          ]
        });
      }

      if (seriesType) {
        filter.seriesType = seriesType;
      }

      if (category) {
        // Handle comma-separated categories
        const categories = category.split(',').map(c => c.trim());
        if (categories.length === 1) {
          filter.category = categories[0];
        } else {
          filter.category = { $in: categories };
        }
      }

      if (gender) {
        filter.gender = gender;
      }

      if (status) {
        // Handle comma-separated statuses (e.g., "running,upcoming,scheduled")
        const statuses = status.split(',').map(s => s.trim().charAt(0).toUpperCase() + s.trim().slice(1).toLowerCase());
        if (statuses.length === 1) {
          filter.status = statuses[0];
        } else {
          filter.status = { $in: statuses };
        }
      }

      if (year) {
        filter.year = year;
      }

      if (isFeatured !== undefined) {
        filter.isFeatured = isFeatured;
      }

      if (onHome !== undefined) {
        filter.onHome = onHome;
      }

      // Filter by format (check if format is enabled)
      if (format) {
        const formats = format.split(',').map(f => f.trim().toLowerCase());
        if (formats.length === 1) {
          filter[`formats.${formats[0]}`] = true;
        } else {
          // Multiple formats: match series that have ANY of the specified formats enabled
          andConditions.push({
            $or: formats.map(f => ({ [`formats.${f}`]: true }))
          });
        }
      }

      // Date range filters
      if (startDateFrom || startDateTo) {
        filter.startDate = {};
        if (startDateFrom) filter.startDate.$gte = new Date(startDateFrom);
        if (startDateTo) filter.startDate.$lte = new Date(startDateTo);
      }

      if (endDateFrom || endDateTo) {
        filter.endDate = {};
        if (endDateFrom) filter.endDate.$gte = new Date(endDateFrom);
        if (endDateTo) filter.endDate.$lte = new Date(endDateTo);
      }

      // Combine all conditions using $and if there are nested $or conditions
      const finalFilter = andConditions.length > 0 
        ? { ...filter, $and: andConditions }
        : filter;

      const [seriesList, total] = await Promise.all([
        this.seriesModel
          .find(finalFilter)
          .sort({ startDate: -1, createdAt: -1 }) // Latest first
          .skip(skip)
          .limit(limit)
          .lean(),
        this.seriesModel.countDocuments(finalFilter),
      ]);

      return this.responseService.successWithPagination(
        seriesList,
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        'Series retrieved successfully',
        'SERIES_RETRIEVED',
        'Series retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch series',
        'SERIES_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const series = await this.seriesModel.findById(id).lean();

      if (!series) {
        return this.responseService.error(
          'Series not found',
          'SERIES_NOT_FOUND',
          `Series with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        series,
        'Series retrieved successfully',
        'SERIES_RETRIEVED',
        'Series retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch series',
        'SERIES_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateSeriesDto: UpdateSeriesDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // If key is being updated, check for duplicates
      if (updateSeriesDto.key) {
        const existingSeries = await this.seriesModel.findOne({ 
          key: updateSeriesDto.key,
          _id: { $ne: id }
        });
        if (existingSeries) {
          return this.responseService.error(
            'Series with this key already exists',
            'SERIES_KEY_EXISTS',
            'A different series with the same key is already registered',
            undefined,
            null,
            HttpStatus.CONFLICT,
          );
        }
      }

      const series = await this.seriesModel
        .findByIdAndUpdate(id, updateSeriesDto, { new: true })
        .lean();

      if (!series) {
        return this.responseService.error(
          'Series not found',
          'SERIES_NOT_FOUND',
          `Series with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        series,
        'Series updated successfully',
        'SERIES_UPDATED',
        'Series updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update series',
        'SERIES_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const series = await this.seriesModel.findByIdAndDelete(id).lean();

      if (!series) {
        return this.responseService.error(
          'Series not found',
          'SERIES_NOT_FOUND',
          `Series with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        series,
        'Series deleted successfully',
        'SERIES_DELETED',
        'Series deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete series',
        'SERIES_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

