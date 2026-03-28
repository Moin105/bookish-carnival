import type { Company } from '../../entities/company.entity';
import type { Customer } from '../../entities/customer.entity';
import type { Invoice } from '../../entities/invoice.entity';

type DocumentKind = 'invoice' | 'credit_note' | 'debit_note';

export type InvoicePdfTemplateInput = {
  kind: DocumentKind;
  titleEn: string;
  titleAr: string;
  company: Company;
  customer: Customer;
  documentNumber: string;
  issueDate: string; // YYYY-MM-DD
  orderNumber?: string;
  items: Array<{
    description: string;
    qty: number;
    price: number;
    taxableAmount: number;
    vatAmount: number;
    vatRate: number;
    lineAmount: number;
  }>;
  subtotal: number;
  vatTotal: number;
  total: number;
  logoDataUrl?: string | null;
  qrDataUrl?: string | null;
  footerRightText?: string;
  // Inline @font-face rules that embed fonts as base64.
  embeddedFontsCss?: string;
};

function escapeHtml(input: any): string {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(n: number): string {
  const x = Number(n ?? 0);
  return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Official Riyal symbol glyph (requires a font that supports it)
const RIYAL = '⃁';

export function renderZatcaInvoiceHtml(input: InvoicePdfTemplateInput): string {
  const embeddedFontsCss = input.embeddedFontsCss ?? '';
  const logoHtml = input.logoDataUrl
    ? `<img class="logo" src="${escapeHtml(input.logoDataUrl)}" alt="logo" />`
    : `<div class="logo-placeholder"></div>`;

  const qrHtml = input.qrDataUrl
    ? `
      <div class="qr">
        <img src="${escapeHtml(input.qrDataUrl)}" alt="qr" />
        <div class="qr-note">
          <div class="qr-note-en">This QR code is encoded as per ZATCA e-invoicing requirements</div>
          <div class="qr-note-ar">تم ترميز هذا الرمز وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك للفواتير الإلكترونية</div>
        </div>
      </div>
    `
    : '';

  const issueDate = escapeHtml(input.issueDate);
  const orderNumber = escapeHtml(input.orderNumber ?? '—');

  const customerVat = escapeHtml((input.customer as any)?.vatNumber ?? '—');
  const customerAddr = escapeHtml(
    [
      (input.customer as any)?.address,
      (input.customer as any)?.streetName,
      (input.customer as any)?.buildingNumber,
      (input.customer as any)?.citySubdivisionName,
      (input.customer as any)?.city,
      (input.customer as any)?.postalCode,
      (input.customer as any)?.country,
    ]
      .filter(Boolean)
      .join(', ') || '—',
  );

  const companyCountryEn = escapeHtml((input.company as any)?.country || 'Kingdom of Saudi Arabia');
  const companyCountryAr = 'المملكة العربية السعودية';

  const companyVat = escapeHtml((input.company as any)?.vatNumber ?? '');
  const companyCr = escapeHtml((input.company as any)?.commercialRegistration ?? '');

  const rightFooter = escapeHtml(input.footerRightText ?? input.documentNumber);

  const rowsHtml = input.items
    .map((it, idx) => {
      return `
        <tr>
          <td class="c-no">${idx + 1}</td>
          <td class="c-desc">
            <div class="desc-en">${escapeHtml(it.description)}</div>
          </td>
          <td class="c-num">${escapeHtml(it.qty)}</td>
          <td class="c-num">${money(it.price)}</td>
          <td class="c-num">${money(it.taxableAmount)}</td>
          <td class="c-num">
            <div>${money(it.vatAmount)}</div>
            <div class="muted">${escapeHtml(it.vatRate)}%</div>
          </td>
          <td class="c-num">${money(it.lineAmount)}</td>
        </tr>
      `;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      ${embeddedFontsCss}

      :root {
        --border: #cfd6de;
        --grid: #d7dee6;
        --text: #111827;
        --muted: #6b7280;
        --bg: #ffffff;
      }

      @page {
        size: A4;
        margin: 20mm 15mm 20mm 15mm;
      }

      html, body {
        height: 100%;
        margin: 0;
        background: var(--bg);
        color: var(--text);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        font-family: "Noto Sans Arabic", "Noto Naskh Arabic", "Amiri", Arial, sans-serif;
        font-size: 11px;
        box-sizing: border-box;
      }
      *, *::before, *::after { box-sizing: inherit; }

      /* One full page height: push footer to physical bottom */
      .page {
        position: relative;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }
      .page-body {
        flex: 1 1 auto;
      }

      .header {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: start;
        align-content: start;
        column-gap: 18px;
        margin-top: 2mm;
      }
      .header .block {
        font-size: 10px;
        line-height: 1.35;
        align-self: start;
        min-width: 0;
        margin: 0;
        padding: 0;
      }
      .header .block h1 {
        margin: 0;
        padding: 0;
        font-size: 19px;
        font-weight: 700;
        line-height: 1.2;
      }
      /* Country, VAT, CR */
      .header .block .line {
        margin: 2px 0;
        font-size: 16px;
        line-height: 1.35;
      }
      .header .block.right { text-align: right; direction: rtl; }
      /* Top-align logo with first line of left/right text (same row start) */
      .header .block.center {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        align-self: start;
        margin: -16px 0 0;
        padding: 0;
      }
      .logo {
        width: 130px;
        height: 130px;
        object-fit: contain;
        display: block;
        margin: 0;
        padding: 0;
      }
      .logo-placeholder {
        width: 130px;
        height: 130px;
        flex-shrink: 0;
      }

      .divider {
        margin: 4px 0 14px;
        border-top: 2px solid var(--grid);
      }

      .title {
        margin: 0 0 10px;
      }
      /* EN + AR on one line, gap between (saves vertical space) */
      .title.title-inline {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        column-gap: 28px;
        row-gap: 6px;
        text-align: center;
      }
      .title.title-inline .en,
      .title.title-inline .ar {
        font-size: 22px;
        font-weight: 700;
        margin: 0;
        line-height: 1.2;
      }
      .title.title-inline .ar {
        direction: rtl;
      }

      .info-box {
        border: 1px solid var(--border);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 6px;
      }
      .info-grid {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .info-grid td {
        border-bottom: 1px solid var(--border);
        padding: 6px 8px;
        vertical-align: middle;
      }
      .info-grid tr:last-child td { border-bottom: none; }

      /* Full-width rows: English | value (center) | Arabic */
      .meta-full .meta-en {
        width: 26%;
        font-weight: 600;
        text-align: left;
        background: #f9fafb;
      }
      .meta-full .meta-val {
        width: 48%;
        text-align: center;
      }
      .meta-full .meta-ar {
        width: 26%;
        font-weight: 600;
        text-align: right;
        direction: rtl;
        background: #f9fafb;
      }

      /* Split row: two halves, each EN | value | AR */
      .meta-split-wrap {
        padding: 0 !important;
        vertical-align: middle;
      }
      .meta-split-inner {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .meta-split-inner td.meta-split-half {
        width: 50%;
        border-right: 1px solid var(--border);
        padding: 6px 8px;
        vertical-align: middle;
      }
      .meta-split-inner td.meta-split-half:last-child {
        border-right: none;
      }
      .triplet {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 8px;
      }
      .triplet .meta-en {
        font-weight: 600;
        text-align: left;
        background: #f9fafb;
        padding: 4px 6px;
      }
      .triplet .meta-val {
        text-align: center;
        padding: 4px 4px;
      }
      .triplet .meta-ar {
        font-weight: 600;
        text-align: right;
        direction: rtl;
        background: #f9fafb;
        padding: 4px 6px;
      }

      .items {
        width: 100%;
        border-collapse: collapse;
        margin-top: 12px;
        border: 1px solid var(--border);
      }
      .items th, .items td {
        border-bottom: 1px solid var(--border);
        border-right: 1px solid var(--border);
        padding: 6px 7px;
        vertical-align: top;
      }
      .items th:last-child, .items td:last-child { border-right: none; }
      .items thead th {
        background: #f9fafb;
        font-size: 10px;
        font-weight: 700;
      }
      .th-bi {
        display: grid;
        gap: 1px;
      }
      .th-bi .ar { direction: rtl; text-align: right; }
      .th-bi .en { direction: ltr; text-align: left; }
      .c-no { width: 26px; text-align: center; }
      .c-desc { width: 40%; }
      .c-num { text-align: right; white-space: nowrap; }
      .muted { color: var(--muted); font-size: 9px; margin-top: 2px; }

      .bottom {
        display: grid;
        grid-template-columns: 1fr 380px;
        gap: 16px;
        margin-top: 10px;
        align-items: start;
      }

      .totals {
        width: 100%;
        font-size: 12px;
      }
      .totals .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 20px 120px;
        column-gap: 8px;
        padding: 4px 0;
        border-bottom: 0;
        align-items: center;
      }
      .totals .label {
        display: grid;
        grid-template-columns: auto auto;
        align-items: center;
        column-gap: 12px;
        white-space: nowrap;
      }
      .totals .label .en {
        direction: ltr;
        text-align: left;
        font-weight: 700;
      }
      .totals .label .ar {
        direction: rtl;
        unicode-bidi: embed;
        font-weight: 700;
        white-space: nowrap;
      }
      .totals .value {
        font-weight: 700;
        text-align: right;
        font-variant-numeric: tabular-nums;
        min-width: 120px;
      }
      .totals .currency-sign {
        font-family: "SaudiRiyal", "Noto Sans Arabic", "Noto Naskh Arabic", "Amiri", Arial, sans-serif;
        text-align: center;
        width: 20px;
        justify-self: center;
      }

      /* U+20C1 is a combining-mark type symbol in many fonts.
         Render it after a base character (dotted circle) to ensure it appears. */
      .riyal-symbol {
        font-family: "SaudiRiyal", "Symbola", "Noto Sans Symbols2", "Noto Sans Arabic", "Amiri", Arial, sans-serif;
        font-size: 1.3em;
        line-height: 1;
        white-space: nowrap;
      }
      .riyal-base {
        color: transparent; /* keep base invisible but still present for combining */
      }

      .qr img {
        width: 120px;
        height: 120px;
        object-fit: contain;
        border: 0;
      }
      .qr-note {
        margin-top: 6px;
        max-width: 260px;
        direction: ltr;
        text-align: left;
      }
      .qr-note-en,
      .qr-note-ar {
        color: var(--muted);
        font-size: 9px;
        line-height: 1.35;
        margin: 0;
        text-align: left;
      }
      .qr-note-en {
        direction: ltr;
      }
      .qr-note-ar {
        direction: rtl;
        unicode-bidi: embed;
        margin-top: 4px;
      }

      .footer {
        flex-shrink: 0;
        margin-top: auto;
        width: 100%;
        padding-top: 14px;
        padding-bottom: 0;
        font-size: 9px;
        color: var(--muted);
      }
      .footer .row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        align-items: center;
      }
      .footer .center { text-align: center; }
      .footer .right { text-align: right; }
      .footer .small {
        margin-top: 4px;
        text-align: center;
        font-size: 8.5px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="page-body">
      <div class="header">
        <div class="block left">
          <h1>${escapeHtml(input.company.name)}</h1>
          <div class="line">${companyCountryEn}</div>
          <div class="line">VAT number ${companyVat}</div>
          <div class="line">CR Number ${companyCr || '—'}</div>
        </div>
        <div class="block center">
          ${logoHtml}
        </div>
        <div class="block right">
          <h1 dir="rtl">${escapeHtml(input.company.name)}</h1>
          <div class="line">${companyCountryAr}</div>
          <div class="line" dir="rtl">رقم التسجيل الضريبي ${companyVat}</div>
          <div class="line" dir="rtl">رقم السجل التجاري ${companyCr || '—'}</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="title title-inline">
        <span class="en">${escapeHtml(input.titleEn)}</span>
        <span class="ar" dir="rtl">${escapeHtml(input.titleAr)}</span>
      </div>

      <div class="info-box">
        <table class="info-grid">
          <tr class="meta-full">
            <td class="meta-en">Customer</td>
            <td class="meta-val">${escapeHtml(input.customer.name)}</td>
            <td class="meta-ar">العميل</td>
          </tr>
          <tr class="meta-full">
            <td class="meta-en">Address</td>
            <td class="meta-val">${customerAddr}</td>
            <td class="meta-ar">العنوان</td>
          </tr>
          <tr class="meta-full">
            <td class="meta-en">VAT number</td>
            <td class="meta-val">${customerVat}</td>
            <td class="meta-ar">رقم التسجيل الضريبي</td>
          </tr>
          <tr class="meta-split">
            <td colspan="3" class="meta-split-wrap">
              <table class="meta-split-inner">
                <tr>
                  <td class="meta-split-half">
                    <div class="triplet">
                      <span class="meta-en">Invoice number</span>
                      <span class="meta-val">${escapeHtml(input.documentNumber)}</span>
                      <span class="meta-ar">رقم الفاتورة</span>
                    </div>
                  </td>
                  <td class="meta-split-half">
                    <div class="triplet">
                      <span class="meta-en">Date</span>
                      <span class="meta-val">${issueDate}</span>
                      <span class="meta-ar">التاريخ</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr class="meta-full">
            <td class="meta-en">Order number</td>
            <td class="meta-val">${orderNumber}</td>
            <td class="meta-ar">رقم أمر الشراء</td>
          </tr>
        </table>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th class="c-no">#</th>
            <th class="c-desc"><div class="th-bi"><div class="en">Description</div><div class="ar" dir="rtl">الوصف</div></div></th>
            <th class="c-num"><div class="th-bi"><div class="en">Qty</div><div class="ar" dir="rtl">الكمية</div></div></th>
            <th class="c-num"><div class="th-bi"><div class="en">Price</div><div class="ar" dir="rtl">السعر</div></div></th>
            <th class="c-num"><div class="th-bi"><div class="en">Taxable amount</div><div class="ar" dir="rtl">المبلغ الخاضع للضريبة</div></div></th>
            <th class="c-num"><div class="th-bi"><div class="en">VAT amount</div><div class="ar" dir="rtl">القيمة المضافة</div></div></th>
            <th class="c-num"><div class="th-bi"><div class="en">Line amount</div><div class="ar" dir="rtl">المجموع</div></div></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="bottom">
        <div>
          ${qrHtml}
        </div>

        <div class="totals">
          <div class="row">
            <div class="label">
              <div class="en">Subtotal</div>
              <div class="ar">المجموع الفرعي</div>
            </div>
            <div class="currency-sign"><span class="riyal-symbol"><span class="riyal-base">◌</span>${RIYAL}</span></div>
            <div class="value">${money(input.subtotal)}</div>
          </div>
          <div class="row">
            <div class="label">
              <div class="en">Total VAT</div>
              <div class="ar">إجمالي ضريبة القيمة المضافة</div>
            </div>
            <div class="currency-sign"><span class="riyal-symbol"><span class="riyal-base">◌</span>${RIYAL}</span></div>
            <div class="value">${money(input.vatTotal)}</div>
          </div>
          <div class="row">
            <div class="label">
              <div class="en">Total</div>
              <div class="ar">المجموع شامل القيمة المضافة</div>
            </div>
            <div class="currency-sign"><span class="riyal-symbol"><span class="riyal-base">◌</span>${RIYAL}</span></div>
            <div class="value">${money(input.total)}</div>
          </div>
        </div>
      </div>
      </div>

      <div class="footer">
        <div class="row">
          <div></div>
          <div class="center">${escapeHtml(input.company.name)}</div>
          <div class="right">${escapeHtml(rightFooter)}</div>
        </div>
        <div class="small">
          Electronically generated invoice (ZATCA Phase 1). No signature required for print.
          <span dir="rtl"> | فاتورة إلكترونية (مرحلة زاتكا 1). لا يتطلب توقيع للطباعة.</span>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function mapInvoiceToTemplateInput(params: {
  invoice: Invoice;
  company: Company;
  customer: Customer;
  titleEn: string;
  titleAr: string;
  qrDataUrl?: string | null;
}): InvoicePdfTemplateInput {
  const { invoice, company, customer, titleEn, titleAr, qrDataUrl } = params;
  const issue = new Date(invoice.issueDateTime);
  const issueDate = `${issue.getFullYear()}-${String(issue.getMonth() + 1).padStart(2, '0')}-${String(
    issue.getDate(),
  ).padStart(2, '0')}`;

  const items = (invoice.items ?? []).map((it: any) => {
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unitPrice ?? 0);
    const taxable = qty * price;
    const vatAmount = Number(it.vatAmount ?? 0);
    const vatRate = Number(it.vatRate ?? 0);
    const lineAmount = Number(it.lineTotal ?? taxable + vatAmount);
    return {
      description: String(it.name ?? ''),
      qty,
      price,
      taxableAmount: taxable,
      vatAmount,
      vatRate,
      lineAmount,
    };
  });

  return {
    kind: 'invoice',
    titleEn,
    titleAr,
    company,
    customer,
    documentNumber: invoice.invoiceNumber,
    issueDate,
    orderNumber: invoice.orderNumber ?? '—',
    items,
    subtotal: Number(invoice.subtotal ?? 0),
    vatTotal: Number(invoice.vatAmount ?? 0),
    total: Number(invoice.totalAmount ?? 0),
    logoDataUrl: (company as any)?.logo ?? null,
    qrDataUrl: qrDataUrl ?? (invoice as any)?.qrCode ?? null,
    footerRightText: invoice.invoiceNumber,
  };
}

