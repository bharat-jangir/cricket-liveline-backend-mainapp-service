import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RequestLog, RequestLogDocument } from '../../entities/request-log.entity';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @InjectModel(RequestLog.name) private logModel: Model<RequestLogDocument>,
  ) {}

  async createInitialLog(logData: any): Promise<string> {
    try {
      this.logger.log(`[DB LOG] Creating initial log entry for ${logData.method} ${logData.path}`);
      const log = new this.logModel({
        method: logData.method,
        path: logData.path,
        query: logData.query,
        body: logData.body,
        params: logData.params,
        headers: logData.headers,
        ipAddress: logData.ipAddress,
        userAgent: logData.userAgent,
        userId: logData.userId,
        statusCode: 0, // Will be updated later
      });
      const savedLog = await log.save();
      const logoId = savedLog._id.toString();
      this.logger.log(`[DB LOG] Log entry created successfully with _id: ${logoId}`);
      return logoId; // Return MongoDB _id as logoId
    } catch (error: any) {
      this.logger.error(`[DB LOG ERROR] Failed to create initial log: ${error.message}`, error.stack);
      return '';
    }
  }

  async updateLog(logoId: string, logData: any): Promise<void> {
    try {
      this.logger.log(`[DB LOG] Updating log ${logoId} with status ${logData.statusCode}`);
      await this.logModel.findByIdAndUpdate(logoId, {
        statusCode: logData.statusCode,
        response: logData.response,
        responseHeaders: logData.responseHeaders,
        userMessage: logData.userMessage,
        userMessageCode: logData.userMessageCode,
        developerMessage: logData.developerMessage,
        responseTime: logData.responseTime,
        error: logData.error,
      });
      this.logger.log(`[DB LOG] Successfully updated log ${logoId}`);
    } catch (error: any) {
      // Silently fail to prevent breaking the main flow
      this.logger.error(`[DB LOG ERROR] Failed to update request log ${logoId}: ${error.message}`, error.stack);
    }
  }
}

