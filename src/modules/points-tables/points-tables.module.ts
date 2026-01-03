import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PointsTablesService } from './points-tables.service';
import { PointsTablesController } from './points-tables.controller';
import { PointsTable, PointsTableSchema } from '../../entities/points-table.entity';
import { Team, TeamSchema } from '../../entities/team.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PointsTable.name, schema: PointsTableSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
  ],
  controllers: [PointsTablesController],
  providers: [PointsTablesService, ResponseService],
  exports: [PointsTablesService],
})
export class PointsTablesModule {}

