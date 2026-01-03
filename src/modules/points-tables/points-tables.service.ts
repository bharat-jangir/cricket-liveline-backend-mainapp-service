import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PointsTable } from '../../entities/points-table.entity';
import { CreatePointsTableEntryDto } from './dto/create-points-table-entry.dto';
import { UpdatePointsTableEntryDto } from './dto/update-points-table-entry.dto';
import { QueryPointsTableDto } from './dto/query-points-table.dto';
import { CreatePointsTableGroupDto } from './dto/create-points-table-group.dto';
import { BulkUpdatePointsTableDto } from './dto/bulk-update-points-table.dto';
import { ResponseService, IResponseWithStatusCode } from '../../common/services/response.service';
import { Team } from '../../entities/team.entity';

@Injectable()
export class PointsTablesService {
  constructor(
    @InjectModel(PointsTable.name) private pointsTableModel: Model<PointsTable>,
    @InjectModel(Team.name) private teamModel: Model<Team>,
    private readonly responseService: ResponseService,
  ) {}

  async create(createDto: CreatePointsTableEntryDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const entryData: any = {
        teamId: new Types.ObjectId(createDto.teamId),
        position: createDto.position,
        played: createDto.played || 0,
        won: createDto.won || 0,
        lost: createDto.lost || 0,
        tied: createDto.tied || 0,
        draw: createDto.draw || 0,
        noResult: createDto.noResult || 0,
        points: createDto.points || 0,
        netRunRate: createDto.netRunRate || 0,
        for: createDto.for || '0/0.0',
        against: createDto.against || '0/0.0',
        qualify: createDto.qualify || false,
        updateMode: createDto.updateMode || 'manual',
      };

      if (createDto.seriesId) {
        entryData.seriesId = new Types.ObjectId(createDto.seriesId);
      }
      if (createDto.tournamentId) {
        entryData.tournamentId = new Types.ObjectId(createDto.tournamentId);
      }
      if (createDto.matchFormat) {
        entryData.matchFormat = createDto.matchFormat;
      }
      if (createDto.groupName) {
        entryData.groupName = createDto.groupName;
      }
      if (createDto.teamFkey) {
        entryData.teamFkey = createDto.teamFkey;
      }

      const entry = new this.pointsTableModel(entryData);
      await entry.save();

      await entry.populate('teamId', 'name shortName code logo');

      return this.responseService.successWithSingle(
        entry,
        'Points table entry created successfully',
        'POINTS_TABLE_ENTRY_CREATED',
        'Points table entry created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to create points table entry',
        'POINTS_TABLE_ENTRY_CREATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(queryDto: QueryPointsTableDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const { seriesId, tournamentId, matchFormat, groupName, teamId, page = 1, limit = 100 } = queryDto;
      const skip = (page - 1) * limit;

      const filter: any = {};

      if (seriesId) {
        filter.seriesId = new Types.ObjectId(seriesId);
      }
      if (tournamentId) {
        filter.tournamentId = new Types.ObjectId(tournamentId);
      }
      if (matchFormat) {
        filter.matchFormat = matchFormat;
      }
      if (groupName) {
        filter.groupName = groupName;
      }
      if (teamId) {
        filter.teamId = new Types.ObjectId(teamId);
      }

      const [entries, total] = await Promise.all([
        this.pointsTableModel
          .find(filter)
          .populate('teamId', 'name shortName code logo')
          .populate('seriesId', 'name shortName')
          .sort({ matchFormat: 1, groupName: 1, position: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.pointsTableModel.countDocuments(filter),
      ]);

      return this.responseService.successWithPagination(
        entries,
        {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        'Points table entries retrieved successfully',
        'POINTS_TABLE_ENTRIES_RETRIEVED',
        'Points table entries retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch points table entries',
        'POINTS_TABLE_ENTRIES_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const entry = await this.pointsTableModel
        .findById(id)
        .populate('teamId', 'name shortName code logo')
        .populate('seriesId', 'name shortName')
        .lean();

      if (!entry) {
        return this.responseService.error(
          'Points table entry not found',
          'POINTS_TABLE_ENTRY_NOT_FOUND',
          'The requested points table entry does not exist',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        entry,
        'Points table entry retrieved successfully',
        'POINTS_TABLE_ENTRY_RETRIEVED',
        'Points table entry retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch points table entry',
        'POINTS_TABLE_ENTRY_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateDto: UpdatePointsTableEntryDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const updateData: any = {};

      if (updateDto.teamId) {
        updateData.teamId = new Types.ObjectId(updateDto.teamId);
      }
      if (updateDto.seriesId) {
        updateData.seriesId = new Types.ObjectId(updateDto.seriesId);
      }
      if (updateDto.tournamentId) {
        updateData.tournamentId = new Types.ObjectId(updateDto.tournamentId);
      }
      if (updateDto.matchFormat !== undefined) {
        updateData.matchFormat = updateDto.matchFormat;
      }
      if (updateDto.groupName !== undefined) {
        updateData.groupName = updateDto.groupName;
      }
      if (updateDto.position !== undefined) {
        updateData.position = updateDto.position;
      }
      if (updateDto.played !== undefined) {
        updateData.played = updateDto.played;
      }
      if (updateDto.won !== undefined) {
        updateData.won = updateDto.won;
      }
      if (updateDto.lost !== undefined) {
        updateData.lost = updateDto.lost;
      }
      if (updateDto.tied !== undefined) {
        updateData.tied = updateDto.tied;
      }
      if (updateDto.draw !== undefined) {
        updateData.draw = updateDto.draw;
      }
      if (updateDto.noResult !== undefined) {
        updateData.noResult = updateDto.noResult;
      }
      if (updateDto.points !== undefined) {
        updateData.points = updateDto.points;
      }
      if (updateDto.netRunRate !== undefined) {
        updateData.netRunRate = updateDto.netRunRate;
      }
      if (updateDto.for !== undefined) {
        updateData.for = updateDto.for;
      }
      if (updateDto.against !== undefined) {
        updateData.against = updateDto.against;
      }
      if (updateDto.qualify !== undefined) {
        updateData.qualify = updateDto.qualify;
      }
      if (updateDto.teamFkey !== undefined) {
        updateData.teamFkey = updateDto.teamFkey;
      }
      if (updateDto.updateMode !== undefined) {
        updateData.updateMode = updateDto.updateMode;
      }

      const entry = await this.pointsTableModel.findByIdAndUpdate(id, updateData, { new: true });

      if (!entry) {
        return this.responseService.error(
          'Points table entry not found',
          'POINTS_TABLE_ENTRY_NOT_FOUND',
          'The requested points table entry does not exist',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      await entry.populate('teamId', 'name shortName code logo');
      if (entry.seriesId) {
        await entry.populate('seriesId', 'name shortName');
      }

      return this.responseService.successWithSingle(
        entry,
        'Points table entry updated successfully',
        'POINTS_TABLE_ENTRY_UPDATED',
        'Points table entry updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update points table entry',
        'POINTS_TABLE_ENTRY_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const entry = await this.pointsTableModel.findByIdAndDelete(id);

      if (!entry) {
        return this.responseService.error(
          'Points table entry not found',
          'POINTS_TABLE_ENTRY_NOT_FOUND',
          'The requested points table entry does not exist',
          undefined,
          null,
          HttpStatus.NOT_FOUND,
        );
      }

      return this.responseService.successWithSingle(
        entry,
        'Points table entry deleted successfully',
        'POINTS_TABLE_ENTRY_DELETED',
        'Points table entry deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete points table entry',
        'POINTS_TABLE_ENTRY_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createGroup(seriesId: string, createGroupDto: CreatePointsTableGroupDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const { groupName, formats, teamIds, updateMode = 'manual' } = createGroupDto;

      // Fetch teams to get team codes
      const teams = await this.teamModel.find({ _id: { $in: teamIds.map(id => new Types.ObjectId(id)) } });

      const entries = [];
      let position = 1;

      for (const format of formats) {
        for (const teamId of teamIds) {
          const team = teams.find(t => t._id.toString() === teamId);
          
          const entryData: any = {
            seriesId: new Types.ObjectId(seriesId),
            teamId: new Types.ObjectId(teamId),
            matchFormat: format,
            groupName: groupName || undefined,
            position: position++,
            played: 0,
            won: 0,
            lost: 0,
            tied: 0,
            draw: 0,
            noResult: 0,
            points: 0,
            netRunRate: 0,
            for: '0/0.0',
            against: '0/0.0',
            qualify: false,
            updateMode,
          };

          if (team?.code) {
            entryData.teamFkey = team.code;
          }

          entries.push(entryData);
        }
        position = 1; // Reset position for each format
      }

      const createdEntries = await this.pointsTableModel.insertMany(entries);

      // Populate team data
      await this.pointsTableModel.populate(createdEntries, {
        path: 'teamId',
        select: 'name shortName code logo',
      });

      return this.responseService.successWithSingle(
        createdEntries,
        'Points table group created successfully',
        'POINTS_TABLE_GROUP_CREATED',
        'Points table group created successfully',
        undefined,
        HttpStatus.CREATED,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to create points table group',
        'POINTS_TABLE_GROUP_CREATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async bulkUpdate(seriesId: string, bulkUpdateDto: BulkUpdatePointsTableDto): Promise<IResponseWithStatusCode<any>> {
    try {
      const { entries } = bulkUpdateDto;
      const updatePromises = [];

      for (const entryUpdate of entries) {
        const updateData: any = {};

        if (entryUpdate.teamId) {
          updateData.teamId = new Types.ObjectId(entryUpdate.teamId);
        }
        if (entryUpdate.position !== undefined) {
          updateData.position = entryUpdate.position;
        }
        if (entryUpdate.played !== undefined) {
          updateData.played = entryUpdate.played;
        }
        if (entryUpdate.won !== undefined) {
          updateData.won = entryUpdate.won;
        }
        if (entryUpdate.lost !== undefined) {
          updateData.lost = entryUpdate.lost;
        }
        if (entryUpdate.tied !== undefined) {
          updateData.tied = entryUpdate.tied;
        }
        if (entryUpdate.draw !== undefined) {
          updateData.draw = entryUpdate.draw;
        }
        if (entryUpdate.noResult !== undefined) {
          updateData.noResult = entryUpdate.noResult;
        }
        if (entryUpdate.points !== undefined) {
          updateData.points = entryUpdate.points;
        }
        if (entryUpdate.netRunRate !== undefined) {
          updateData.netRunRate = entryUpdate.netRunRate;
        }
        if (entryUpdate.for !== undefined) {
          updateData.for = entryUpdate.for;
        }
        if (entryUpdate.against !== undefined) {
          updateData.against = entryUpdate.against;
        }
        if (entryUpdate.qualify !== undefined) {
          updateData.qualify = entryUpdate.qualify;
        }
        if (entryUpdate.teamFkey !== undefined) {
          updateData.teamFkey = entryUpdate.teamFkey;
        }
        if (entryUpdate.updateMode !== undefined) {
          updateData.updateMode = entryUpdate.updateMode;
        }

        // We need an _id field in the entryUpdate to identify which entry to update
        if ((entryUpdate as any)._id) {
          updatePromises.push(
            this.pointsTableModel.findByIdAndUpdate((entryUpdate as any)._id, updateData, { new: true })
          );
        }
      }

      const updatedEntries = await Promise.all(updatePromises);

      // Populate team data
      await this.pointsTableModel.populate(updatedEntries, {
        path: 'teamId',
        select: 'name shortName code logo',
      });

      return this.responseService.successWithSingle(
        updatedEntries,
        'Points table entries updated successfully',
        'POINTS_TABLE_ENTRIES_UPDATED',
        'Points table entries updated successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to update points table entries',
        'POINTS_TABLE_ENTRIES_UPDATE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getGroups(seriesId: string, matchFormat?: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const filter: any = {
        seriesId: new Types.ObjectId(seriesId),
      };

      if (matchFormat) {
        filter.matchFormat = matchFormat;
      }

      const groups = await this.pointsTableModel.distinct('groupName', filter);

      return this.responseService.successWithSingle(
        groups.filter(g => g !== null && g !== undefined),
        'Groups retrieved successfully',
        'GROUPS_RETRIEVED',
        'Groups retrieved successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to fetch groups',
        'GROUPS_FETCH_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteGroup(seriesId: string, groupName: string, matchFormat?: string): Promise<IResponseWithStatusCode<any>> {
    try {
      const filter: any = {
        seriesId: new Types.ObjectId(seriesId),
        groupName: groupName,
      };

      if (matchFormat) {
        filter.matchFormat = matchFormat;
      }

      const result = await this.pointsTableModel.deleteMany(filter);

      return this.responseService.successWithSingle(
        { deletedCount: result.deletedCount },
        'Group deleted successfully',
        'GROUP_DELETED',
        'Group deleted successfully',
        undefined,
        HttpStatus.OK,
      );
    } catch (error) {
      return this.responseService.error(
        'Failed to delete group',
        'GROUP_DELETE_FAILED',
        error.message,
        undefined,
        null,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

