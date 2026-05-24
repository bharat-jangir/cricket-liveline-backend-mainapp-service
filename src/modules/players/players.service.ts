import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Player } from '../../entities/player.entity';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { QueryPlayersDto } from './dto/query-players.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class PlayersService {
  constructor(
    @InjectModel(Player.name) private playerModel: Model<Player>,
    private readonly responseService: ResponseService,
  ) {}

  async create(createPlayerDto: CreatePlayerDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // Check if slug already exists
      const existing = await this.playerModel.findOne({ slug: createPlayerDto.slug });
      if (existing) {
        return this.responseService.error(
          'Player with this slug already exists',
          'SLUG_EXISTS',
          'A player with this slug already exists',
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      const player = new this.playerModel(createPlayerDto);
      await player.save();

      return this.responseService.successWithSingle(
        player,
        'Player created successfully',
        'PLAYER_CREATED',
        'Player created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to create player',
        'PLAYER_CREATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(query: QueryPlayersDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const {
        search,
        country,
        role,
        battingStyle,
        teamId,
        isActive,
        isRetired,
        page = 1,
        limit = 20,
      } = query;
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { fullName: { $regex: search, $options: 'i' } },
          { slug: { $regex: search, $options: 'i' } },
        ];
      }

      if (country) {
        filter.country = country;
      }

      if (role) {
        filter.role = role;
      }

      if (battingStyle) {
        filter.battingStyle = battingStyle;
      }

      if (teamId) {
        filter.currentTeamIds = new Types.ObjectId(teamId);
      }

      if (isActive !== undefined) {
        filter.isActive = isActive;
      }

      if (isRetired !== undefined) {
        filter.isRetired = isRetired;
      }

      const [players, total] = await Promise.all([
        this.playerModel
          .find(filter)
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.playerModel.countDocuments(filter),
      ]);

      return this.responseService.successWithPagination(
        players,
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        'Players retrieved successfully',
        'PLAYERS_RETRIEVED',
        'Players retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch players',
        'PLAYERS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const player = await this.playerModel
        .findById(id)
        .populate('currentTeamIds', 'name shortName logo')
        .lean();

      if (!player) {
        return this.responseService.error(
          'Player not found',
          'PLAYER_NOT_FOUND',
          `Player with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        player,
        'Player retrieved successfully',
        'PLAYER_RETRIEVED',
        'Player retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch player',
        'PLAYER_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // If slug is being updated, check if it already exists
      if (updatePlayerDto.slug) {
        const existing = await this.playerModel.findOne({
          slug: updatePlayerDto.slug,
          _id: { $ne: id },
        });
        if (existing) {
          return this.responseService.error(
            'Player with this slug already exists',
            'SLUG_EXISTS',
            'A player with this slug already exists',
            undefined,
            null,
            HttpStatus.CONFLICT,
          );
        }
      }

      // Build the update object. For careerStats, flatten into dot-notation
      // so individual format keys are merged (not the whole object replaced).
      const { careerStats, ...rest } = updatePlayerDto as any;
      const updateOp: any = {};

      if (Object.keys(rest).length > 0) {
        updateOp.$set = { ...rest };
      }

      if (careerStats) {
        if (!updateOp.$set) updateOp.$set = {};
        // Overwrite the entire category (batting or bowling) if provided.
        // This ensures that deleted rows are removed from the database.
        for (const statType of ['batting', 'bowling']) {
          if (careerStats[statType]) {
            updateOp.$set[`careerStats.${statType}`] = careerStats[statType];
          }
        }
      }

      const player = await this.playerModel
        .findByIdAndUpdate(id, updateOp, { new: true })
        .lean();

      if (!player) {
        return this.responseService.error(
          'Player not found',
          'PLAYER_NOT_FOUND',
          `Player with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        player,
        'Player updated successfully',
        'PLAYER_UPDATED',
        'Player updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update player',
        'PLAYER_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {

    try {
      const player = await this.playerModel.findByIdAndDelete(id).lean();

      if (!player) {
        return this.responseService.error(
          'Player not found',
          'PLAYER_NOT_FOUND',
          `Player with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        player,
        'Player deleted successfully',
        'PLAYER_DELETED',
        'Player deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete player',
        'PLAYER_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

