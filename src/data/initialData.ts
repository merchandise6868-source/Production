import {
  Customer,
  PurchaseOrder,
  MaterialReceipt,
  ProductionDelivery,
  CompensationOrder,
  InventoryItem,
  PlanOrderRow,
  ActualReceiveRow,
  ProductionIssueRow,
  ProductionReportRow,
  GeneralInboundSlip,
  GeneralOutboundSlip,
} from '../types';

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-deawoong',
    code: 'DW',
    name: 'Deawoong',
    note: 'Đối tác gia công chiến lược giày thể thao & casual',
    sizeRuns: [
      {
        id: 'sr-dw-letter',
        name: 'Dải Size Chữ (S-XL)',
        sizes: ['S', 'M', 'L', 'XL'],
      },
      {
        id: 'sr-dw-full',
        name: 'Dải Size Số (4-13, 1L, 2L)',
        sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '1L', '2L'],
      },
    ],
    activeSizeRunId: 'sr-dw-full',
  },
  {
    id: 'cust-lienthai',
    code: 'LT',
    name: 'Liên Thái',
    note: 'Đơn hàng giày da & sneaker xuất khẩu',
    sizeRuns: [
      {
        id: 'sr-lt-standard',
        name: 'Dải Size Chuẩn (4-12)',
        sizes: ['4', '5', '6', '7', '8', '9', '10', '11', '12'],
      },
    ],
    activeSizeRunId: 'sr-lt-standard',
  },
  {
    id: 'cust-changshin',
    code: 'CS',
    name: 'Changshin Partner',
    note: 'Gia công linh kiện đế & mũi giày',
    sizeRuns: [
      {
        id: 'sr-cs-numeric',
        name: 'Dải Size Phổ Thông (35-44)',
        sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
      },
    ],
    activeSizeRunId: 'sr-cs-numeric',
  },
  {
    id: 'cust-chung',
    code: 'CHUNG',
    name: 'Kho Chung (Nội Bộ D&D)',
    note: 'Quản lý kho nội bộ: Công cụ dụng cụ, Vật tư sản xuất & Thiết bị máy móc',
    sizeRuns: [
      {
        id: 'sr-chung-standard',
        name: 'Quản Lý Theo ĐVT (Cái, Bộ, Mét, Kg, Hộp, Cây...)',
        sizes: [],
      },
    ],
    activeSizeRunId: 'sr-chung-standard',
  },
];

// DỮ LIỆU GIAO DỊCH KHO ĐÃ ĐƯỢC XÓA SẠCH TRỐNG ĐỂ SẴN SÀNG IMPORT DỮ LIỆU THỰC TẾ
export const INITIAL_POS: PurchaseOrder[] = [];

export const INITIAL_RECEIPTS: MaterialReceipt[] = [];

export const INITIAL_DELIVERIES: ProductionDelivery[] = [];

export const INITIAL_COMPENSATIONS: CompensationOrder[] = [];

export const INITIAL_INVENTORIES: InventoryItem[] = [];

// ============================================================================
// DỮ LIỆU KHỞI TẠO THEO CHUẨN SRS (7 TAB NGHIỆP VỤ LIÊN HOÀN)
// ============================================================================

// TAB 1: SỐ TRÊN PHIẾU (Khởi tạo đơn hàng)
export const INITIAL_PLAN_ORDERS: PlanOrderRow[] = [];

// TAB 2: SỐ THỰC NHẬN (Nhập thực tế & Tồn kho ban đầu)
export const INITIAL_ACTUAL_RECEIVES: ActualReceiveRow[] = [];

// TAB 5: XUẤT CHO SẢN XUẤT (Cấp phát xuống Chuyền)
export const INITIAL_PRODUCTION_ISSUES: ProductionIssueRow[] = [];

// TAB 7: GHI NHẬN SẢN XUẤT XONG (Nghiệm thu đạt chuẩn nhập kho)
export const INITIAL_PRODUCTION_REPORTS: ProductionReportRow[] = [];

// ============================================================================
// DỮ LIỆU KHO CHUNG (NỘI BỘ D&D)
// ============================================================================

export const INITIAL_GENERAL_INBOUND_SLIPS: GeneralInboundSlip[] = [];

export const INITIAL_GENERAL_OUTBOUND_SLIPS: GeneralOutboundSlip[] = [];
