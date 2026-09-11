// Helper functions for DD/MM/YYYY date formatting and comparison

export const getCurrentDateFormatted = (): string => {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  return `${d}/${m}/${y}`;
};

export const parseDateDMY = (dateStr: string): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m, d);
};

export const isDateInRange = (dateStr: string, startDateStr?: string, endDateStr?: string): boolean => {
  if (!dateStr) return true;
  const targetDate = parseDateDMY(dateStr);
  if (!targetDate) return true;

  if (startDateStr) {
    const start = parseDateDMY(startDateStr);
    if (start && targetDate < start) return false;
  }

  if (endDateStr) {
    const end = parseDateDMY(endDateStr);
    if (end && targetDate > end) return false;
  }

  return true;
};
