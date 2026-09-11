/**
 * Utility functions to parse clipboard TSV (Tab-Separated Values) copied from Microsoft Excel / Google Sheets
 */

export interface ParsedInboundRow {
  receiptDate: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  size: string;
  unit: string;
  qtyDoc: number;
  qtyActual: number;
  note: string;
}

export interface ParsedOutboundRow {
  deliveryDate: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  size: string;
  unit: string;
  qtyBatch1: number;
  note: string;
}

/**
 * Parses raw text copied from Excel for Inbound Receipts
 * Typical Excel row columns when copied:
 * Option 1 (Full): [Ngày] [Mã PO] [Tên gốc] [Tên dịch] [Size] [ĐVT] [Số phiếu N_ct] [Thực nhận N_thực] [Ghi chú]
 * Option 2 (Minimal): [Mã PO] [Tên NVL] [Size] [N_ct] [N_thực]
 */
export function parseInboundExcelClipboard(
  rawText: string,
  defaultDate: string,
  defaultSize: string = '7',
  defaultUnit: string = 'bộ'
): ParsedInboundRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedInboundRow[] = [];

  for (const line of lines) {
    // Cells are tab-separated
    const cells = line.split('\t').map((c) => c.trim());
    if (cells.length === 0 || cells.every((c) => !c)) continue;

    // Skip header line if user accidentally copied header like "NGÀY NHẬP" or "MÃ PO"
    const firstCellLower = cells[0].toLowerCase();
    if (
      firstCellLower.includes('ngày') ||
      firstCellLower.includes('mã po') ||
      firstCellLower.includes('tên gốc') ||
      firstCellLower.includes('stt')
    ) {
      continue;
    }

    let receiptDate = defaultDate;
    let poNumber = '';
    let originalName = '';
    let vnName = '';
    let size = defaultSize;
    let unit = defaultUnit;
    let qtyDoc = 0;
    let qtyActual = 0;
    let note = '';

    if (cells.length >= 8) {
      // Full column structure:
      // 0: Ngày, 1: Mã PO, 2: Tên gốc, 3: Tên dịch, 4: Size, 5: ĐVT, 6: N_ct, 7: N_thực, 8?: Ghi chú
      receiptDate = isValidDateStr(cells[0]) ? normalizeDateStr(cells[0]) : defaultDate;
      poNumber = cells[1] || '';
      originalName = cells[2] || '';
      vnName = cells[3] || cells[2] || '';
      size = cells[4] || defaultSize;
      unit = cells[5] || defaultUnit;
      qtyDoc = parseNumberSafe(cells[6]);
      qtyActual = parseNumberSafe(cells[7]);
      note = cells[8] || '';
    } else if (cells.length >= 5) {
      // Compact structure:
      // Option: [Mã PO, Tên NVL, Size, N_ct, N_thực]
      poNumber = cells[0] || '';
      originalName = cells[1] || '';
      vnName = cells[1] || '';
      size = cells[2] || defaultSize;
      qtyDoc = parseNumberSafe(cells[3]);
      qtyActual = parseNumberSafe(cells[4]);
      if (cells.length >= 6) {
        note = cells[5];
      }
    } else if (cells.length >= 2) {
      // Minimal: [Mã PO, Tên NVL, Qty...]
      poNumber = cells[0] || '';
      originalName = cells[1] || '';
      vnName = cells[1] || '';
      if (cells.length >= 3) qtyDoc = parseNumberSafe(cells[2]);
      if (cells.length >= 4) qtyActual = parseNumberSafe(cells[3]);
      else qtyActual = qtyDoc;
    }

    // Only add if there is at least a PO number or Material name
    if (poNumber || originalName || vnName || qtyDoc > 0 || qtyActual > 0) {
      results.push({
        receiptDate,
        poNumber,
        originalName: originalName || 'Vật tư nhập kho',
        vnName: vnName || originalName || 'Vật tư nhập kho',
        size,
        unit,
        qtyDoc,
        qtyActual: qtyActual !== 0 ? qtyActual : qtyDoc,
        note,
      });
    }
  }

  return results;
}

/**
 * Parses raw text copied from Excel for Outbound Deliveries
 * Typical columns: [Ngày giao] [Mã PO] [Tên SP gốc] [Tên SP dịch] [Size] [ĐVT] [Số lượng giao đợt 1] [Ghi chú]
 */
