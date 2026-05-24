import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FantasyStats } from '../../entities/fantasy-stats.entity';
import { CreateFantasyStatsDto } from './dto/create-fantasy-stats.dto';
import { UpdateFantasyStatsDto } from './dto/update-fantasy-stats.dto';
import { QueryFantasyStatsDto } from './dto/query-fantasy-stats.dto';
import { BulkCreateFantasyStatsDto } from './dto/bulk-create-fantasy-stats.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';

@Injectable()
export class FantasyStatsService {
  private readonly logger = new Logger(FantasyStatsService.name);

  constructor(
    @InjectModel(FantasyStats.name) private fantasyStatsModel: Model<FantasyStats>,
    private readonly responseService: ResponseService,
  ) {}

  async getSeriesLeaders(seriesId: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const sId = new Types.ObjectId(seriesId);
      this.logger.debug(`Fetching leaders for seriesId: ${seriesId}`);

      const leaders = await this.fantasyStatsModel.aggregate([
        { $match: { seriesId: sId } },
        {
          $group: {
            _id: '$playerId',
            totalRuns: { $sum: '$runs' },
            totalWickets: { $sum: '$wickets' },
            totalCatches: { $sum: '$catches' },
            totalSixes: { $sum: '$sixes' },
            highestScore: { $max: '$runs' },
            bestFiguresWickets: { $max: '$wickets' },
            avgEconomy: { $avg: '$economy' },
            teamId: { $first: '$teamId' },
            role: { $first: '$role' },
          }
        },
        {
          $lookup: {
            from: 'players',
            localField: '_id',
            foreignField: '_id',
            as: 'player'
          }
        },
        { $unwind: '$player' },
        {
          $lookup: {
            from: 'teams',
            localField: 'teamId',
            foreignField: '_id',
            as: 'team'
          }
        },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } }
      ]);

      this.logger.debug(`Aggregation found ${leaders.length} leaders`);

      // Format the response into categories
      const formattedLeaders = {
        Batting: leaders
          .filter(l => l.totalRuns > 0)
          .sort((a, b) => b.totalRuns - a.totalRuns)
          .slice(0, 10)
          .map(l => ({
            id: l._id,
            title: 'Most Runs',
            player: l.player.name,
            value: l.totalRuns.toString(),
            team: l.team?.code || 'N/A',
            image: l.player.image,
            metric: 'Runs'
          })),
        Bowling: leaders
          .filter(l => l.totalWickets > 0)
          .sort((a, b) => b.totalWickets - a.totalWickets)
          .slice(0, 10)
          .map(l => ({
            id: l._id,
            title: 'Most Wickets',
            player: l.player.name,
            value: l.totalWickets.toString(),
            team: l.team?.code || 'N/A',
            image: l.player.image,
            metric: 'Wkts'
          })),
        Fielding: leaders
          .filter(l => l.totalCatches > 0)
          .sort((a, b) => b.totalCatches - a.totalCatches)
          .slice(0, 10)
          .map(l => ({
            id: l._id,
            title: 'Most Catches',
            player: l.player.name,
            value: l.totalCatches.toString(),
            team: l.team?.code || 'N/A',
            image: l.player.image,
            metric: 'Catches'
          }))
      };

      return this.responseService.successWithSingle(
        formattedLeaders,
        'Series leaders retrieved successfully',
        'LEADERS_RETRIEVED',
        'Series leaders retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error: any) {
      this.logger.error('Error in getSeriesLeaders', error.stack || error.message || error);
      return this.responseService.error(
        'Failed to retrieve series leaders',
        'GET_LEADERS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async seedSeriesStats(seriesId: string, matchId: string, teamIds: string[]): Promise<any> {
    const stats = [];
    // Just a quick helper to seed some data
    for (const teamId of teamIds) {
      // Create 5 random players' stats for this match
      for (let i = 0; i < 5; i++) {
        stats.push({
          seriesId: new Types.ObjectId(seriesId),
          matchId: new Types.ObjectId(matchId),
          playerId: new Types.ObjectId(), // This won't work perfectly as player needs to exist, but good for testing logic
          teamId: new Types.ObjectId(teamId),
          role: 'batsman',
          runs: Math.floor(Math.random() * 100),
          wickets: Math.floor(Math.random() * 5),
          points: Math.floor(Math.random() * 100),
        });
      }
    }
    return this.fantasyStatsModel.insertMany(stats);
  }

  async create(
    seriesId: string,
    createDto: CreateFantasyStatsDto,
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

      // Check if stats already exist for this player in this match
      const existing = await this.fantasyStatsModel.findOne({
        matchId: new Types.ObjectId(createDto.matchId),
        playerId: new Types.ObjectId(createDto.playerId),
      });

      if (existing) {
        return this.responseService.error(
          'Fantasy stats already exist for this player in this match',
          'FANTASY_STATS_EXISTS',
          'Use update endpoint to modify existing stats',
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      const fantasyStats = new this.fantasyStatsModel({
        seriesId: new Types.ObjectId(seriesId),
        matchId: new Types.ObjectId(createDto.matchId),
        playerId: new Types.ObjectId(createDto.playerId),
        teamId: createDto.teamId ? new Types.ObjectId(createDto.teamId) : undefined,
        role: createDto.role,
        points: createDto.points || 0,
        credits: createDto.credits || 0,
        isCaptain: createDto.isCaptain || false,
        isViceCaptain: createDto.isViceCaptain || false,
        runs: createDto.runs || 0,
        wickets: createDto.wickets || 0,
        catches: createDto.catches || 0,
        stumpings: createDto.stumpings || 0,
        fours: createDto.fours || 0,
        sixes: createDto.sixes || 0,
        maidens: createDto.maidens || 0,
        economy: createDto.economy || 0,
        isManOfTheMatch: createDto.isManOfTheMatch || false,
        isPlaying: createDto.isPlaying !== undefined ? createDto.isPlaying : true,
      });

      await fantasyStats.save();

      // Populate related data
      await fantasyStats.populate([
        { path: 'playerId', select: 'name fullName image role country' },
        { path: 'teamId', select: 'name shortName code logo' },
        { path: 'matchId', select: 'title matchNumber matchDate' },
      ]);

      return this.responseService.successWithSingle(
        fantasyStats,
        'Fantasy stats created successfully',
        'FANTASY_STATS_CREATED',
        'Fantasy stats created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error: any) {
      this.logger.error('Error in create', error.stack || error.message || error);
      if (error.code === 11000) {
        return this.responseService.error(
          'Fantasy stats already exist for this player in this match',
          'FANTASY_STATS_EXISTS',
          'Duplicate key error: ' + error.message,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }
      return this.responseService.error(
        'Failed to create fantasy stats',
        'CREATE_FANTASY_STATS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(
    seriesId: string,
    query: QueryFantasyStatsDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      const filter: any = {
        seriesId: new Types.ObjectId(seriesId),
      };

      if (query.matchId) {
        filter.matchId = new Types.ObjectId(query.matchId);
      }

      if (query.playerId) {
        filter.playerId = new Types.ObjectId(query.playerId);
      }

      if (query.teamId) {
        filter.teamId = new Types.ObjectId(query.teamId);
      }

      if (query.role) {
        filter.role = query.role;
      }

      const page = query.page || 1;
      const limit = query.limit || 100;
      const skip = (page - 1) * limit;

      let stats = await this.fantasyStatsModel
        .find(filter)
        .populate('playerId', 'name fullName image role country')
        .populate('teamId', 'name shortName code logo')
        .populate('matchId', 'title matchNumber matchDate matchTime')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Apply search filter if provided
      if (query.search) {
        const searchLower = query.search.toLowerCase();
        stats = stats.filter((stat: any) => {
          const player = stat.playerId;
          if (typeof player === 'object' && player !== null) {
            return (
              player.name?.toLowerCase().includes(searchLower) ||
              player.fullName?.toLowerCase().includes(searchLower)
            );
          }
          return false;
        });
      }

      const total = await this.fantasyStatsModel.countDocuments(filter);
      const totalPages = Math.ceil(total / limit);

      return this.responseService.successWithPagination(
        stats,
        {
          total,
          page,
          limit,
          totalPages,
        },
        'Fantasy stats retrieved successfully',
        'FANTASY_STATS_RETRIEVED',
        'Fantasy stats retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error: any) {
      this.logger.error('Error in findAll', error.stack || error.message || error);
      return this.responseService.error(
        'Failed to retrieve fantasy stats',
        'GET_FANTASY_STATS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return this.responseService.error(
          'Invalid fantasy stats ID',
          'INVALID_FANTASY_STATS_ID',
          'Fantasy stats ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const stats = await this.fantasyStatsModel
        .findById(id)
        .populate('playerId', 'name fullName image role country')
        .populate('teamId', 'name shortName code logo')
        .populate('matchId', 'title matchNumber matchDate matchTime')
        .lean();

      if (!stats) {
        return this.responseService.notFound(
          'Fantasy stats not found',
          'FANTASY_STATS_NOT_FOUND',
          'The specified fantasy stats does not exist',
          undefined,
        );
      }

      return this.responseService.successWithSingle(
        stats,
        'Fantasy stats retrieved successfully',
        'FANTASY_STATS_RETRIEVED',
        'Fantasy stats retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error: any) {
      this.logger.error('Error in findOne', error.stack || error.message || error);
      return this.responseService.error(
        'Failed to retrieve fantasy stats',
        'GET_FANTASY_STATS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    updateDto: UpdateFantasyStatsDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return this.responseService.error(
          'Invalid fantasy stats ID',
          'INVALID_FANTASY_STATS_ID',
          'Fantasy stats ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const updateData: any = {};

      if (updateDto.matchId) {
        updateData.matchId = new Types.ObjectId(updateDto.matchId);
      }
      if (updateDto.playerId) {
        updateData.playerId = new Types.ObjectId(updateDto.playerId);
      }
      if (updateDto.teamId) {
        updateData.teamId = new Types.ObjectId(updateDto.teamId);
      }
      if (updateDto.role !== undefined) {
        updateData.role = updateDto.role;
      }
      if (updateDto.points !== undefined) {
        updateData.points = updateDto.points;
      }
      if (updateDto.credits !== undefined) {
        updateData.credits = updateDto.credits;
      }
      if (updateDto.isCaptain !== undefined) {
        updateData.isCaptain = updateDto.isCaptain;
      }
      if (updateDto.isViceCaptain !== undefined) {
        updateData.isViceCaptain = updateDto.isViceCaptain;
      }
      if (updateDto.runs !== undefined) {
        updateData.runs = updateDto.runs;
      }
      if (updateDto.wickets !== undefined) {
        updateData.wickets = updateDto.wickets;
      }
      if (updateDto.catches !== undefined) {
        updateData.catches = updateDto.catches;
      }
      if (updateDto.stumpings !== undefined) {
        updateData.stumpings = updateDto.stumpings;
      }
      if (updateDto.fours !== undefined) {
        updateData.fours = updateDto.fours;
      }
      if (updateDto.sixes !== undefined) {
        updateData.sixes = updateDto.sixes;
      }
      if (updateDto.maidens !== undefined) {
        updateData.maidens = updateDto.maidens;
      }
      if (updateDto.economy !== undefined) {
        updateData.economy = updateDto.economy;
      }
      if (updateDto.isManOfTheMatch !== undefined) {
        updateData.isManOfTheMatch = updateDto.isManOfTheMatch;
      }
      if (updateDto.isPlaying !== undefined) {
        updateData.isPlaying = updateDto.isPlaying;
      }

      const stats = await this.fantasyStatsModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true },
      );

      if (!stats) {
        return this.responseService.notFound(
          'Fantasy stats not found',
          'FANTASY_STATS_NOT_FOUND',
          'The specified fantasy stats does not exist',
          undefined,
        );
      }

      // Populate related data
      await stats.populate([
        { path: 'playerId', select: 'name fullName image role country' },
        { path: 'teamId', select: 'name shortName code logo' },
        { path: 'matchId', select: 'title matchNumber matchDate matchTime' },
      ]);

      return this.responseService.successWithSingle(
        stats,
        'Fantasy stats updated successfully',
        'FANTASY_STATS_UPDATED',
        'Fantasy stats updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error: any) {
      this.logger.error('Error in update', error.stack || error.message || error);
      return this.responseService.error(
        'Failed to update fantasy stats',
        'UPDATE_FANTASY_STATS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      if (!Types.ObjectId.isValid(id)) {
        return this.responseService.error(
          'Invalid fantasy stats ID',
          'INVALID_FANTASY_STATS_ID',
          'Fantasy stats ID must be a valid MongoDB ObjectId',
          undefined,
          null,
          HttpStatus.BAD_REQUEST,
        );
      }

      const stats = await this.fantasyStatsModel.findByIdAndDelete(id);

      if (!stats) {
        return this.responseService.notFound(
          'Fantasy stats not found',
          'FANTASY_STATS_NOT_FOUND',
          'The specified fantasy stats does not exist',
          undefined,
        );
      }

      return this.responseService.successWithSingle(
        stats,
        'Fantasy stats deleted successfully',
        'FANTASY_STATS_DELETED',
        'Fantasy stats deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error: any) {
      this.logger.error('Error in remove', error.stack || error.message || error);
      return this.responseService.error(
        'Failed to delete fantasy stats',
        'DELETE_FANTASY_STATS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async bulkCreate(
    seriesId: string,
    bulkDto: BulkCreateFantasyStatsDto,
  ): Promise<IResponseWithStatusCode<any>> {
    try {
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

      const statsToInsert = bulkDto.stats.map((stat) => ({
        seriesId: new Types.ObjectId(seriesId),
        matchId: new Types.ObjectId(stat.matchId),
        playerId: new Types.ObjectId(stat.playerId),
        teamId: stat.teamId ? new Types.ObjectId(stat.teamId) : undefined,
        role: stat.role,
        points: stat.points || 0,
        credits: stat.credits || 0,
        isCaptain: stat.isCaptain || false,
        isViceCaptain: stat.isViceCaptain || false,
        runs: stat.runs || 0,
        wickets: stat.wickets || 0,
        catches: stat.catches || 0,
        stumpings: stat.stumpings || 0,
        fours: stat.fours || 0,
        sixes: stat.sixes || 0,
        maidens: stat.maidens || 0,
        economy: stat.economy || 0,
        isManOfTheMatch: stat.isManOfTheMatch || false,
        isPlaying: stat.isPlaying !== undefined ? stat.isPlaying : true,
      }));

      const result = await this.fantasyStatsModel.insertMany(statsToInsert, {
        ordered: false, // Continue inserting even if some fail
      });

      return this.responseService.successWithSingle(
        { insertedCount: result.length },
        'Fantasy stats created successfully',
        'FANTASY_STATS_BULK_CREATED',
        `${result.length} fantasy stats created successfully`,
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error: any) {
      this.logger.error('Error in bulkCreate', error.stack || error.message || error);
      return this.responseService.error(
        'Failed to create fantasy stats',
        'BULK_CREATE_FANTASY_STATS_FAILED',
        error.message || 'Unknown error occurred',
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

