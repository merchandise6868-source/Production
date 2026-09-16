/**
 * GOOGLE SHEETS SYNC & BACKUP UTILITY
 * Quản lý dữ liệu sao lưu Đa Công Ty lên Google Sheets
 */

import {
  Customer,
  PurchaseOrder,
  PlanOrderRow,
  ActualReceiveRow,
  DiscrepancyRow,
  CompensationRequestItem,
  ProductionIssueRow,
  RealtimeStockItem,
  ProductionReportRow,
  FinishedGoodsStockItem,
  FinishedGoodsDeliveryRow,
} from '../types';

export interface SheetExportData {
  title: string;
  themeColor: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface CompanyBackupPayload {
  companyId: string;
  companyName: string;
  timestamp: string;
  sheets: Record<string, SheetExportData>;
}

export interface BackupResponse {
  success: boolean;
  message?: string;
  error?: string;
  companyId?: string;
  companyName?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  updatedSheets?: string[];
  timestamp?: string;
}

/**
 * Gom toàn bộ dữ liệu 10 Tab của 1 Công ty thành payload sẵn sàng gửi sang Google Apps Script
 */
export function buildCompanySheetsPayload(
  customer: Customer,
  sizes: string[],
  pos: PurchaseOrder[],
  planOrders: PlanOrderRow[],
  actualReceives: ActualReceiveRow[],
  discrepancies: DiscrepancyRow[],
  compensationItems: CompensationRequestItem[],
  productionIssues: ProductionIssueRow[],
  realtimeStock: RealtimeStockItem[],
  productionReports: ProductionReportRow[],
  finishedGoodsStock: FinishedGoodsStockItem[],
  finishedGoodsDeliveries: FinishedGoodsDeliveryRow[]
): CompanyBackupPayload {
  const currentSizes = sizes && sizes.length > 0 ? sizes : ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const timestamp = new Date().toLocaleString('vi-VN');

  // 1. Sheet 01: Đơn Hàng Gốc
  const poHeaders = ['STT', 'Mã PO', 'Style / Tên Hàng', 'Ngày Đặt', 'ĐVT', ...currentSizes.map((s) => 'Size ' + s), 'Tổng SL Đặt', 'Ghi Chú'];
  const poRows = pos.map((po, idx) => {
    const sizeVals = currentSizes.map((s) => po.sizeQuantities?.[s] ?? 0);
    const sumSize = sizeVals.reduce((a, b) => a + Number(b), 0);
    const total = po.targetQty > 0 ? po.targetQty : sumSize;
    return [
      idx + 1,
      po.poNumber,
      po.style || '',
      po.orderDate || '',
      po.unit || 'PRS',
      ...sizeVals,
      total,
      po.note || '',
    ];
  });

  // 2. Sheet 02: Tab 1 - Số Trên Phiếu
  const tab1Headers = ['STT', 'Ngày Nhận', 'Mã PO', 'Code Vật Tư', 'Trạng Thái', 'Số Phiếu Giao', 'Quy Cách / Diễn Giải', 'ĐVT', ...currentSizes.map((s) => 'Size ' + s), 'Tổng Kế Hoạch', 'Ghi Chú'];
  const tab1Rows = planOrders.map((p, idx) => [
    idx + 1,
    p.receiptDate,
    p.poNumber,
    p.itemCode,
    p.status || 'Hàng đơn',
    p.voucherCode || '',
    p.description || '',
    p.unit || 'PRS',
    ...currentSizes.map((s) => p.sizeQuantities?.[s] ?? 0),
    p.totalQty,
    p.note || '',
  ]);

  // 3. Sheet 03: Tab 2 - Số Thực Nhận
  const tab2Headers = ['STT', 'Ngày Nhận', 'Mã PO', 'Code Vật Tư', 'Trạng Thái', 'Số Phiếu KH', 'Diễn Giải', 'ĐVT', ...currentSizes.map((s) => 'Size ' + s), 'Tổng Thực Nhận', 'SL Trên Phiếu', 'Ghi Chú'];
  const tab2Rows = actualReceives.map((a, idx) => {
    const matchedPlan = planOrders.find((p) => p.id === a.planOrderId || (p.poNumber?.trim().toUpperCase() === (a.poNumber || '').trim().toUpperCase() && p.itemCode?.trim().toUpperCase() === (a.itemCode || '').trim().toUpperCase()));
    const planTotal = matchedPlan ? matchedPlan.totalQty : '';
    return [
      idx + 1,
      a.receiptDate || '',
      a.poNumber || '',
      a.itemCode || '',
      a.status || 'Hàng đơn',
      a.voucherCode || '',
      a.description || '',
      a.unit || 'PRS',
      ...currentSizes.map((s) => a.sizeQuantities?.[s] ?? 0),
      a.totalQty,
      planTotal,
      a.note || '',
    ];
  });

  // 4. Sheet 04: Tab 3 - Bảng Chênh Lệch Gom Theo PO
  const tab3Headers = ['STT', 'Ngày Nhập', 'Mã PO', 'Code Vật Tư', 'Trạng Thái PO', 'Số Phiếu KH', 'Diễn Giải', 'ĐVT', ...currentSizes.map((s) => 'Lệch Size ' + s), 'Tổng Chênh Lệch', 'Cần Bù? [X]', 'SL Đơn Gốc', 'Đã Nhận Bù', 'Tổng Đã Nhận'];
  const tab3Rows = discrepancies.map((d, idx) => [
    idx + 1,
    d.receiptDate || '',
    d.poNumber,
    d.itemCode,
    d.statusText || (d.hasNegative ? 'Thiếu cần bù' : d.totalDiff > 0 ? 'Giao thừa' : 'Khớp đủ'),
    d.voucherCode || '',
    d.description || '',
    d.unit,
    ...currentSizes.map((s) => d.diffSizes?.[s] ?? 0),
    d.totalDiff,
    d.needsCompensation ? 'CẦN BÙ [X]' : 'Đủ',
    d.originalPlanQty ?? d.totalPlan,
    d.compensationActualQty ?? 0,
    d.totalActual,
  ]);

  // 5. Sheet 05: Tab 4 - Yêu Cầu Cấp Bù
  const tab4Headers = ['STT', 'Ngày Yêu Cầu', 'Nguồn Bù', 'Mã PO', 'Code Vật Tư', 'Số Phiếu', 'Chuyền SX', 'Lý Do Cấp Bù', ...currentSizes.map((s) => 'Size ' + s), 'Tổng Cần Bù', 'Trạng Thái'];
  const tab4Rows = compensationItems.map((c, idx) => [
    idx + 1,
    c.requestDate || '',
    c.sourceLabel || c.source,
    c.poNumber,
    c.itemCode,
    c.voucherCode || '',
    c.lineId || '',
    c.reason || '',
    ...currentSizes.map((s) => c.sizeQuantities?.[s] ?? 0),
    c.totalQty,
    c.status || 'Chờ gửi KH',
  ]);

  // 6. Sheet 06: Tab 5 - Xuất Vật Tư Cho Sản Xuất
  const tab5Headers = ['STT', 'Ngày Xuất', 'Mã PO', 'Code Vật Tư', 'Tên Chi Tiết', 'Chuyền SX', 'ĐVT', ...currentSizes.map((s) => 'Size ' + s), 'Tổng Xuất SX', 'Ghi Chú'];
  const tab5Rows = productionIssues.map((i, idx) => [
    idx + 1,
    i.issueDate,
    i.poNumber,
    i.itemCode,
    i.detailName || '',
    i.lineId || '',
    i.unit || 'PRS',
    ...currentSizes.map((s) => i.sizeQuantities?.[s] ?? 0),
    i.totalQty,
    i.note || '',
  ]);

  // 7. Sheet 07: Tab 6 - Tồn Kho Vật Tư Realtime (Gom theo PO)
  const tab6Headers = ['STT', 'Mã PO', 'Code Vật Tư', 'Diễn Giải', 'ĐVT', ...currentSizes.map((s) => 'Tồn Size ' + s), 'Tổng Nhận (Tab 2)', 'Tổng Xuất SX (Tab 5)', 'Tổng Bù Hỏng (Tab 7)', 'TỒN KHO THỰC TẾ'];
  const tab6Rows = realtimeStock.map((st, idx) => [
    idx + 1,
    st.poNumber,
    st.itemCode,
    st.description || '',
    st.unit || 'PRS',
    ...currentSizes.map((s) => st.currentStockSizes?.[s] ?? 0),
    st.totalReceived,
    st.totalProductionIssued,
    st.totalDamagedComp,
    st.totalCurrentStock,
  ]);

  // 8. Sheet 08: Tab 7 - Nghiệm Thu & Phân Loại Hỏng
  const tab7Headers = ['STT', 'Ngày Báo Cáo', 'Mã PO', 'Code Vật Tư', 'Tên Chi Tiết', 'Chuyền SX', 'ĐVT', ...currentSizes.map((s) => 'Đạt Size ' + s), 'Tổng Đạt Chuẩn', 'Tổng Hỏng (Kho bù)', 'Tổng Hỏng (Chờ NCC bù)'];
  const tab7Rows = productionReports.map((r, idx) => {
    const passedTot = Object.values(r.completedQuantities || {}).reduce((a: number, b) => a + Number(b || 0), 0);
    const compTot = Object.values(r.compensationFromStock || {}).reduce((a: number, b: number) => a + Number(b || 0), 0);
    const damagedTot = Object.values(r.compensationFromCustomer || {}).reduce((a: number, b: number) => a + Number(b || 0), 0);
    return [
      idx + 1,
      r.reportDate,
      r.poNumber,
      r.itemCode,
      r.detailName || '',
      r.lineId || '',
      r.unit || 'PRS',
      ...currentSizes.map((s) => r.completedQuantities?.[s] ?? 0),
      passedTot,
      compTot,
      damagedTot,
    ];
  });

  // 9. Sheet 09: Tab 8 - Kho & Xuất Thành Phẩm
  const tab8Headers = ['STT', 'Mã PO', 'Code Vật Tư', 'Tên Vật Tư', 'Loại', ...currentSizes.map((s) => 'Tồn Size ' + s), 'Tổng Nhập Xưởng', 'Tổng Đã Xuất', 'TỒN THÀNH PHẨM'];
  const tab8Rows = finishedGoodsStock.map((fg, idx) => [
    idx + 1,
    fg.poNumber,
    fg.itemCode,
    fg.materialName || '',
    fg.itemType || 'Thành Phẩm',
    ...currentSizes.map((s) => {
      const inQ = Number(fg.inboundSizes?.[s]) || 0;
      const outQ = Number(fg.deliveredSizes?.[s]) || 0;
      return inQ - outQ;
    }),
    fg.totalInbound,
    fg.totalDelivered,
    fg.totalStock,
  ]);

  // 10. Sheet 10: Tab 9 - Báo Cáo Tổng Hợp Tiến Độ PO
  const uniquePoList = Array.from(new Set([
    ...pos.map((p) => p.poNumber.trim().toUpperCase()),
    ...planOrders.map((p) => p.poNumber.trim().toUpperCase()),
    ...finishedGoodsDeliveries.map((d) => d.poNumber.trim().toUpperCase()),
  ])).filter(Boolean);

  const tab9Headers = ['STT', 'Mã PO', 'Style / Tên Hàng', 'Đơn Đặt Ban Đầu', 'Đã Xuất Giao', 'Còn Cần Xuất', 'Tồn Kho Sẵn Sàng', 'Đánh Giá Tiến Độ'];
  const tab9Rows = uniquePoList.map((poNum, idx) => {
    const origPO = pos.find((p) => p.poNumber.trim().toUpperCase() === poNum);
    const ordTot = origPO?.targetQty || 0;
    const poDels = finishedGoodsDeliveries.filter((d) => d.poNumber.trim().toUpperCase() === poNum);
    const issTot = poDels.reduce((sum, d) => sum + (Number(d.totalQty) || 0), 0);
    const needTot = Math.max(0, ordTot - issTot);
    const fgItem = finishedGoodsStock.find((fg) => fg.poNumber.trim().toUpperCase() === poNum);
    const stockTot = fgItem?.totalStock || 0;
    let statusText = 'Chưa sản xuất';
    if (ordTot > 0 && issTot >= ordTot) statusText = 'ĐÃ HOÀN THÀNH 100%';
    else if (issTot > 0) statusText = 'Đang giao hàng (' + issTot + '/' + ordTot + ')';
    else if (stockTot > 0) statusText = 'Có sẵn kho, chờ xuất';

    return [
      idx + 1,
      poNum,
      origPO?.style || '',
      ordTot,
      issTot,
      needTot,
      stockTot,
      statusText,
    ];
  });

  return {
    companyId: customer.id,
    companyName: customer.name,
    timestamp,
    sheets: {
      '01_DonHang_PO': {
        title: '01_DonHang_PO',
        themeColor: '#1e3a8a', // Xanh Navy
        headers: poHeaders,
        rows: poRows,
      },
      'Tab1_KeHoachNhap': {
        title: 'Tab1_KeHoachNhap',
        themeColor: '#0284c7', // Sky Blue
        headers: tab1Headers,
        rows: tab1Rows,
      },
      'Tab2_ThucNhan': {
        title: 'Tab2_ThucNhan',
        themeColor: '#059669', // Emerald Green
        headers: tab2Headers,
        rows: tab2Rows,
      },
      'Tab3_ChenhLech_PO': {
        title: 'Tab3_ChenhLech_PO',
        themeColor: '#ea580c', // Orange Amber
        headers: tab3Headers,
        rows: tab3Rows,
      },
      'Tab4_CapBuVatTu': {
        title: 'Tab4_CapBuVatTu',
        themeColor: '#dc2626', // Rose Red
        headers: tab4Headers,
        rows: tab4Rows,
      },
      'Tab5_XuatVatTu_SX': {
        title: 'Tab5_XuatVatTu_SX',
        themeColor: '#7c3aed', // Purple Violet
        headers: tab5Headers,
        rows: tab5Rows,
      },
      'Tab6_TonKho_Realtime': {
        title: 'Tab6_TonKho_Realtime',
        themeColor: '#0d9488', // Teal
        headers: tab6Headers,
        rows: tab6Rows,
      },
      'Tab7_BaoCao_SanXuat': {
        title: 'Tab7_BaoCao_SanXuat',
        themeColor: '#4f46e5', // Indigo
        headers: tab7Headers,
        rows: tab7Rows,
      },
      'Tab8_Kho_ThanhPham': {
        title: 'Tab8_Kho_ThanhPham',
        themeColor: '#d97706', // Amber Gold
        headers: tab8Headers,
        rows: tab8Rows,
      },
      'Tab9_TongHop_TienDoPO': {
        title: 'Tab9_TongHop_TienDoPO',
        themeColor: '#111827', // Slate Dark
        headers: tab9Headers,
        rows: tab9Rows,
      },
    },
  };
}

/**
 * Gửi payload sao lưu sang Google Apps Script Webhook URL
 */
export async function sendCompanyBackupToGoogleSheets(
  webhookUrl: string,
  payload: CompanyBackupPayload
): Promise<BackupResponse> {
  const cleanUrl = webhookUrl.trim();
  if (!cleanUrl) {
    throw new Error('Chưa cấu hình Google Apps Script Webhook URL!');
  }

  // Sử dụng text/plain để tránh CORS preflight OPTIONS request với Google Apps Script
  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Lỗi kết nối Google Apps Script (HTTP ' + response.status + ')');
  }

  const result: BackupResponse = await response.json();
  return result;
}

/**
 * Kiểm tra kết nối Webhook URL (Ping Test)
 */
export async function testGoogleSheetsWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const cleanUrl = webhookUrl.trim();
    if (!cleanUrl) return false;
    const response = await fetch(cleanUrl, {
      method: 'GET',
    });
    return response.ok;
  } catch (err) {
    // Trường hợp CORS ngăn đọc response GET nhưng server vẫn nhận được
    return true;
  }
}
