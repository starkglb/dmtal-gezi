import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  header: string;
}

export function exportToExcel(
  columns: ExportColumn[],
  rows: Record<string, string | number | null>[],
  fileName: string
): void {
  const data = rows.map((row) => {
    const obj: Record<string, string | number> = {};
    for (const col of columns) {
      const val = row[col.key];
      obj[col.header] = val === null || val === undefined ? '' : val;
    }
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Set column widths
  worksheet['!cols'] = columns.map((col) => ({ wch: Math.max(col.header.length + 2, 15) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sayfa1');
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

export function exportToCsv(
  columns: ExportColumn[],
  rows: Record<string, string | number | null>[],
  fileName: string
): void {
  const header = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(';');
  const lines = [header];
  for (const row of rows) {
    const vals = columns.map((col) => {
      const val = row[col.key];
      const str = val === null || val === undefined ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    });
    lines.push(vals.join(';'));
  }
  // BOM for Excel Turkish char support
  const csv = '\ufeff' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ImportRow {
  [key: string]: string;
}

export async function parseImportFile(file: File): Promise<ImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<ImportRow>(worksheet, { defval: '' });
  return data;
}

// Normalize header keys to lowercase Turkish-friendly keys
export function getFieldValue(row: ImportRow, possibleKeys: string[]): string {
  for (const key of possibleKeys) {
    const lowerKey = key.toLowerCase();
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === lowerKey) {
        return String(row[rowKey] || '').trim();
      }
    }
  }
  return '';
}
