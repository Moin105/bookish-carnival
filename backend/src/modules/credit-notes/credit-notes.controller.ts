import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Res,
} from '@nestjs/common';
import { CreditNotesService } from './credit-notes.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('credit-notes')
@UseGuards(JwtAuthGuard)
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Post()
  create(@Body() dto: CreateCreditNoteDto) {
    return this.creditNotesService.create(dto);
  }

  @Get()
  findAll() {
    return this.creditNotesService.findAll();
  }

  @Get('by-invoice/:invoiceId')
  findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.creditNotesService.findByInvoiceId(invoiceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.creditNotesService.findOne(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { absolutePath, filename } =
      await this.creditNotesService.getCreditNotePdfForDownload(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(absolutePath);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string) {
    return this.creditNotesService.issue(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.creditNotesService.remove(id);
  }
}