export function parseOutboundExcelClipboard(
  rawText: string,
  defaultDate: string,
  defaultSize: string = '8',
  defaultUnit: string = 'đôi'
): ParsedOutboundRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const results: ParsedOutboundRow[] = [];

  for (const line of lines) {
    const cells = line.split('\t').map((c) => c.trim());
    if (cells.length === 0 || cells.every((c) => !c)) continue;

    const firstCellLower = cells[0].toLowerCase();
    if (
      firstCellLower.includes('ngày') ||
      firstCellLower.includes('mã po') ||
      firstCellLower.includes('tên') ||
      firstCellLower.includes('stt')
    ) {
      continue;
    }

    let deliveryDate = defaultDate;
    let poNumber = '';
    let originalName = '';
    let vnName = '';
    let size = defaultSize;
    let unit = defaultUnit;
    let qtyBatch1 = 0;
    let note = '';

    if (cells.length >= 7) {
      deliveryDate = isValidDateStr(cells[0]) ? normalizeDateStr(cells[0]) : defaultDate;
      poNumber = cells[1] || '';
      originalName = cells[2] || '';
      vnName = cells[3] || cells[2] || '';
      size = cells[4] || defaultSize;
      unit = cells[5] || defaultUnit;
      qtyBatch1 = parseNumberSafe(cells[6]);
      note = cells[7] || '';
    } else if (cells.length >= 4) {
      poNumber = cells[0] || '';
      originalName = cells[1] || 'Thành phẩm';
      vnName = cells[1] || 'Thành phẩm';
      size = cells[2] || defaultSize;
      qtyBatch1 = parseNumberSafe(cells[3]);
      if (cells.length >= 5) note = cells[4];
    } else if (cells.length >= 2) {
      poNumber = cells[0] || '';
      qtyBatch1 = parseNumberSafe(cells[1]);
      originalName = 'Thành phẩm';
      vnName = 'Thành phẩm';
    }

    if (poNumber || originalName || qtyBatch1 > 0) {
      results.push({
        deliveryDate,
        poNumber,
        originalName,
        vnName,
        size,
        unit,
        qtyBatch1,
        note,
      });
    }
  }

  return results;
}

export interface ParsedInboundMatrixRow {
  receiptDate: string;
  voucherCode: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  unit: string;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  note: string;
}

/**
 * Intelligent parser for Horizontal Size Matrix:
 * Handles:
 * 1) Copying vertical list (like Dae Woong paper bill):
 *    AS-26.015  THÂN+MÔNG+TAI...  SIZE 5  221
 *    AS-26.015  THÂN+MÔNG+TAI...  SIZE 6  221
 *    -> Automatically merges into single horizontal row with { '5': 221, '6': 221 }!
 * 2) Copying horizontal matrix from Excel:
 *    AS-26.015  THÂN+MÔNG...  PRS  [qty 4] [qty 5] [qty 6]...
 */
