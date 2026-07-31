import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { formatDateTime } from './format';

// This version of pdfmake uses async/await (not callbacks).
// getBuffer() returns a Promise<Buffer>, getBlob() returns a Promise<Blob>.
interface PdfDoc {
  getBuffer: () => Promise<Uint8Array>;
  getBlob: () => Promise<Blob>;
  download: (filename: string) => Promise<void>;
}
interface PdfMakeInstance {
  createPdf: (def: TDocumentDefinitions) => PdfDoc;
  vfs: Record<string, string>;
  fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>;
}

let pdfMakeInstance: PdfMakeInstance | null = null;

async function getPdfMake(): Promise<PdfMakeInstance> {
  if (!pdfMakeInstance) {
    // pdfmake and vfs_fonts are CommonJS; dynamic import may wrap as { default }
    const mod: any = await import('pdfmake/build/pdfmake');
    const instance: any = mod?.default ?? mod;
    if (!instance || typeof instance.createPdf !== 'function') {
      throw new Error('pdfmake modülü yüklenemedi.');
    }

    const vfsMod: any = await import('pdfmake/build/vfs_fonts');
    const vfsCandidate: any = vfsMod?.default ?? vfsMod;
    let vfs: Record<string, string> | null = null;
    if (vfsCandidate?.['Roboto-Regular.ttf']) {
      vfs = vfsCandidate;
    } else if (vfsCandidate?.pdfMake?.vfs) {
      vfs = vfsCandidate.pdfMake.vfs;
    }
    if (!vfs) {
      throw new Error('vfs_fonts yüklenemedi.');
    }

    instance.vfs = vfs;
    instance.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf',
      },
    };
    pdfMakeInstance = instance as PdfMakeInstance;
  }
  return pdfMakeInstance;
}

export interface PdfTableColumn {
  key: string;
  header: string;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfOptions {
  title: string;
  reportName: string;
  tripName?: string;
  headerText?: string;
  footerText?: string;
  columns: PdfTableColumn[];
  rows: Record<string, string | number | null>[];
  summaryCards?: { label: string; value: string }[];
  orientation?: 'portrait' | 'landscape';
  infoLines?: { label: string; value: string }[];
  fileName?: string;
}

function buildHeader(options: PdfOptions, now: string): Content {
  const headerText = options.headerText || 'GEZİYÖNET';
  const header: Content[] = [
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: headerText, style: 'appHeader' },
            { text: options.reportName, style: 'reportName' },
          ],
        },
        {
          width: 'auto',
          alignment: 'right',
          stack: [{ text: `Oluşturulma: ${now}`, style: 'metaInfo' }],
        },
      ],
    },
  ];

  if (options.tripName) {
    header.push({ text: `Gezi: ${options.tripName}`, style: 'tripName', margin: [0, 8, 0, 0] });
  }

  if (options.infoLines && options.infoLines.length > 0) {
    const infoBody = options.infoLines.map((line) => [
      { text: line.label, style: 'infoLabel' },
      { text: line.value, style: 'infoValue' },
    ]);
    header.push({
      table: { widths: ['auto', '*'], body: infoBody },
      layout: 'noBorders',
      margin: [0, 8, 0, 0],
    });
  }

  header.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1 }], margin: [0, 8, 0, 8] });
  return { stack: header };
}

function buildSummaryCards(cards: { label: string; value: string }[]): Content {
  const body: Content[][] = [];
  for (let i = 0; i < cards.length; i += 3) {
    const row: Content[] = [];
    const slice = cards.slice(i, i + 3);
    for (const card of slice) {
      row.push({
        stack: [
          { text: card.label, style: 'summaryLabel' },
          { text: card.value, style: 'summaryValue' },
        ],
        style: 'summaryCard',
      });
    }
    while (row.length < 3) row.push({ text: '' });
    body.push(row);
  }
  return { table: { widths: ['*', '*', '*'], body }, layout: 'noBorders', margin: [0, 4, 0, 8] };
}

