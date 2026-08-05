export interface ApiErrorBody {
  statusCode: number;
  code?: string;
  correlationId?: string;
  message: string | string[];
  timestamp: string;
  path: string;
}
