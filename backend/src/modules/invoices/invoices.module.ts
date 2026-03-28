import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceItem } from '../../entities/invoice-item.entity';
import { InvoiceSequence } from '../../entities/invoice-sequence.entity';
import { CreditNote } from '../../entities/credit-note.entity';
import { DebitNote } from '../../entities/debit-note.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { QrCodeService } from '../../services/qr-code.service';
import { HashChainService } from '../../services/hash-chain.service';
import { InvoiceSequenceService } from '../../services/invoice-sequence.service';
import { XmlGeneratorService } from '../../services/xml-generator.service';
import { PuppeteerPdfService } from '../../services/puppeteer-pdf.service';
import { ZatcaSdkService } from '../../services/zatca-sdk.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      InvoiceSequence,
      CreditNote,
      DebitNote,
      Company,
      Customer,
      AuditLog,
    ]),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    QrCodeService,
    HashChainService,
    InvoiceSequenceService,
    XmlGeneratorService,
    PuppeteerPdfService,
    ZatcaSdkService,
    AuditLogsService,
  ],
  exports: [InvoicesService, InvoiceSequenceService],
})
export class InvoicesModule {}
