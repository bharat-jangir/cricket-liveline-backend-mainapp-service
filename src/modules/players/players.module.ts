import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlayersService } from './players.service';
import { PlayersController } from './players.controller';
import { Player, PlayerSchema } from '../../entities/player.entity';
import { ResponseService } from '../../common/services/response.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Player.name, schema: PlayerSchema },
    ]),
  ],
  controllers: [PlayersController],
  providers: [PlayersService, ResponseService],
  exports: [PlayersService],
})
export class PlayersModule {}

