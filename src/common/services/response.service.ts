import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  IApiResponse,
  IPaginatedData,
  ISingleData,
} from '../interfaces/api-response.interface';

export interface IResponseWithStatusCode<T> {
  response: IApiResponse<T>;
  statusCode: HttpStatus;
}

@Injectable()
export class ResponseService {
  success<T>(
    data: T,
    userMessage?: string,
    userMessageCode?: string,
    developerMessage?: string,
    logoId?: string,
    statusCode: HttpStatus = HttpStatus.OK,
  ): IResponseWithStatusCode<T> {
    return {
      response: {
        logoId: logoId, // Don't generate UUID - let interceptor set MongoDB _id
        statusCode,
        status: true,
        userMessage: userMessage || 'Operation successful',
        userMessageCode: userMessageCode || 'SUCCESS',
        developerMessage: developerMessage || 'Operation completed successfully',
        data,
      },
      statusCode,
    };
  }

  error(
    userMessage: string,
    userMessageCode: string,
    developerMessage?: string,
    logoId?: string,
    data: any = null,
    statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ): IResponseWithStatusCode<any> {
    return {
      response: {
        logoId: logoId, // Don't generate UUID - let interceptor set MongoDB _id
        statusCode,
        status: false,
        userMessage,
        userMessageCode,
        developerMessage: developerMessage || userMessage,
        data,
      },
      statusCode,
    };
  }

  successWithPagination<T>(
    result: T[],
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    },
    userMessage?: string,
    userMessageCode?: string,
    developerMessage?: string,
    logoId?: string,
    statusCode: HttpStatus = HttpStatus.OK,
  ): IResponseWithStatusCode<IPaginatedData<T>> {
    return this.success<IPaginatedData<T>>(
      {
        result,
        pagination,
      },
      userMessage,
      userMessageCode,
      developerMessage,
      logoId,
      statusCode,
    );
  }

  successWithSingle<T>(
    result: T,
    userMessage?: string,
    userMessageCode?: string,
    developerMessage?: string,
    logoId?: string,
    statusCode: HttpStatus = HttpStatus.OK,
  ): IResponseWithStatusCode<ISingleData<T>> {
    return this.success<ISingleData<T>>(
      {
        result,
      },
      userMessage,
      userMessageCode,
      developerMessage,
      logoId,
      statusCode,
    );
  }

  notFound(
    userMessage: string,
    userMessageCode: string,
    developerMessage?: string,
    logoId?: string,
  ): IResponseWithStatusCode<any> {
    return this.error(
      userMessage,
      userMessageCode,
      developerMessage,
      logoId,
      { result: null },
      HttpStatus.NOT_FOUND,
    );
  }

  badRequest(
    userMessage: string,
    userMessageCode: string,
    developerMessage?: string,
    logoId?: string,
    data: any = null,
  ): IResponseWithStatusCode<any> {
    return this.error(
      userMessage,
      userMessageCode,
      developerMessage,
      logoId,
      data,
      HttpStatus.BAD_REQUEST,
    );
  }

  serviceUnavailable(
    userMessage: string,
    userMessageCode: string,
    developerMessage?: string,
    logoId?: string,
  ): IResponseWithStatusCode<any> {
    return this.error(
      userMessage,
      userMessageCode,
      developerMessage,
      logoId,
      { result: null },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  requestTimeout(
    userMessage: string,
    userMessageCode: string,
    developerMessage?: string,
    logoId?: string,
  ): IResponseWithStatusCode<any> {
    return this.error(
      userMessage,
      userMessageCode,
      developerMessage,
      logoId,
      { result: null },
      HttpStatus.REQUEST_TIMEOUT,
    );
  }
}

