import * as XLSX from 'xlsx';
import {
  Customer,
  PurchaseOrder,
  MaterialReceipt,
  ProductionDelivery,
  CompensationOrder,
  InventoryMovementRecord,
  DashboardReportItem,
} from '../types';

// Tab 1: Xuất Danh Sách Khách Hàng & Đơn Hàng PO
export const exportCustomersAndPOsToExcel = (
  customer: Customer,
  pos: PurchaseOrder[]
) => {
  const wsData = [
    ['BÁO CÁO THÔNG TIN ĐỐI TÁC GIA CÔNG & DANH SÁCH ĐƠN HÀNG PO'],
    [`Khách hàng: ${customer.name} (Mã: ${customer.code})`],
    [`Dải size cấu hình: ${customer.sizeRuns.map((sr) => `${sr.name} [${sr.sizes.join(', ')}]`).join(' | ')}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
    ['DANH SÁCH ĐƠN HÀNG PO ĐANG THỰC HIỆN'],
    ['STT', 'Mã PO', 'Mã Kiểu Dáng (Style)', 'Ngày Nhận Đơn', 'Số Lượng Kế Hoạch', 'Đơn Vị', 'Ghi Chú'],
    ...pos.map((p, idx) => [
      idx + 1,
      p.poNumber,
      p.style,
      p.orderDate,
      p.targetQty,
      p.unit,
      p.note || '',
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 25 },
    { wch: 16 },
    { wch: 18 },
    { wch: 10 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'KhachHang_PO');
  const filename = `KhachHang_PO_${customer.code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// Tab 2: Xuất Sổ Nhập Kho Vật Tư (Dạng Ma Trận Dải Size Nằm Ngang)
export const exportInboundReceiptsToExcel = (
  receipts: MaterialReceipt[],
  customerName: string,
  pos: PurchaseOrder[],
  sizeList: string[] = ['4', '5', '6', '7', '8', '9', '10', '11', '12']
) => {
  // Group receipts by batch / voucher / material
  const groupMap = new Map<string, {
    receiptDate: string;
    voucherCode: string;
    poNumber: string;
    originalName: string;
    vnName: string;
    unit: string;
    sizeQuantities: Record<string, number>;
    totalQty: number;
    note: string;
  }>();

  receipts.forEach((r) => {
    const po = pos.find((p) => p.id === r.poId);
    const poNum = po?.poNumber || 'N/A';
    const groupKey = r.batchId || `${r.receiptDate}_${r.voucherCode || ''}_${poNum}_${r.originalName}`;

    let item = groupMap.get(groupKey);
    if (!item) {
      item = {
        receiptDate: r.receiptDate,
        voucherCode: r.voucherCode || '',
        poNumber: poNum,
        originalName: r.originalName,
        vnName: r.vnName,
        unit: r.unit,
        sizeQuantities: {},
        totalQty: 0,
        note: r.note || '',
      };
      groupMap.set(groupKey, item);
    }

    const qty = r.qtyActual || r.qtyDoc || 0;
    item.sizeQuantities[r.size] = (item.sizeQuantities[r.size] || 0) + qty;
    item.totalQty += qty;
  });

  const matrixRows = Array.from(groupMap.values());

  const wsData = [
    ['SỔ THEO DÕI NHẬP KHO NGUYÊN VẬT LIỆU GIA CÔNG (DẢI SIZE NẰM NGANG)'],
    [`Khách hàng: ${customerName}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
    [
      'STT',
      'Ngày Nhập',
      'Số Phiếu Xuất Của KH',
      'Mã PO',
      'Mã Hàng (Gốc Anh/Trung)',
      'Diễn Giải (Tiếng Việt)',
      'ĐVT',
      ...sizeList.map((s) => `Size ${s}`),
      'TỔNG CỘNG',
      'Ghi Chú',
    ],
    ...matrixRows.map((row, idx) => [
      idx + 1,
      row.receiptDate,
      row.voucherCode || '-',
      row.poNumber,
      row.originalName,
      row.vnName,
      row.unit,
      ...sizeList.map((s) => row.sizeQuantities[s] || '-'),
      row.totalQty,
      row.note,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 24 },
    { wch: 30 },
    { wch: 8 },
    ...sizeList.map(() => ({ wch: 10 })),
    { wch: 14 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'So_Nhap_Kho_Size_Ngang');
  const filename = `NhapKho_SizeNgang_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// Tab 3: Xuất Sổ Xuất Kho & Giao Thành Phẩm Đợt 1
export const exportOutboundDeliveriesToExcel = (
  deliveries: ProductionDelivery[],
  customerName: string,
  pos: PurchaseOrder[]
) => {
  const wsData = [
    ['SỔ THEO DÕI XUẤT KHO & GIAO THÀNH PHẨM ĐỢT 1'],
    [`Khách hàng: ${customerName}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
    [
      'STT',
      'Ngày Xuất Giao',
      'Mã PO',
      'Tên Thành Phẩm / NVL (Gốc)',
      'Tên Tiếng Việt',
      'Size',
      'SL Xuất Giao Đợt 1',
      'ĐVT',
      'Trạng Thái PO',
      'Ghi Chú',
    ],
    ...deliveries.map((d, idx) => {
      const po = pos.find((p) => p.id === d.poId);
      return [
        idx + 1,
        d.deliveryDate,
        po?.poNumber || 'N/A',
        d.originalName,
        d.vnName,
        d.size,
        d.qtyBatch1,
        d.unit,
        'Chưa hoàn thành đơn gốc',
        d.note || '',
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 14 },
    { wch: 26 },
    { wch: 24 },
    { wch: 8 },
    { wch: 18 },
    { wch: 8 },
    { wch: 24 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Xuat_Kho_Giao_Dot1');
  const filename = `XuatGiaoDot1_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// Tab 4: Xuất Sổ Quản Lý Phiếu Bù (3 Trường Hợp A, B, C)
export const exportCompensationsToExcel = (
  compensations: CompensationOrder[],
  customerName: string,
  pos: PurchaseOrder[]
) => {
  const wsData = [
    ['BẢNG TỔNG HỢP QUẢN LÝ PHIẾU BÙ SẢN XUẤT & NGUYÊN LIỆU (A - B - C)'],
    [`Khách hàng: ${customerName}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
    [
      'STT',
      'Mã Phiếu Bù',
      'Phân Loại Trường Hợp',
      'Mã PO',
      'Tên Hàng / NVL',
      'Tên Tiếng Việt',
      'Size',
      'SL Yêu Cầu Bù',
      'ĐVT',
      'Ngày Lập',
      'Ngày Hoàn Tất',
      'Trách Nhiệm / Chi Phí',
      'Trạng Thái',
      'Lý Do Chi Tiết',
      'Ghi Chú',
    ],
    ...compensations.map((c, idx) => {
      const po = pos.find((p) => p.id === c.poId);
      const caseName =
        c.compCase === 'A'
          ? 'TH A: Hỏng trong SX'
          : c.compCase === 'B'
          ? 'TH B: Khách cấp bù NLGC'
          : 'TH C: SX bù Thành phẩm';

      return [
        idx + 1,
        c.voucherCode,
        caseName,
        po?.poNumber || 'N/A',
        c.originalName,
        c.vnName,
        c.size,
        c.qtyCompensation,
        c.unit,
        c.requestDate,
        c.completionDate || 'Chưa xong',
        c.liability,
        c.status,
        c.reason,
        c.note || '',
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 25 },
    { wch: 22 },
    { wch: 8 },
    { wch: 14 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 35 },
    { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Quan_Ly_Phieu_Bu');
  const filename = `PhieuBu_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// Tab 5: Xuất Bảng Tồn Kho & Biên Bản Kiểm Kê
export const exportInventoryAuditToExcel = (
  items: InventoryMovementRecord[],
  inventories: { id: string; stockActual: number; auditDate: string; note?: string }[],
  customerName: string
) => {
  const wsData = [
    ['BẢNG ĐỐI CHIẾU TỒN KHO VẬT TƯ & BIÊN BẢN KIỂM KÊ THỰC TẾ'],
    [`Khách hàng: ${customerName}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
    [
      'STT',
      'Mã PO',
      'Style / Kiểu',
      'Tên NVL (Gốc)',
      'Tên Dịch (Tiếng Việt)',
      'Size',
      'ĐVT',
      'Tồn Kho Phần Mềm',
      'Kiểm Kê Thực Tế',
      'Chênh Lệch Thất Thoát',
      'Ngày Kiểm Kê Gần Nhất',
      'Đánh Giá Thất Thoát',
    ],
    ...items.map((item, idx) => {
      const savedAudit = inventories.find((inv) => inv.id === item.id);
      const actual = savedAudit ? savedAudit.stockActual : item.closingStock;
      const diff = actual - item.closingStock;
      const auditDate = savedAudit?.auditDate || new Date().toLocaleDateString('vi-VN');
      const assessment =
        diff === 0 ? 'Khớp 100%' : diff < 0 ? `Hao hụt ${Math.abs(diff)} ${item.unit}` : `Dư thừa ${diff} ${item.unit}`;

      return [
        idx + 1,
        item.poNumber,
        item.style,
        item.originalName,
        item.vnName,
        item.size,
        item.unit,
        item.closingStock,
        actual,
        diff,
        auditDate,
        assessment,
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 20 },
    { wch: 25 },
    { wch: 22 },
    { wch: 8 },
    { wch: 8 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Kiem_Ke_Ton_Kho');
  const filename = `KiemKeKho_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// Tab 6: Báo Cáo Tổng Hợp Nhập - Xuất - Tồn (N-X-T)
export const exportNXTToExcel = (
  records: InventoryMovementRecord[],
  customerName: string,
  dateRange: { start: string; end: string }
) => {
  const wsData = [
    ['BÁO CÁO TỔNG HỢP NHẬP - XUẤT - TỒN KHO VẬT TƯ'],
    [`Khách hàng: ${customerName}`],
    [`Kỳ báo cáo: Từ ngày ${dateRange.start || 'Đầu kỳ'} đến ngày ${dateRange.end || 'Hiện tại'}`],
    [],
    [
      'STT',
      'Mã PO',
      'Style / Kiểu Dáng',
      'Tên NVL (Gốc)',
      'Tên Dịch (Tiếng Việt)',
      'ĐVT',
      'Size',
      'Tồn Đầu Kỳ',
      'Nhập Trong Kỳ (N_thực)',
      'Xuất Đợt 1',
      'Xuất Bù',
      'Tổng Xuất',
      'Tồn Cuối Kỳ',
      'Trạng Thái Kho',
    ],
    ...records.map((r, index) => [
      index + 1,
      r.poNumber,
      r.style,
      r.originalName,
      r.vnName,
      r.unit,
      r.size,
      r.openingStock,
      r.inboundQty,
      r.outboundBatch1,
      r.outboundComp,
      r.totalOutbound,
      r.closingStock,
      r.statusText,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 22 },
    { wch: 25 },
    { wch: 25 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Bao_Cao_NXT');
  const filename = `BaoCao_NXT_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};

// Tab 7: Bảng Đối Soát PO & Master Dashboard
export const exportDashboardToExcel = (
  items: DashboardReportItem[],
  customerName: string
) => {
  const wsData = [
    ['BẢNG TỔNG HỢP ĐỐI SOÁT ĐƠN HÀNG GIA CÔNG & TIẾN ĐỘ GIAO HÀNG'],
    [`Khách hàng: ${customerName}`],
    [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')}`],
    [],
    [
      'Mã PO',
      'Tên NVL / Giày (Gốc)',
      'Tên Tiếng Việt',
      'Size',
      'Số Phiếu Nhận (N_ct)',
      'Số Thực Nhận (N_thực)',
      'SL Đã Giao Đợt 1',
      'SL Phiếu Bù',
      'Tổng Đã Giao',
      'Tồn Kho NVL',
      'Trạng Thái PO',
    ],
    ...items.map((i) => [
      i.poNumber,
      i.originalName,
      i.vnName,
      i.size,
      i.qtyDoc,
      i.qtyActual,
      i.qtyBatch1,
      i.qtyComp,
      i.totalDelivered,
      i.remainingStock,
      i.status,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 14 },
    { wch: 26 },
    { wch: 24 },
    { wch: 8 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Doi_Soat_PO');
  const filename = `DoiSoat_PO_${customerName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
};
