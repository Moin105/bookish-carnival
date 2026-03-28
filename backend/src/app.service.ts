import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'ZATCA E-Invoicing API v1.0';
  }
}
