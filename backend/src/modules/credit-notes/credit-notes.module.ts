import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditNotesController } from './credit-notes.controller';
import { CreditNotesService } from './credit-notes.service';
import { CreditNote } from '../../entities/credit-note.entity';
import { CreditNoteItem } from '../../entities/credit-note-item.entity';
import { Invoice } from '../../entities/invoice.entity';
import { InvoiceSequence } from '../../entities/invoice-sequence.entity';
import { DebitNote } from '../../entities/debit-note.entity';
import { Company } from '../../entities/company.entity';
import { Customer } from '../../entities/customer.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { QrCodeService } from '../../services/qr-code.service';
import { HashChainService } from '../../services/hash-chain.service';
import { InvoiceSequenceService } from '../../services/invoice-sequence.service';
import { XmlGeneratorService } from '../../services/xml-generator.service';
import { PuppeteerPdfService } from '../../services/puppeteer-pdf.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditNote,
      CreditNoteItem,
      Invoice,
      InvoiceSequence,
      DebitNote,
      Company,
      Customer,
      AuditLog,
    ]),
  ],
  controllers: [CreditNotesController],
  providers: [
    CreditNotesService,
    QrCodeService,
    HashChainService,
    InvoiceSequenceService,
    XmlGeneratorService,
    PuppeteerPdfService,
    AuditLogsService,
  ],
  exports: [CreditNotesService],
})
export class CreditNotesModule {}
