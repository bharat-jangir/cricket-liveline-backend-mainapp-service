import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Umpire, UmpireDocument } from '../../entities/umpire.entity';
import { CreateUmpireDto } from './dto/create-umpire.dto';
import { UpdateUmpireDto } from './dto/update-umpire.dto';
import { QueryUmpiresDto } from './dto/query-umpires.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';
import { IPaginatedData } from '../../common/interfaces/api-response.interface';

@Injectable()
export class UmpiresService {
  private readonly logger = new Logger(UmpiresService.name);

  constructor(
    @InjectModel(Umpire.name) private umpireModel: Model<UmpireDocument>,
    private responseService: ResponseService,
  ) {}

  async create(createUmpireDto: CreateUmpireDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const umpire = new this.umpireModel(createUmpireDto);
      await umpire.save();

      return this.responseService.successWithSingle(
        umpire,
        'Umpire created successfully',
        'UMPIRE_CREATED',
        'Umpire created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      this.logger.error(`Error creating umpire: ${error.message}`);
      return this.responseService.error(
        'Failed to create umpire',
        'UMPIRE_CREATE_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: QueryUmpiresDto): Promise<IResponseWithStatusCode<IPaginatedData<Umpire>>> {
    try {
      const { search, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Build search query
      const searchQuery: any = {};
      if (search) {
        searchQuery.name = { $regex: search, $options: 'i' };
      }

      // Execute queries
      const [umpires, total] = await Promise.all([
        this.umpireModel
          .find(searchQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.umpireModel.countDocuments(searchQuery).exec(),
      ]);

      const totalPages = Math.ceil(total / limit);

      return this.responseService.successWithPagination(
        umpires,
        {
          total,
          page,
          limit,
          totalPages,
        },
        'Umpires retrieved successfully',
        'UMPIRES_RETRIEVED',
        'Umpires retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Error fetching umpires: ${error.message}`);
      return this.responseService.error(
        'Failed to fetch umpires',
        'UMPIRES_FETCH_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const umpire = await this.umpireModel.findById(id).exec();

      if (!umpire) {
        return this.responseService.notFound(
          'Umpire not found',
          'UMPIRE_NOT_FOUND',
          `Umpire with ID ${id} not found`,
        );
      }

      return this.responseService.successWithSingle(
        umpire,
        'Umpire retrieved successfully',
        'UMPIRE_RETRIEVED',
        'Umpire retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Error fetching umpire: ${error.message}`);
      return this.responseService.error(
        'Failed to fetch umpire',
        'UMPIRE_FETCH_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateUmpireDto: UpdateUmpireDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const umpire = await this.umpireModel
        .findByIdAndUpdate(id, updateUmpireDto, { new: true })
        .exec();

      if (!umpire) {
        return this.responseService.notFound(
          'Umpire not found',
          'UMPIRE_NOT_FOUND',
          `Umpire with ID ${id} not found`,
        );
      }

      return this.responseService.successWithSingle(
        umpire,
        'Umpire updated successfully',
        'UMPIRE_UPDATED',
        'Umpire updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Error updating umpire: ${error.message}`);
      return this.responseService.error(
        'Failed to update umpire',
        'UMPIRE_UPDATE_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const umpire = await this.umpireModel.findByIdAndDelete(id).exec();

      if (!umpire) {
        return this.responseService.notFound(
          'Umpire not found',
          'UMPIRE_NOT_FOUND',
          `Umpire with ID ${id} not found`,
        );
      }

      return this.responseService.successWithSingle(
        { deleted: true, umpire },
        'Umpire deleted successfully',
        'UMPIRE_DELETED',
        'Umpire deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      this.logger.error(`Error deleting umpire: ${error.message}`);
      return this.responseService.error(
        'Failed to delete umpire',
        'UMPIRE_DELETE_ERROR',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

