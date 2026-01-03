import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PointsTablesService } from './points-tables.service';
import { CreatePointsTableEntryDto } from './dto/create-points-table-entry.dto';
import { UpdatePointsTableEntryDto } from './dto/update-points-table-entry.dto';
import { QueryPointsTableDto } from './dto/query-points-table.dto';
import { CreatePointsTableGroupDto } from './dto/create-points-table-group.dto';
import { BulkUpdatePointsTableDto } from './dto/bulk-update-points-table.dto';

@Controller()
export class PointsTablesController {
  constructor(private readonly pointsTablesService: PointsTablesService) {}

  @MessagePattern('points-tables.create')
  async create(@Payload() createDto: CreatePointsTableEntryDto) {
    const result = await this.pointsTablesService.create(createDto);
    return result.response;
  }

  @MessagePattern('points-tables.findAll')
  async findAll(@Payload() query: QueryPointsTableDto) {
    const result = await this.pointsTablesService.findAll(query);
    return result.response;
  }

  @MessagePattern('points-tables.findOne')
  async findOne(@Payload() id: string) {
    const result = await this.pointsTablesService.findOne(id);
    return result.response;
  }

  @MessagePattern('points-tables.update')
  async update(@Payload() payload: { id: string; updateDto: UpdatePointsTableEntryDto }) {
    const result = await this.pointsTablesService.update(payload.id, payload.updateDto);
    return result.response;
  }

  @MessagePattern('points-tables.remove')
  async remove(@Payload() id: string) {
    const result = await this.pointsTablesService.remove(id);
    return result.response;
  }

  @MessagePattern('points-tables.createGroup')
  async createGroup(@Payload() payload: { seriesId: string; createGroupDto: CreatePointsTableGroupDto }) {
    const result = await this.pointsTablesService.createGroup(payload.seriesId, payload.createGroupDto);
    return result.response;
  }

  @MessagePattern('points-tables.bulkUpdate')
  async bulkUpdate(@Payload() payload: { seriesId: string; bulkUpdateDto: BulkUpdatePointsTableDto }) {
    const result = await this.pointsTablesService.bulkUpdate(payload.seriesId, payload.bulkUpdateDto);
    return result.response;
  }

  @MessagePattern('points-tables.getGroups')
  async getGroups(@Payload() payload: { seriesId: string; matchFormat?: string }) {
    const result = await this.pointsTablesService.getGroups(payload.seriesId, payload.matchFormat);
    return result.response;
  }

  @MessagePattern('points-tables.deleteGroup')
  async deleteGroup(@Payload() payload: { seriesId: string; groupName: string; matchFormat?: string }) {
    const result = await this.pointsTablesService.deleteGroup(payload.seriesId, payload.groupName, payload.matchFormat);
    return result.response;
  }
}

