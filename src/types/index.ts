export interface SizeRun {
  id: string;
  name: string;
  sizes: string[];
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  note?: string;
  sizeRuns: SizeRun[];
  activeSizeRunId: string;
  googleSheetUrl?: string;
  lastBackupAt?: string;
}

export interface PurchaseOrder {
  id: string;
  customerId: string;
  poNumber: string;
  style: string;
  orderDate: string; // DD/MM/YYYY
  targetQty: number;
  unit: string;
  sizeQuantities?: Record<string, number>; // Số lượng chi tiết theo từng size
  note?: string;
}

export interface MaterialReceipt {
  id: string;
  receiptDate: string; // DD/MM/YYYY
  poId: string;
  customerId: string;
  originalName: string; // Anh/Trung
  vnName: string; // Tiếng Việt
  size: string;
  qtyDoc: number; // N_ct
  qtyActual: number; // N_thực
  discrepancy: number; // N_ct - N_thực
  unit: string;
  isCompensationReceipt?: boolean; // Nhập bù NLGC cho PO (Trường hợp B)
  voucherCode?: string; // Số phiếu xuất kho / Delivery bill No (VD: PXNVLYEN0926-032)
  batchId?: string; // Mã nhóm liên kết các size trong cùng 1 lần nhập
  note?: string;
}

export interface ProductionDelivery {
  id: string;
  deliveryDate: string; // DD/MM/YYYY
  poId: string;
  customerId: string;
  originalName: string;
  vnName: string;
  size: string;
  qtyBatch1: number; // SL xuất đợt 1
  unit: string;
  voucherCode?: string;
  batchId?: string;
  note?: string;
}

// 3 Trường hợp bù đặc thù:
// A: Bù do NLGC bị hỏng trong sản xuất (Lỗi thao tác / Máy móc xưởng -> Tính vào hao hụt vượt định mức)
// B: Bù do Khách hàng giao thiếu / NLGC ẩn lỗi (Lỗi nguyên liệu -> Báo cáo đề nghị KH cấp bù NLGC mới)
// C: Sản xuất bù Thành phẩm (Xưởng nhận NLGC cấp bù -> May/gò hoàn thiện TP thiếu -> Giao bù cho đủ hợp đồng)
export type CompensationCase = 'A' | 'B' | 'C';

export interface CompensationOrder {
  id: string;
  voucherCode: string;
  compCase: CompensationCase; // A, B hoặc C
  caseLabel: string;
  requestDate: string; // DD/MM/YYYY
  completionDate?: string; // DD/MM/YYYY
  poId: string;
  customerId: string;
  originalName: string;
  vnName: string;
  size: string;
  qtyCompensation: number; // SL yêu cầu bù
  unit: string;
  reason: string;
  liability: 'Xưởng chịu (Vượt định mức)' | 'Khách hàng cấp bù';
  status: 'Chờ xử lý' | 'Đang thực hiện' | 'Đã hoàn tất';
  note?: string;
}

export interface InventoryItem {
  id: string;
  customerId: string;
  poId: string;
  originalName: string;
  vnName: string;
  size: string;
  unit: string;
  stockActual: number;
  auditDate: string; // DD/MM/YYYY
  note?: string;
}

export interface InventoryMovementRecord {
  id: string;
  poNumber: string;
  style: string;
  originalName: string;
  vnName: string;
  unit: string;
  size: string;
  openingStock: number;
  inboundQty: number; // N_thực
  outboundBatch1: number;
  outboundComp: number;
  totalOutbound: number;
  closingStock: number;
  statusText: string;
}

export interface DashboardReportItem {
  poId: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  size: string;
  qtyDoc: number;
  qtyActual: number;
  qtyBatch1: number;
  qtyComp: number;
  totalDelivered: number;
  remainingStock: number;
  status: 'Chưa hoàn thành đơn gốc' | 'Hoàn thành';
}

// ============================================================================
// CÁC DATA MODEL CHUẨN SRS (DỰ ÁN HỆ THỐNG QUẢN LÝ GIAO NHẬN, TỒN KHO & SẢN XUẤT)
// ============================================================================

