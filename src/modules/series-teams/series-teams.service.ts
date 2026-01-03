import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SeriesTeam } from '../../entities/series-team.entity';
import { PlayerTeam } from '../../entities/player-team.entity';
import { Player } from '../../entities/player.entity';
import { Team } from '../../entities/team.entity';
import { AddTeamToSeriesDto, UpdateSquadDto, QuerySeriesTeamsDto } from './dto/series-teams.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class SeriesTeamsService {
  constructor(
    @InjectModel(SeriesTeam.name) private seriesTeamModel: Model<SeriesTeam>,
    @InjectModel(PlayerTeam.name) private playerTeamModel: Model<PlayerTeam>,
    @InjectModel(Player.name) private playerModel: Model<Player>,
    @InjectModel(Team.name) private teamModel: Model<Team>,
    private readonly responseService: ResponseService,
  ) {}

  async addTeamToSeries(
    seriesId: string,
    addTeamDto: AddTeamToSeriesDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      // Check if team already exists in this series for this format
      const existing = await this.seriesTeamModel.findOne({
        seriesId: new Types.ObjectId(seriesId),
        teamId: new Types.ObjectId(addTeamDto.teamId),
        format: addTeamDto.format,
      });

      if (existing) {
        return this.responseService.error(
          'Team already added to this series for this format',
          'TEAM_ALREADY_EXISTS',
          `Team already exists in series for ${addTeamDto.format} format`,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      // Create series team entry
      const seriesTeam = new this.seriesTeamModel({
        seriesId: new Types.ObjectId(seriesId),
        teamId: new Types.ObjectId(addTeamDto.teamId),
        format: addTeamDto.format,
        groupName: addTeamDto.groupName,
        squadPlayers: [],
      });

      // If copyFromTeamRoster is true, copy players from PlayerTeam
      if (addTeamDto.copyFromTeamRoster) {
        const teamPlayers = await this.playerTeamModel
          .find({
            teamId: new Types.ObjectId(addTeamDto.teamId),
            isActive: true,
          })
          .lean();

        seriesTeam.squadPlayers = teamPlayers.map((pt) => ({
          playerId: pt.playerId,
          isCaptain: pt.role === 'captain',
          isViceCaptain: pt.role === 'vice-captain',
          isWicketKeeper: false,
          isNotEligible: false,
          role: 'Batter', // Default, will be updated later
          jerseyNumber: pt.jerseyNumber,
        }));
      }

      await seriesTeam.save();

      // Populate team details
      const populated = await this.seriesTeamModel
        .findById(seriesTeam._id)
        .populate('teamId', 'name shortName logo code teamType')
        .populate('squadPlayers.playerId', 'name fullName image role nationality country')
        .lean();

      return this.responseService.successWithSingle(
        populated,
        'Team added to series successfully',
        'TEAM_ADDED',
        'Team added to series successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to add team to series',
        'ADD_TEAM_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSeriesTeams(
    seriesId: string,
    query: QuerySeriesTeamsDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const filter: any = {
        seriesId: new Types.ObjectId(seriesId),
        isActive: true,
      };

      if (query.format) {
        filter.format = query.format;
      }

      if (query.groupName) {
        filter.groupName = query.groupName;
      }

      const teams = await this.seriesTeamModel
        .find(filter)
        .populate('teamId', 'name shortName logo code teamType')
        .populate('squadPlayers.playerId', 'name fullName image role nationality country')
        .sort({ createdAt: 1 })
        .lean();

      return this.responseService.successWithSingle(
        teams,
        'Series teams retrieved successfully',
        'TEAMS_RETRIEVED',
        'Series teams retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to retrieve series teams',
        'GET_TEAMS_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getTeamSquad(
    seriesId: string,
    teamId: string,
    format: string,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const seriesTeam = await this.seriesTeamModel
        .findOne({
          seriesId: new Types.ObjectId(seriesId),
          teamId: new Types.ObjectId(teamId),
          format,
        })
        .populate('teamId', 'name shortName logo code teamType')
        .populate('squadPlayers.playerId', 'name fullName image role nationality country battingStyle bowlingStyle')
        .lean();

      if (!seriesTeam) {
        return this.responseService.error(
          'Team not found in this series',
          'TEAM_NOT_FOUND',
          `Team not found in series for ${format} format`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        seriesTeam,
        'Squad retrieved successfully',
        'SQUAD_RETRIEVED',
        'Squad retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to retrieve squad',
        'GET_SQUAD_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateSquad(
    seriesId: string,
    teamId: string,
    format: string,
    updateSquadDto: UpdateSquadDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      // Validate squad size (typical cricket squads are 15-18 players)
      if (updateSquadDto.squadPlayers.length > 25) {
        return this.responseService.error(
          'Squad size exceeds maximum limit',
          'SQUAD_TOO_LARGE',
          'Maximum 25 players allowed per squad',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate: No duplicate players
      const playerIds = updateSquadDto.squadPlayers.map(p => p.playerId);
      const uniquePlayerIds = new Set(playerIds);
      if (playerIds.length !== uniquePlayerIds.size) {
        return this.responseService.error(
          'Duplicate players found in squad',
          'DUPLICATE_PLAYERS',
          'Each player can only appear once in the squad',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate: Only one captain
      const captains = updateSquadDto.squadPlayers.filter(p => p.isCaptain);
      if (captains.length > 1) {
        return this.responseService.error(
          'Only one captain allowed per squad',
          'MULTIPLE_CAPTAINS',
          'Squad can have only one captain',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate: Only one vice-captain
      const viceCaptains = updateSquadDto.squadPlayers.filter(p => p.isViceCaptain);
      if (viceCaptains.length > 1) {
        return this.responseService.error(
          'Only one vice-captain allowed per squad',
          'MULTIPLE_VICE_CAPTAINS',
          'Squad can have only one vice-captain',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate: Captain cannot be not eligible
      const captainNotEligible = captains.find(c => c.isNotEligible);
      if (captainNotEligible) {
        return this.responseService.error(
          'Captain cannot be marked as not eligible',
          'CAPTAIN_NOT_ELIGIBLE',
          'Captain must be eligible to play',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const seriesTeam = await this.seriesTeamModel.findOneAndUpdate(
        {
          seriesId: new Types.ObjectId(seriesId),
          teamId: new Types.ObjectId(teamId),
          format,
        },
        {
          $set: {
            squadPlayers: updateSquadDto.squadPlayers.map(p => ({
              playerId: new Types.ObjectId(p.playerId),
              isCaptain: p.isCaptain || false,
              isViceCaptain: p.isViceCaptain || false,
              isWicketKeeper: p.isWicketKeeper || false,
              isNotEligible: p.isNotEligible || false,
              role: p.role || 'Batter',
              jerseyNumber: p.jerseyNumber,
            })),
          },
        },
        { new: true },
      )
        .populate('teamId', 'name shortName logo code teamType')
        .populate('squadPlayers.playerId', 'name fullName image role nationality country')
        .lean();

      if (!seriesTeam) {
        return this.responseService.error(
          'Team not found in this series',
          'TEAM_NOT_FOUND',
          `Team not found in series for ${format} format`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        seriesTeam,
        'Squad updated successfully',
        'SQUAD_UPDATED',
        'Squad updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update squad',
        'UPDATE_SQUAD_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async removeTeamFromSeries(
    seriesId: string,
    teamId: string,
    format: string,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const seriesTeam = await this.seriesTeamModel.findOneAndDelete({
        seriesId: new Types.ObjectId(seriesId),
        teamId: new Types.ObjectId(teamId),
        format,
      }).lean();

      if (!seriesTeam) {
        return this.responseService.error(
          'Team not found in this series',
          'TEAM_NOT_FOUND',
          `Team not found in series for ${format} format`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        seriesTeam,
        'Team removed from series successfully',
        'TEAM_REMOVED',
        'Team removed from series successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to remove team from series',
        'REMOVE_TEAM_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

