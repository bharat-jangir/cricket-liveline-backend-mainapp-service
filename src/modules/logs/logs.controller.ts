import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LogsService } from './logs.service';

@Controller()
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @MessagePattern('logs.createInitial')
  async createInitial(@Payload() logData: any) {
    return this.logsService.createInitialLog(logData);
  }

  @MessagePattern('logs.update')
  async update(@Payload() data: { logoId: string; logData: any }) {
    return this.logsService.updateLog(data.logoId, data.logData);
  }
}

