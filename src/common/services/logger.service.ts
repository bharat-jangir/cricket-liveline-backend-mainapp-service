import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RequestLog, RequestLogDocument } from '../../entities/request-log.entity';

export interface LogRequestParams {
  logoId: string;
  method: string;
  path: string;
  query?: Record<string, any>;
  body?: Record<string, any>;
  params?: Record<string, any>;
  statusCode: number;
  response?: any;
  userMessage?: string;
  userMessageCode?: string;
  developerMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  responseTime?: number;
  error?: {
    message?: string;
    stack?: string;
    code?: string;
  };
}

@Injectable()
export class LoggerService {
  constructor(
    @InjectModel(RequestLog.name) private logModel: Model<RequestLogDocument>,
  ) {}

  async logRequest(params: LogRequestParams): Promise<void> {
    try {
      const log = new this.logModel({
        logoId: params.logoId,
        method: params.method,
        path: params.path,
        query: params.query,
        body: params.body,
        params: params.params,
        statusCode: params.statusCode,
        response: params.response,
        userMessage: params.userMessage,
        userMessageCode: params.userMessageCode,
        developerMessage: params.developerMessage,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        userId: params.userId,
        responseTime: params.responseTime,
        error: params.error,
      });
      await log.save();
    } catch (error) {
      // Silently fail logging to prevent breaking the main flow
      console.error('Failed to save request log:', error);
    }
  }
}

