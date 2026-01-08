import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    // Extract message from exception
    let userMessage = 'Internal server error';
    let userMessageCode = 'INTERNAL_ERROR';
    let developerMessage = exception.message || 'Internal server error';

    if (exceptionResponse) {
      if (typeof exceptionResponse === 'string') {
        userMessage = exceptionResponse;
        developerMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        userMessage = responseObj.userMessage || responseObj.message || userMessage;
        userMessageCode = responseObj.userMessageCode || responseObj.error || userMessageCode;
        developerMessage = responseObj.developerMessage || responseObj.message || developerMessage;
      }
    }

    // Log the error with full details
    this.logger.error(
      `[EXCEPTION] ${request.method} ${request.path} - Status: ${status}`,
    );
    this.logger.error(`Error Message: ${developerMessage}`);
    this.logger.error(`Error Stack: ${exception.stack || 'No stack trace available'}`);
    if (exception.name) {
      this.logger.error(`Error Name: ${exception.name}`);
    }
    if (exception.code) {
      this.logger.error(`Error Code: ${exception.code}`);
    }

    // Return standardized error response
    response.status(status).json({
      statusCode: status,
      status: false,
      userMessage,
      userMessageCode,
      developerMessage,
      data: null,
    });
  }
}