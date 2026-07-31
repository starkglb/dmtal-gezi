export function formatCurrency(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ' TL';
}

export function formatCurrencyShort(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return '-';
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return '-';
  return time;
}

export function formatTimeShort(time: string | null | undefined): string {
  if (!time) return '-';
  // Ensure 24-hour format HH:MM
  const clean = time.trim();
  if (/^\d{1,2}:\d{2}$/.test(clean)) {
    const [h, m] = clean.split(':');
    return `${h.padStart(2, '0')}.${m}`;
  }
  return clean;
}

export function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

export function toDateTimeInputValue(date: string | Date | null | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export function daysUntil(date: string | Date | null | undefined): number | null {
  if (!date) return null;
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}
