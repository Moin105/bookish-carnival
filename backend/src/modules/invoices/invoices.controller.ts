import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Res,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Get()
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get('validate-hash-chain/:companyId')
  validateHashChain(@Param('companyId') companyId: string) {
    return this.invoicesService.validateHashChain(companyId);
  }

  @Get('zatca-sdk/available')
  isZatcaSdkAvailable() {
    return { available: this.invoicesService.isZatcaSdkAvailable() };
  }

  @Get(':id/validate-zatca')
  validateWithZatcaSdk(@Param('id') id: string) {
    return this.invoicesService.validateWithZatcaSdk(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { absolutePath, filename } = await this.invoicesService.getInvoicePdfForDownload(
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.sendFile(absolutePath);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInvoiceDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateInvoiceDto);
  }

  @Put(':id/issue')
  issue(@Param('id') id: string, @Body() issueInvoiceDto: IssueInvoiceDto) {
    return this.invoicesService.issue(id, issueInvoiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }

}
