import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team } from '../../entities/team.entity';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { QueryTeamsDto } from './dto/query-teams.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private teamModel: Model<Team>,
    private readonly responseService: ResponseService,
  ) {}

  async create(createTeamDto: CreateTeamDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // Check if team with same code already exists
      const existingTeam = await this.teamModel.findOne({ code: createTeamDto.code });
      if (existingTeam) {
        return this.responseService.error(
          'Team with this code already exists',
          'TEAM_CODE_EXISTS',
          'A team with the same code is already registered in the system',
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      const team = new this.teamModel(createTeamDto);
      await team.save();

      return this.responseService.successWithSingle(
        team,
        'Team created successfully',
        'TEAM_CREATED',
        'Team created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      if (error.code === 11000) {
        return this.responseService.error(
          'Team with this code already exists',
          'TEAM_CODE_EXISTS',
          'Duplicate key error: ' + error.message,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }
      return this.responseService.error(
        'Failed to create team',
        'TEAM_CREATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: QueryTeamsDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const { search, type, format, country, page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      // Build search filter
      const filter: any = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { shortName: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { country: { $regex: search, $options: 'i' } },
        ];
      }

      if (type) {
        filter.type = type;
      }

      if (format) {
        filter.format = format;
      }

      if (country) {
        filter.country = { $regex: country, $options: 'i' };
      }

      const [teams, total] = await Promise.all([
        this.teamModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.teamModel.countDocuments(filter),
      ]);

      return this.responseService.successWithPagination(
        teams,
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        'Teams retrieved successfully',
        'TEAMS_RETRIEVED',
        'Teams retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch teams',
        'TEAMS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const team = await this.teamModel.findById(id).lean();

      if (!team) {
        return this.responseService.error(
          'Team not found',
          'TEAM_NOT_FOUND',
          `Team with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        team,
        'Team retrieved successfully',
        'TEAM_RETRIEVED',
        'Team retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch team',
        'TEAM_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateTeamDto: UpdateTeamDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // If code is being updated, check for duplicates
      if (updateTeamDto.code) {
        const existingTeam = await this.teamModel.findOne({ 
          code: updateTeamDto.code,
          _id: { $ne: id }
        });
        if (existingTeam) {
          return this.responseService.error(
            'Team with this code already exists',
            'TEAM_CODE_EXISTS',
            'A different team with the same code is already registered',
            undefined,
            null,
            HttpStatus.CONFLICT,
          );
        }
      }

      const team = await this.teamModel
        .findByIdAndUpdate(id, updateTeamDto, { new: true })
        .lean();

      if (!team) {
        return this.responseService.error(
          'Team not found',
          'TEAM_NOT_FOUND',
          `Team with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        team,
        'Team updated successfully',
        'TEAM_UPDATED',
        'Team updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update team',
        'TEAM_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const team = await this.teamModel.findByIdAndDelete(id).lean();

      if (!team) {
        return this.responseService.error(
          'Team not found',
          'TEAM_NOT_FOUND',
          `Team with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        team,
        'Team deleted successfully',
        'TEAM_DELETED',
        'Team deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete team',
        'TEAM_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