export function parseInboundMatrixClipboard(
  rawText: string,
  defaultDate: string,
  sizeList: string[],
  defaultUnit: string = 'PRS'
): ParsedInboundMatrixRow[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Check if first line contains size numbers like 4, 5, 6, 7, 8...
  const firstLineCells = lines[0]?.split('\t').map((c) => c.trim()) || [];
  const sizeIndices: { size: string; index: number }[] = [];

  firstLineCells.forEach((cell, idx) => {
    const cleanSize = cell.replace(/size/i, '').trim();
    if (sizeList.includes(cleanSize)) {
      sizeIndices.push({ size: cleanSize, index: idx });
    }
  });

  const matrixRowsMap = new Map<string, ParsedInboundMatrixRow>();

  if (sizeIndices.length >= 2) {
    // HORIZONTAL MATRIX FORMAT IN EXCEL
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split('\t').map((c) => c.trim());
      if (cells.length === 0 || cells.every((c) => !c)) continue;

      let receiptDate = defaultDate;
      let poNumber = '';
      let originalName = '';
      let vnName = '';
      let unit = defaultUnit;
      let voucherCode = '';

      if (isValidDateStr(cells[0])) {
        receiptDate = normalizeDateStr(cells[0]);
        poNumber = cells[1] || '';
        originalName = cells[2] || '';
        vnName = cells[3] || originalName;
      } else {
        originalName = cells[0] || '';
        vnName = cells[1] || originalName;
      }

      const sizeQuantities: Record<string, number> = {};
      let totalQty = 0;

      sizeIndices.forEach(({ size, index }) => {
        if (index < cells.length) {
          const qty = parseNumberSafe(cells[index]);
          if (qty > 0) {
            sizeQuantities[size] = qty;
            totalQty += qty;
          }
        }
      });

      if (originalName || poNumber || totalQty > 0) {
        matrixRowsMap.set(`mat-${i}`, {
          receiptDate,
          voucherCode,
          poNumber,
          originalName: originalName || 'Vật tư',
          vnName: vnName || originalName || 'Vật tư',
          unit,
          sizeQuantities,
          totalQty,
          note: '',
        });
      }
    }
  } else {
    // VERTICAL LIST FORMAT (like Dae Woong delivery bill)
    // Merge rows by material name/PO
    for (const line of lines) {
      const cells = line.split('\t').map((c) => c.trim());
      if (cells.length === 0 || cells.every((c) => !c)) continue;

      const firstLower = cells[0].toLowerCase();
      if (firstLower.includes('stt') || firstLower.includes('mã hàng') || firstLower.includes('ngày')) {
        continue;
      }

      // Check where size is: cell with "SIZE X" or matching sizeList
      let foundSize = '';
      let foundQty = 0;
      let code = '';
      let desc = '';
      let unit = defaultUnit;
      let date = defaultDate;

      // Scan cells
      cells.forEach((cell, cIdx) => {
        const cleanSize = cell.replace(/size/i, '').trim();
        if (sizeList.includes(cleanSize) && !foundSize) {
          foundSize = cleanSize;
        } else if (isValidDateStr(cell) && date === defaultDate) {
          date = normalizeDateStr(cell);
        }
      });

      // Typical paper bill: [STT] [CODE] [DESCRIPTION] [COLOR] [COLOR CODE] [SIZE] [UNIT] [CUS CODE] [REQ] [ACTUAL]
      if (cells.length >= 6) {
        // If first cell is a small number (STT like 1, 2, 3...)
        const hasStt = /^\d+$/.test(cells[0]) && parseInt(cells[0]) < 100;
        const codeIdx = hasStt ? 1 : 0;
        const descIdx = hasStt ? 2 : 1;

        code = cells[codeIdx] || '';
        desc = cells[descIdx] || code;

        // find quantity: last numeric cell
        for (let i = cells.length - 1; i >= 0; i--) {
          const n = parseNumberSafe(cells[i]);
          if (n > 0) {
            foundQty = n;
            break;
          }
        }
      } else if (cells.length >= 3) {
        code = cells[0];
        desc = cells[1] || code;
        foundQty = parseNumberSafe(cells[2]);
      }

      if (!foundSize && cells.length >= 4) {
        // try to find size
        const possibleSize = cells[3]?.replace(/size/i, '').trim();
        if (sizeList.includes(possibleSize)) foundSize = possibleSize;
      }

      if (code || desc) {
        const key = `${code}_${desc}`;
        let existing = matrixRowsMap.get(key);
        if (!existing) {
          existing = {
            receiptDate: date,
            voucherCode: '',
            poNumber: code,
            originalName: code || desc,
            vnName: desc || code,
            unit,
            sizeQuantities: {},
            totalQty: 0,
            note: '',
          };
          matrixRowsMap.set(key, existing);
        }

        if (foundSize && foundQty > 0) {
          existing.sizeQuantities[foundSize] = (existing.sizeQuantities[foundSize] || 0) + foundQty;
          existing.totalQty += foundQty;
        }
      }
    }
  }

  return Array.from(matrixRowsMap.values());
}

function parseNumberSafe(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  // Remove thousand separators, replace comma with dot
  const cleanStr = String(val).replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
}

function isValidDateStr(val: string): boolean {
  if (!val) return false;
  // Match DD/MM/YYYY or YYYY-MM-DD or DD-MM-YYYY
  return /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(val.trim());
}

function normalizeDateStr(val: string): string {
  const parts = val.trim().split(/[/-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD/MM/YYYY
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${d}/${m}/${y}`;
    } else {
      // DD/MM/YYYY or D/M/YYYY
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${d}/${m}/${y}`;
    }
  }
  return val;
}