// TAB 1: SỐ TRÊN PHIẾU (Khởi tạo đơn hàng - Định danh duy nhất 1 lần)
export interface PlanOrderRow {
  id: string;
  customerId: string;
  receiptDate: string;     // NGÀY NHẬP
  poNumber: string;        // MÃ PO
  round?: number;          // CỘT LẦN (Đợt nhập / Lần giao 1, 2, 3... Mặc định 1)
  itemCode: string;        // CODE VẬT TƯ (TRƯỚC LÀ MÃ HÀNG TT)
  voucherCode: string;     // SỐ PHIẾU KH
  description: string;     // DIỄN GIẢI
  unit: string;            // ĐVT (PRS, đôi, bộ...)
  sizeQuantities: Record<string, number>; // Số lượng kế hoạch từng Size 4 -> 12
  totalQty: number;        // TỔNG CỘNG tự động tính
  status?: 'Hàng đơn' | 'Hàng bù (mua)' | 'Hàng bù'; // Trạng thái đơn hàng
  note?: string;
  createdAt: string;
}

// TAB 2: SỐ THỰC NHẬN (Nhập thực tế & Tồn kho ban đầu)
export interface ActualReceiveRow {
  id: string;
  planOrderId: string;     // Liên kết tương ứng dòng định danh ở Tab 1
  customerId: string;
  receiptDate?: string;    // Ngày nhận thực tế
  poNumber?: string;       // Mã PO
  round?: number;          // Cột Lần tương ứng với đợt nhận
  itemCode?: string;       // Code vật tư
  voucherCode?: string;    // Số phiếu
  description?: string;    // Diễn giải
  unit?: string;           // ĐVT
  sizeQuantities: Record<string, number>; // Số lượng thực nhận thực tế từng Size
  totalQty: number;
  status?: 'Hàng đơn' | 'Hàng bù (mua)' | 'Hàng bù'; // Trạng thái: Hàng đơn hay Hàng bù (mua)
  note?: string;
  updatedAt: string;
}

// TAB 3: SỐ CHÊNH LỆCH (Tự động tính & Cảnh báo âm - Group by theo PO)
export interface DiscrepancyRow {
  planOrderId: string;
  customerId: string;
  receiptDate: string;
  poNumber: string;
  itemCode: string;
  voucherCode: string;
  description: string;
  unit: string;
  planSizes: Record<string, number>;
  actualSizes: Record<string, number>;
  diffSizes: Record<string, number>; // Size_i = Actual_i - Plan_i
  totalPlan: number;
  totalActual: number;
  totalDiff: number;
  hasNegative: boolean;              // Có ít nhất 1 size bị âm (< 0)
  needsCompensation: boolean;        // Cột BÙ? [x]
  originalPlanQty?: number;          // Tổng SL Kế hoạch gốc (Hàng đơn)
  compensationPlanQty?: number;      // Tổng SL Phiếu giao bù (Hàng bù)
  originalActualQty?: number;        // Tổng SL Thực nhận gốc
  compensationActualQty?: number;    // Tổng SL Thực nhận bù
  statusText?: 'Khớp đủ' | 'Thiếu cần bù' | 'Giao thừa';
  matchingPlans?: PlanOrderRow[];    // Chi tiết các phiếu thuộc PO
  matchingActuals?: ActualReceiveRow[]; // Chi tiết các đợt nhận thuộc PO
  isCompensationItem?: boolean;      // Đánh dấu dòng Hàng bù (mua) độc lập
}

// TAB 5: XUẤT CHO SẢN XUẤT (Cấp phát xuống Chuyền)
export interface ProductionIssueRow {
  id: string;
  customerId: string;
  issueDate: string;
  poNumber: string;
  itemCode: string;
  detailName?: string;               // Dropdown tên chi tiết trong PO
  lineId: string;                    // Dropdown: Chuyền 1, Chuyền 2, Chuyền 3...
  unit: string;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  note?: string;
}

