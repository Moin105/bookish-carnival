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
import { DebitNotesService } from './debit-notes.service';
import { CreateDebitNoteDto } from './dto/create-debit-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('debit-notes')
@UseGuards(JwtAuthGuard)
export class DebitNotesController {
  constructor(private readonly debitNotesService: DebitNotesService) {}

  @Post()
  create(@Body() dto: CreateDebitNoteDto) {
    return this.debitNotesService.create(dto);
  }

  @Get()
  findAll() {
    return this.debitNotesService.findAll();
  }

  @Get('by-invoice/:invoiceId')
  findByInvoice(@Param('invoiceId') invoiceId: string) {
    return this.debitNotesService.findByInvoiceId(invoiceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.debitNotesService.findOne(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { absolutePath, filename } =
      await this.debitNotesService.getDebitNotePdfForDownload(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(absolutePath);
  }

  @Post(':id/issue')
  issue(@Param('id') id: string) {
    return this.debitNotesService.issue(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.debitNotesService.remove(id);
  }
}
