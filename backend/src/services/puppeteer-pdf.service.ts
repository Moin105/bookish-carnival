import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser } from 'puppeteer';

import { Company } from '../entities/company.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import {
  mapInvoiceToTemplateInput,
  renderZatcaInvoiceHtml,
  type InvoicePdfTemplateInput,
} from './pdf/invoice-template';

type PdfResult = { buffer: Buffer; html: string };

function toDataUrlIfBase64Png(maybeDataUrl: string | null | undefined): string | null {
  if (!maybeDataUrl) return null;
  if (maybeDataUrl.startsWith('data:image/')) return maybeDataUrl;
  return `data:image/png;base64,${maybeDataUrl}`;
}

@Injectable()
export class PuppeteerPdfService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private defaultLogoDataUrl: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Lazily launched on first use if needed.
    if (this.configService.get<string>('PDF_PUPPETEER_LAUNCH_ON_BOOT', 'true') === 'true') {
      await this.ensureBrowser();
    }
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  private resolveFontBase64(fontPath: string): string | null {
    try {
      if (!fs.existsSync(fontPath)) return null;
      const buf = fs.readFileSync(fontPath);
      return buf.toString('base64');
    } catch {
      return null;
    }
  }

  private resolveDefaultLogoDataUrl(): string | null {
    if (this.defaultLogoDataUrl !== null) return this.defaultLogoDataUrl;

    // Your recent upload was added under: backend/fonts/images/logo.png
    const candidates = [
      path.resolve(process.cwd(), 'backend', 'fonts', 'images', 'logo.png'),
      path.resolve(process.cwd(), 'backend', 'images', 'logo.png'),
      path.resolve(__dirname, '../../fonts/images/logo.png'),
      path.resolve(__dirname, '../../images/logo.png'),
    ];

    for (const p of candidates) {
      try {
        if (!fs.existsSync(p)) continue;
        const buf = fs.readFileSync(p);
        // Template expects a data URL.
        this.defaultLogoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        return this.defaultLogoDataUrl;
      } catch {
        // try next candidate
      }
    }

    this.defaultLogoDataUrl = null;
    return null;
  }

  private buildEmbeddedFontsCss(): string {
    // Embed fonts from backend/fonts (server-side) so Chromium doesn't miss glyphs.
    const dirs = [
      path.resolve(process.cwd(), 'backend', 'fonts'),
      path.resolve(process.cwd(), 'fonts'),
      path.resolve(__dirname, '../../fonts'),
    ];

    const fontFilesByDir: Array<{ dir: string; files: string[] }> = dirs
      .filter((dir) => fs.existsSync(dir))
      .map((dir) => ({
        dir,
        files: fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.ttf')),
      }));

    const pickFontPath = (matchers: string[]): string | null => {
      for (const entry of fontFilesByDir) {
        const lower = entry.files.map((n) => n.toLowerCase());
        for (const matcher of matchers) {
          const idx = lower.findIndex((n) => n.includes(matcher.toLowerCase()));
          if (idx >= 0) return path.join(entry.dir, entry.files[idx]);
        }
      }
      return null;
    };

    const families = [
      // Arabic text shaping fonts (optional; keep for stability)
      { family: 'Noto Sans Arabic', match: ['NotoSansArabic', 'Noto Sans Arabic', 'SansArabic'], weight: 400 },
      { family: 'Noto Naskh Arabic', match: ['NotoNaskhArabic', 'Noto Naskh Arabic', 'NaskhArabic'], weight: 400 },
      { family: 'Amiri', match: ['Amiri-Regular', 'Amiri'], weight: 400 },

      // Riyal / symbol fonts: these are what we need for U+20C1 "⃁"
      { family: 'SaudiRiyal', match: ['riyal', 'saudi_riyal', 'saudi-riyal', 'saudi'], weight: 400 },
      { family: 'Symbola', match: ['symbola'], weight: 400 },
      { family: 'Noto Sans Symbols2', match: ['symbols2', 'Symbols2', 'NotoSansSymbols2'], weight: 400 },
      { family: 'SaudiRiyalSymbol', match: ['riyal', 'saudi'], weight: 400 },
    ];

    const rules: string[] = [];

    for (const f of families) {
      // Find a matching font file from any known fonts dir.
      const fontPath = pickFontPath(f.match);
      if (!fontPath) continue;
      const base64 = this.resolveFontBase64(fontPath);
      if (!base64) continue;

      rules.push(`
@font-face {
  font-family: "${f.family}";
  font-style: normal;
  font-weight: ${f.weight};
  src: url(data:font/ttf;base64,${base64}) format("truetype");
}
      `.trim());
    }

    return rules.join('\n\n');
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;

    const executablePath =
      this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH') ||
      this.configService.get<string>('CHROME_EXECUTABLE_PATH') ||
      undefined;

    this.browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--font-render-hinting=medium',
        '--disable-dev-shm-usage',
      ],
    });

    return this.browser;
  }

  private async renderHtmlToPdf(html: string): Promise<PdfResult> {
    const browser = await this.ensureBrowser().catch((e) => {
      throw new ServiceUnavailableException(
        `PDF renderer failed to start: ${e?.message || 'unknown error'}`,
      );
    });

    const page = await browser.newPage();
    try {
      // Match A4 @ 96dpi so CSS 100vh / layout fills one printed page (footer at bottom).
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });
      await page.emulateMediaType('screen');

      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      });

      return { buffer: Buffer.from(pdfBytes), html };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  async generateInvoicePdf(params: {
    invoice: Invoice;
    company: Company;
    customer: Customer;
    titleEn: string;
    titleAr: string;
  }): Promise<PdfResult> {
    const embeddedFontsCss = this.buildEmbeddedFontsCss();

    const logoDataUrl =
      params.company.logo && String(params.company.logo).trim().length > 0
        ? toDataUrlIfBase64Png(params.company.logo)
        : this.resolveDefaultLogoDataUrl();

    const input: InvoicePdfTemplateInput = {
      ...mapInvoiceToTemplateInput({
        invoice: params.invoice,
        company: params.company,
        customer: params.customer,
        titleEn: params.titleEn,
        titleAr: params.titleAr,
        qrDataUrl: toDataUrlIfBase64Png((params.invoice as any)?.qrCode),
      }),
      embeddedFontsCss,
      logoDataUrl,
    };

    const html = renderZatcaInvoiceHtml(input);
    return this.renderHtmlToPdf(html);
  }

  async writePdfToPath(pdf: Buffer, outputPath: string) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await fs.promises.writeFile(outputPath, pdf);
  }
}