// TAB 7: GHI NHẬN SẢN XUẤT XONG (Nghiệm thu & Xử lý Hỏng)
export interface ProductionReportRow {
  id: string;
  customerId: string;
  reportDate: string;
  poNumber: string;
  itemCode: string;
  itemType?: 'Thành Phẩm' | 'Bán thành phẩm'; // Loại: Thành Phẩm hay Bán thành phẩm
  detailName?: string;               // Dropdown tên chi tiết trong PO
  lineId: string;
  unit: string;
  completedQuantities: Record<string, number>; // Số lượng hoàn thành
  damagedQuantities?: Record<string, number>;   // Số lượng làm hư hỏng (nếu có)
  compensationFromStock?: Record<string, number>; // Lấy tồn kho bù vào (Tab 6 Xuất bù)
  status?: 'Đạt chuẩn' | 'Đủ hàng' | string;
  note?: string;
}

// TAB 4: NHẬN VẬT TƯ GIAO BÙ
export interface CompensationRequestItem {
  id: string;
  customerId: string;
  source: 'DISCREPANCY_TAB3' | 'DAMAGE_OUT_OF_STOCK_TAB7' | 'DAMAGED_GOODS';
  sourceLabel: string;               // "Giao thiếu (Tab 3)" | "Hỏng hết kho (Tab 7)" | "Hàng hư hỏng"
  poNumber: string;
  itemCode: string;
  voucherCode?: string;
  lineId?: string;
  reason: string;
  sizeQuantities: Record<string, number>; // Số lượng âm / thiếu theo Size cần bù
  totalQty: number;
  requestDate: string;
  status: 'Chờ gửi KH' | 'Đã gửi yêu cầu' | 'Đã nhận bù';
  receivedQuantities?: Record<string, number>; // Số lượng thực tế đã nhận bù theo Size
  isFullyReceived?: boolean;
  receivedDate?: string;
  note?: string;
}

// TAB 6: TỒN KHO THỜI GIAN THỰC & PHÂN LOẠI XUẤT
export interface RealtimeStockMovement {
  id: string;
  date: string;
  type: 'NHAP_THUC_TE' | 'XUAT_SAN_XUAT' | 'XUAT_BU_HONG';
  typeLabel: 'Nhập thực tế (Tab 2)' | 'Xuất sản xuất (Tab 5)' | 'Xuất bù (Tab 7)';
  poNumber: string;
  itemCode: string;
  lineOrVoucher?: string;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  note?: string;
}

export interface RealtimeStockItem {
  key: string;                       // poNumber + itemCode
  customerId: string;
  poNumber: string;
  itemCode: string;
  description: string;
  unit: string;
  receivedSizes: Record<string, number>;        // Đường 1: Tab 2 (Thực nhận)
  productionIssuedSizes: Record<string, number>; // Đường 2: Tab 5 (Xuất sản xuất)
  damagedCompSizes: Record<string, number>;     // Tab 7 (Xuất bù hư hỏng)
  currentStockSizes: Record<string, number>;    // = Thực nhận - Xuất SX - Xuất bù
  totalReceived: number;
  totalProductionIssued: number;
  totalDamagedComp: number;
  totalCurrentStock: number;
}

// ============================================================================
// PHÂN HỆ THÀNH PHẨM (FINISHED GOODS): NHẬP KHO - TỒN KHO - XUẤT KHO THÀNH PHẨM
// ============================================================================

// Phiếu Xuất Kho Thành Phẩm Gửi Khách Hàng
export interface FinishedGoodsDeliveryRow {
  id: string;
  customerId: string;
  deliveryDate: string;              // Ngày xuất giao (DD/MM/YYYY)
  poNumber: string;                  // Mã PO
  itemCode: string;                  // Mã hàng / Model
  itemType?: 'Bán TP' | 'Bán thành phẩm' | 'Thành Phẩm'; // Loại: Bán TP/Bán thành phẩm hoặc Thành Phẩm
  materialName?: string;             // Tên vật tư trong PO
  deliveryVoucher: string;           // Số phiếu xuất giao (Delivery Note No)
  receiver: string;                  // Khách hàng / Người nhận
  unit: string;                      // ĐVT (đôi, PRS, chiếc...)
  sizeQuantities: Record<string, number>; // Số lượng xuất từng Size
  totalQty: number;                  // Tổng số lượng xuất giao
  note?: string;
  createdAt: string;
}

