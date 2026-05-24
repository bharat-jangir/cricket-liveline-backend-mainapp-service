import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match } from '../../entities/match.entity';
import { Team } from '../../entities/team.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { UpdateMatchDto as GatewayUpdateMatchDto } from './dto/update-match.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';
import { LiveMatchService } from '../live-match/live-match.service';

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(Match.name) private matchModel: Model<Match>,
    @InjectModel(Team.name) private teamModel: Model<Team>,
    private readonly responseService: ResponseService,
    private readonly liveMatchService: LiveMatchService,
  ) { }

  async create(createMatchDto: CreateMatchDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // Check if match with same slug already exists
      const existingMatch = await this.matchModel.findOne({ slug: createMatchDto.slug });
      if (existingMatch) {
        return this.responseService.error(
          'Match with this slug already exists',
          'MATCH_SLUG_EXISTS',
          'A match with the same slug is already registered in the system',
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }

      // Convert string IDs to ObjectIds before saving
      const matchData: any = {
        ...createMatchDto,
        teamAId: new Types.ObjectId(createMatchDto.teamAId),
        teamBId: new Types.ObjectId(createMatchDto.teamBId),
        ...(createMatchDto.venueId && { venueId: new Types.ObjectId(createMatchDto.venueId) }),
        ...(createMatchDto.seriesId && { seriesId: new Types.ObjectId(createMatchDto.seriesId) }),
        ...(createMatchDto.tournamentId && { tournamentId: new Types.ObjectId(createMatchDto.tournamentId) }),
      };

      // Map officials
      if (createMatchDto.straightUmpireId || createMatchDto.legUmpireId || createMatchDto.thirdUmpireId || createMatchDto.refereeId) {
        matchData.officials = {
          ...(createMatchDto.straightUmpireId && { umpire1Id: new Types.ObjectId(createMatchDto.straightUmpireId) }),
          ...(createMatchDto.legUmpireId && { umpire2Id: new Types.ObjectId(createMatchDto.legUmpireId) }),
          ...(createMatchDto.thirdUmpireId && { thirdUmpireId: new Types.ObjectId(createMatchDto.thirdUmpireId) }),
          ...(createMatchDto.refereeId && { refereeId: new Types.ObjectId(createMatchDto.refereeId) }),
        };
      }

      const match = new this.matchModel(matchData);
      await match.save();

      // Populate related entities
      const populatePaths: any[] = [
        { path: 'teamAId', select: 'name shortName code logo' },
        { path: 'teamBId', select: 'name shortName code logo' },
        { path: 'venueId', select: 'name city country' },
      ];

      if (match.seriesId) {
        populatePaths.push({ path: 'seriesId', select: 'name shortName hasPoints' });
      }

      // Don't populate tournamentId - Tournament model may not be registered
      // if (match.tournamentId) {
      //   populatePaths.push({ path: 'tournamentId', select: 'name shortName' });
      // }

      await match.populate(populatePaths);

      return this.responseService.successWithSingle(
        match,
        'Match created successfully',
        'MATCH_CREATED',
        'Match created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      if (error.code === 11000) {
        return this.responseService.error(
          'Match with this slug already exists',
          'MATCH_SLUG_EXISTS',
          'Duplicate key error: ' + error.message,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }
      return this.responseService.error(
        'Failed to create match',
        'MATCH_CREATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(queryDto: QueryMatchesDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const {
        search,
        seriesId,
        tournamentId,
        teamId,
        venueId,
        status,
        matchFormat,
        matchType,
        page = 1,
        limit = 10,
        cursor,
        direction
      } = queryDto;
      const skip = (page - 1) * limit;


      // Build search filter
      const filter: any = {};
      const andConditions: any[] = [];

      if (search) {
        andConditions.push({
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { shortTitle: { $regex: search, $options: 'i' } },
            { matchNumber: { $regex: search, $options: 'i' } },
            { slug: { $regex: search, $options: 'i' } },
          ],
        });
      }

      if (seriesId) {
        // Handle both ObjectId and string formats for existing data
        const seriesObjectId = Types.ObjectId.isValid(seriesId) ? new Types.ObjectId(seriesId) : null;
        andConditions.push({
          $or: [
            ...(seriesObjectId ? [{ seriesId: seriesObjectId }] : []),
            { seriesId: seriesId }, // Check as string for backward compatibility
          ],
        });
      }

      if (tournamentId) {
        const tournamentObjectId = Types.ObjectId.isValid(tournamentId) ? new Types.ObjectId(tournamentId) : null;
        andConditions.push({
          $or: [
            ...(tournamentObjectId ? [{ tournamentId: tournamentObjectId }] : []),
            { tournamentId: tournamentId },
          ],
        });
      }

      if (teamId) {
        const teamObjectId = Types.ObjectId.isValid(teamId) ? new Types.ObjectId(teamId) : null;
        andConditions.push({
          $or: [
            ...(teamObjectId ? [{ teamAId: teamObjectId }, { teamBId: teamObjectId }] : []),
            { teamAId: teamId },
            { teamBId: teamId },
          ],
        });
      }

      if (venueId) {
        const venueObjectId = Types.ObjectId.isValid(venueId) ? new Types.ObjectId(venueId) : null;
        andConditions.push({
          $or: [
            ...(venueObjectId ? [{ venueId: venueObjectId }] : []),
            { venueId: venueId },
          ],
        });
      }

      if (cursor && direction) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          if (direction === 'future') {
            andConditions.push({ matchDate: { $gte: cursorDate } });
          } else if (direction === 'past') {
            andConditions.push({ matchDate: { $lt: cursorDate } });
          }
        }
      }



      // Combine $or conditions with $and if needed
      if (andConditions.length > 0) {
        filter.$and = andConditions;
      }

      if (status) {
        filter.status = status;
      }

      if (matchFormat) {
        filter.matchFormat = matchFormat;
      }

      if (matchType) {
        filter.matchType = matchType;
      }

      const matchQuery = this.matchModel
        .find(filter)
        .populate('teamAId', 'name shortName code logo')
        .populate('teamBId', 'name shortName code logo')
        .populate('venueId', 'name city country')
        .populate('seriesId', 'name shortName hasPoints'); // Always populate seriesId if it exists

      // Don't populate tournamentId - Tournament model may not be registered
      // if (tournamentId) {
      //   matchQuery.populate('tournamentId', 'name shortName');
      // }

      let sortQuery: any = { matchDate: -1 };
      if (direction === 'future') {
        sortQuery = { matchDate: 1 };
      } else if (direction === 'past') {
        sortQuery = { matchDate: -1 };
      }

      const [matchesList, total] = await Promise.all([
        matchQuery.sort(sortQuery).skip(skip).limit(limit).lean(),
        this.matchModel.countDocuments(filter),
      ]);


      const matches = matchesList as any[];

      // Fetch live scores in batch
      try {
        const matchIds = matches.map(m => m._id.toString());
        if (matchIds.length > 0) {
          const liveScores = await this.liveMatchService.getBatchLiveScores(matchIds);

          // Merge scores into match objects
          matches.forEach(match => {
            if (liveScores[match._id.toString()]) {
              // In backend we can attach this to a new field 'liveScore' or similar
              // Frontend expects this in 'liveScore' or we can add it to 'toss' or 'result' temporarily?
              // Better to add a dedicated 'liveStatus' field that frontend can use
              match.liveStatus = liveScores[match._id.toString()];
            }
          });
        }
      } catch (err) {
        console.error('Error fetching batch live scores:', err);
        // Continue without scores if failed
      }


      return this.responseService.successWithPagination(
        matches,
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        'Matches retrieved successfully',
        'MATCHES_RETRIEVED',
        'Matches retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch matches',
        'MATCHES_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const matchDoc = await this.matchModel
        .findById(id)
        .populate('teamAId', 'name shortName code logo')
        .populate('teamBId', 'name shortName code logo')
        .populate('venueId', 'name city country')
        .populate('officials.umpire1Id', 'name')
        .populate('officials.umpire2Id', 'name')
        .populate('officials.thirdUmpireId', 'name')
        .populate('officials.refereeId', 'name')
        .populate('toss.winnerId', 'name shortName code logo')
        .populate('seriesId', 'name shortName hasPoints');

      if (!matchDoc) {
        return this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          `Match with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Convert to plain object
      let match = (matchDoc.toObject ? matchDoc.toObject() : matchDoc) as any;

      // Always manually populate teams to ensure they're objects (fallback)
      // This handles cases where populate didn't work or teams are still ObjectIds
      if (match.teamAId) {
        const teamAIdString = typeof match.teamAId === 'string'
          ? match.teamAId
          : (match.teamAId as any)?._id?.toString() || String(match.teamAId);

        // If teamAId is a string or doesn't have name property, fetch it
        if (typeof match.teamAId === 'string' || !(match.teamAId as any)?.name) {
          try {
            const teamA = await this.teamModel.findById(teamAIdString).select('name shortName code logo').lean();
            if (teamA) {
              match.teamAId = teamA as any;
            }
          } catch (error) {
            console.error('Error populating teamA:', error);
          }
        }
      }

      if (match.teamBId) {
        const teamBIdString = typeof match.teamBId === 'string'
          ? match.teamBId
          : (match.teamBId as any)?._id?.toString() || String(match.teamBId);

        // If teamBId is a string or doesn't have name property, fetch it
        if (typeof match.teamBId === 'string' || !(match.teamBId as any)?.name) {
          try {
            const teamB = await this.teamModel.findById(teamBIdString).select('name shortName code logo').lean();
            if (teamB) {
              match.teamBId = teamB as any;
            }
          } catch (error) {
            console.error('Error populating teamB:', error);
          }
        }
      }

      // Only populate seriesId if it exists (don't populate tournamentId - Tournament model may not be registered)
      if (match && match.seriesId) {
        const matchWithSeries = await this.matchModel
          .findById(id)
          .populate('seriesId', 'name shortName hasPoints')
          .lean();
        if (matchWithSeries && matchWithSeries.seriesId) {
          // Only copy seriesId — don't overwrite already-populated teamAId/teamBId/venueId
          match.seriesId = matchWithSeries.seriesId;
        }
      }

      return this.responseService.successWithSingle(
        match,
        'Match retrieved successfully',
        'MATCH_RETRIEVED',
        'Match retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch match',
        'MATCH_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateMatchDto: UpdateMatchDto): Promise<IResponseWithStatusCode<any>> {
    try {
      // If slug is being updated, check for duplicates
      if (updateMatchDto && updateMatchDto.slug) {
        const existingMatch = await this.matchModel.findOne({
          slug: updateMatchDto.slug,
          _id: { $ne: id }
        });
        if (existingMatch) {
          return this.responseService.error(
            'Match with this slug already exists',
            'MATCH_SLUG_EXISTS',
            'A different match with the same slug is already registered',
            undefined,
            null,
            HttpStatus.CONFLICT,
          );
        }
      }

      // Convert string IDs to ObjectIds if they exist in updateMatchDto
      const updateData: any = { ...updateMatchDto };
      if (updateMatchDto.teamAId) {
        updateData.teamAId = new Types.ObjectId(updateMatchDto.teamAId);
      }
      if (updateMatchDto.teamBId) {
        updateData.teamBId = new Types.ObjectId(updateMatchDto.teamBId);
      }
      if (updateMatchDto.venueId) {
        // updateData.venueId = new Types.ObjectId(updateMatchDto.venueId);
      }
      if (updateMatchDto.seriesId) {
        updateData.seriesId = new Types.ObjectId(updateMatchDto.seriesId);
      }
      if (updateMatchDto.tournamentId) {
        updateData.tournamentId = new Types.ObjectId(updateMatchDto.tournamentId);
      }

      // Map officials for update
      if (updateMatchDto.straightUmpireId || updateMatchDto.legUmpireId || updateMatchDto.thirdUmpireId || updateMatchDto.refereeId) {
        // We need to be careful not to overwrite existing officials if only one is updated
        // But $set works on dot notation. 
        // For now, let's construct the update object using dot notation
        if (updateMatchDto.straightUmpireId) updateData['officials.umpire1Id'] = new Types.ObjectId(updateMatchDto.straightUmpireId);
        if (updateMatchDto.legUmpireId) updateData['officials.umpire2Id'] = new Types.ObjectId(updateMatchDto.legUmpireId);
        if (updateMatchDto.thirdUmpireId) updateData['officials.thirdUmpireId'] = new Types.ObjectId(updateMatchDto.thirdUmpireId);
        if (updateMatchDto.refereeId) updateData['officials.refereeId'] = new Types.ObjectId(updateMatchDto.refereeId);

        // Remove old top-level fields from updateData to prevent errors if they are not in schema (which they aren't now)
        delete updateData.straightUmpireId;
        delete updateData.legUmpireId;
        delete updateData.thirdUmpireId;
        delete updateData.refereeId;
      }

      const match = await this.matchModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      if (!match) {
        return this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          `Match with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      // Populate related entities
      const populatePaths: any[] = [
        { path: 'teamAId', select: 'name shortName code logo' },
        { path: 'teamBId', select: 'name shortName code logo' },
        { path: 'venueId', select: 'name city country' },
      ];

      if (match.seriesId) {
        populatePaths.push({ path: 'seriesId', select: 'name shortName hasPoints' });
      }

      // Don't populate tournamentId - Tournament model may not be registered
      // if (match.tournamentId) {
      //   populatePaths.push({ path: 'tournamentId', select: 'name shortName' });
      // }

      await match.populate(populatePaths);

      return this.responseService.successWithSingle(
        match,
        'Match updated successfully',
        'MATCH_UPDATED',
        'Match updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      if (error.code === 11000) {
        return this.responseService.error(
          'Match with this slug already exists',
          'MATCH_SLUG_EXISTS',
          'Duplicate key error: ' + error.message,
          undefined,
          null,
          HttpStatus.CONFLICT,
        );
      }
      return this.responseService.error(
        'Failed to update match',
        'MATCH_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const match = await this.matchModel.findByIdAndDelete(id);

      if (!match) {
        return this.responseService.error(
          'Match not found',
          'MATCH_NOT_FOUND',
          `Match with ID ${id} not found`,
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        match,
        'Match deleted successfully',
        'MATCH_DELETED',
        'Match deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete match',
        'MATCH_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