function buildTable(options: PdfOptions): Content {
  const headerRow: Content[] = options.columns.map((col) => ({
    text: col.header,
    style: 'tableHeader',
    alignment: col.align || 'left',
  }));

  const dataRows: Content[][] = options.rows.map((row) =>
    options.columns.map((col) => {
      const raw = row[col.key];
      const text = raw === null || raw === undefined ? '' : String(raw);
      return { text, style: 'tableCell', alignment: col.align || 'left' };
    })
  );

  const tableBody: Content[][] = [headerRow, ...dataRows];
  const widths = options.columns.map((col) => col.width || 'auto');

  return {
    table: { widths, headerRows: 1, body: tableBody },
    layout: {
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      fillColor: (rowIndex: number) => (rowIndex === 0 ? '#1e40af' : rowIndex % 2 === 0 ? '#f8fafc' : null),
    },
    margin: [0, 4, 0, 0],
  };
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const pdfMake = await getPdfMake();
  const now = formatDateTime(new Date());

  const content: Content[] = [];
  content.push(buildHeader(options, now));

  if (options.summaryCards && options.summaryCards.length > 0) {
    content.push(buildSummaryCards(options.summaryCards));
  }

  if (options.rows.length === 0) {
    content.push({ text: 'Kayıt bulunamadı.', style: 'emptyState', margin: [0, 20, 0, 0] });
  } else {
    content.push(buildTable(options));
  }

  const footerText = options.footerText || 'GEZİYÖNET Okul Gezi Yönetim Sistemi';

  const docDefinition: TDocumentDefinitions = {
    content,
    pageSize: 'A4',
    pageOrientation: options.orientation || 'portrait',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#1e293b' },
    styles: {
      appHeader: { fontSize: 18, bold: true, color: '#1e40af' },
      reportName: { fontSize: 13, bold: true, color: '#334155', margin: [0, 2, 0, 0] },
      tripName: { fontSize: 11, color: '#475569' },
      metaInfo: { fontSize: 8, color: '#64748b' },
      infoLabel: { fontSize: 9, color: '#64748b', bold: true },
      infoValue: { fontSize: 9, color: '#1e293b' },
      summaryCard: { margin: [0, 0, 4, 4], fillColor: '#f1f5f9' },
      summaryLabel: { fontSize: 8, color: '#64748b', margin: [6, 4, 6, 0] },
      summaryValue: { fontSize: 12, bold: true, color: '#1e40af', margin: [6, 0, 6, 4] },
      tableHeader: { fontSize: 9, bold: true, color: '#ffffff', margin: [4, 4, 4, 4] },
      tableCell: { fontSize: 9, margin: [4, 3, 4, 3] },
      emptyState: { fontSize: 11, color: '#64748b', alignment: 'center' },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: footerText, style: { fontSize: 7, color: '#94a3b8' }, alignment: 'left', margin: [40, 0, 0, 0] },
        { text: `Sayfa ${currentPage} / ${pageCount}`, alignment: 'right', style: { fontSize: 7, color: '#94a3b8' }, margin: [0, 0, 40, 0] },
      ],
    }),
  };

  const fileName = options.fileName || `${options.reportName.replace(/\s+/g, '_')}.pdf`;

  // pdfmake's getBuffer() returns a Promise<Uint8Array> (async API, not callbacks).
  const doc = pdfMake.createPdf(docDefinition);
  const buffer = await doc.getBuffer();

  // Convert to Blob and trigger download
  const blob = new Blob([buffer as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function buildFileName(parts: string[]): string {
  const clean = parts
    .map((p) =>
      p
        .replace(/[ıİğĞüÜşŞöÖçÇ]/g, (ch) => {
          const map: Record<string, string> = {
            'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
            'ş': 's', 'Ş': 'S', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
          };
          return map[ch] || ch;
        })
        .replace(/[^a-zA-Z0-9]+/g, '_')
    )
    .filter(Boolean)
    .join('_');
  return `${clean}.pdf`;
}
