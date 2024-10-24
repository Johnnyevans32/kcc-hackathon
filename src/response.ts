import { get, isNil } from 'lodash';

export interface ResponseObject<T> {
  code?: number;
  message?: string;
  data?: T;
}

export class ResponseService {
  static json<T>(
    res: any,
    statusOrError: number | Error,
    message?: string,
    data?: T,
  ): void {
    const error = statusOrError instanceof Error && statusOrError;

    const status = error
      ? get(error, 'status', 400)
      : (statusOrError as number);

    const responseObj: ResponseObject<T> = {
      message: error ? message || error.message : message,
      ...(!isNil(data) && { data: data }),
    };

    if (error) {
      console.error(error.stack);
    }

    res.status(status).send(responseObj);
  }
}
