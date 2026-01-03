export interface IApiResponse<T = any> {
  logoId?: string;
  statusCode?: number;
  status: boolean;
  userMessage?: string;
  userMessageCode?: string;
  developerMessage?: string;
  data: T;
}

export interface IPaginatedData<T = any> {
  result: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ISingleData<T = any> {
  result: T;
}

