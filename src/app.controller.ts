import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { AppService } from './app.service';
import { ResponseService } from './response';
import { AxiosError } from 'axios';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/kcc')
  async fetchKccCredentials(
    @Res() res: Response,
    @Query('subjectDid') subjectDid: string,
  ) {
    try {
      const data = await this.appService.fetchVcJwtRecords(subjectDid);

      return ResponseService.json(res, HttpStatus.OK, 'successful', data);
    } catch (error) {
      let errorMessage: string;
      const statusCode = error.statusCode || HttpStatus.BAD_REQUEST;

      if (error.isAxiosError) {
        const { response, message, code } = error as AxiosError;
        errorMessage =
          (response?.data as any)?.message || message || 'Something went wrong';
        console.error(`Axios error occurred: ${errorMessage} (${code})`);
      } else {
        errorMessage = error.message || 'Something went wrong';
        console.error(`An error occurred: ${error.message}`, error.stack);
      }

      return ResponseService.json(res, statusCode, errorMessage, undefined);
    }
  }

  @Get('/kcc/issue')
  async issueKccCredential(
    @Res() res: Response,
    @Query('subjectDid') subjectDid: string,
  ) {
    try {
      const data = await this.appService.issueKccCredential(subjectDid);

      return ResponseService.json(res, HttpStatus.OK, 'successful', data);
    } catch (error) {
      let errorMessage: string;
      const statusCode = error.statusCode || HttpStatus.BAD_REQUEST;

      if (error.isAxiosError) {
        const { response, message, code } = error as AxiosError;
        errorMessage =
          (response?.data as any)?.message || message || 'Something went wrong';
        console.error(`Axios error occurred: ${errorMessage} (${code})`);
      } else {
        errorMessage = error.message || 'Something went wrong';
        console.error(`An error occurred: ${error.message}`, error.stack);
      }

      return ResponseService.json(res, statusCode, errorMessage, undefined);
    }
  }
}