// Bảng Tồn Kho Thành Phẩm (Tự động tính = Nhập kho từ Tab 7 - Đã xuất giao cho khách)
export interface FinishedGoodsStockItem {
  key: string;                       // poNumber + itemCode
  customerId: string;
  poNumber: string;
  itemCode: string;
  itemType?: 'Bán TP' | 'Bán thành phẩm' | 'Thành Phẩm'; // Loại: Bán TP/Bán thành phẩm hoặc Thành Phẩm
  materialName?: string;             // Tên vật tư trong PO
  unit: string;
  inboundSizes: Record<string, number>;   // Tự động đọc từ Tab 7 (completedQuantities của các chuyền)
  totalInbound: number;
  deliveredSizes: Record<string, number>; // Tự động đọc từ các phiếu xuất kho thành phẩm
  totalDelivered: number;
  stockSizes: Record<string, number>;     // Tồn kho hiện tại = Inbound - Delivered
  totalStock: number;
}

// ============================================================================
// PHÂN HỆ KHO CHUNG (NỘI BỘ D&D) - PHIẾU NHẬP KHO, XUẤT KHO & TỒN KHO THEO LẦN
// ============================================================================

// Dòng chi tiết trên Phiếu Nhập Kho Chung (Hình 1)
export interface GeneralInboundItem {
  id: string;
  itemCode: string;        // Mã hàng
  itemName: string;        // Tên hàng hóa
  unit: string;            // ĐVT (Cái, Bộ, Mét, Kg, Hộp, Cây...)
  quantity: number;        // Số lượng
  unitPrice: number;       // Đơn giá
  totalAmount: number;     // Thành tiền (= Số lượng * Đơn giá)
  receiver: string;        // Người nhập (mặc định "Hà")
  department: string;      // Bộ phận nhập kho (mặc định "Kho")
  note?: string;           // Ghi chú
}

// Phiếu Nhập Kho Chung (Hình 1)
export interface GeneralInboundSlip {
  id: string;
  slipNumber: string;      // Mã số phiếu (Bắt buộc)
  date: string;            // Ngày (Bắt buộc, DD/MM/YYYY)
  items: GeneralInboundItem[];
  totalQty: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

// 3 nhóm phân loại vật tư xuất kho (Hình 2)
export type GeneralItemGroup = 'Công cụ dụng cụ' | 'Vật tư sản xuất' | 'Thiết bị máy móc';

// Dòng chi tiết trên Phiếu Xuất Kho Chung (Hình 2)
export interface GeneralOutboundItem {
  id: string;
  itemCode: string;        // Mã hàng
  itemName: string;        // Tên hàng hóa
  group: GeneralItemGroup; // Nhóm: Công cụ dụng cụ | Vật tư sản xuất | Thiết bị máy móc
  unit: string;            // ĐVT
  quantity: number;        // Số lượng xuất
  receiver: string;        // Người nhận
  department: string;      // Bộ phận sử dụng
  purpose: string;         // Mục đích sử dụng
  note?: string;           // Ghi chú
}

// Phiếu Xuất Kho Chung (Hình 2)
export interface GeneralOutboundSlip {
  id: string;
  slipNumber: string;      // Mã phiếu (Bắt buộc)
  date: string;            // Ngày (Bắt buộc, DD/MM/YYYY)
  items: GeneralOutboundItem[];
  totalQty: number;
  createdAt: string;
  updatedAt: string;
}

// Dòng hiển thị thẻ kho chi tiết theo từng lần xuất (Hình 3)
export interface GeneralStockCardRow {
  stt: number;
  itemName: string;        // Tên hàng hoá
  inboundDate?: string;    // Ngày nhập
  outboundDate?: string;   // Ngày xuất
  exportSequence?: string; // Lần xuất ("Lần 1", "Lần 2", "Lần 3"...)
  quantity: number;        // Số lượng
  receiver?: string;       // Người nhận
  purpose?: string;        // Mục đích sử dụng
  note?: string;           // Ghi chú
  type: 'INBOUND' | 'OUTBOUND';
}

// Bảng tổng hợp tồn kho chung (Tầng 1 Tab 3)
export interface GeneralStockSummaryItem {
  itemCode: string;
  itemName: string;
  group?: GeneralItemGroup;
  unit: string;
  totalInbound: number;
  totalOutbound: number;
  currentStock: number;
  lastInboundDate?: string;
  lastOutboundDate?: string;
}



