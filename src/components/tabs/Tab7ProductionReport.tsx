import React, { useState, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ProductionReportRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  RotateCcw,
  Search,
  Trash2,
  Edit,
  X,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  History,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';

interface DraftReportRow {
  id: string;
  reportDate: string;
  poNumber: string;
  itemCode: string;
  lineId: string;
  unit: string;
  completedQuantities: Record<string, number | ''>;
  damagedQuantities: Record<string, number | ''>;
  note: string;
}

const LINE_OPTIONS = [
  'Chuyền 1',
  'Chuyền 2',
  'Chuyền 3',
  'Chuyền 4',
  'Chuyền 5',
  'Tổ May A',
  'Tổ May B',
  'Tổ Gò 1',
  'Tổ Gò 2',
  'Tổ Hoàn Thiện',
];

interface Tab7ProductionReportProps {
  onNavigateToTab4?: () => void;
}

export const Tab7ProductionReport: React.FC<Tab7ProductionReportProps> = ({ onNavigateToTab4 }) => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    currentCustomerProductionIssues,
    currentCustomerProductionReports,
    currentCustomerRealtimeStock,
    addProductionReport,
    updateProductionReport,
    deleteProductionReport,
  } = useInventory();

  const [editingReport, setEditingReport] = useState<ProductionReportRow | null>(null);

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const createEmptyRow = (): DraftReportRow => {
    const compInit: Record<string, number | ''> = {};
    const damInit: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      compInit[s] = '';
      damInit[s] = '';
    });
    return {
      id: `draft-rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      reportDate: defaultDate,
      poNumber: currentCustomerPlanOrders[0]?.poNumber || '',
      itemCode: currentCustomerPlanOrders[0]?.itemCode || '',
      lineId: currentCustomerProductionIssues[0]?.lineId || 'Chuyền 1',
      unit: 'PRS',
      completedQuantities: compInit,
      damagedQuantities: damInit,
      note: '',
    };
  };

  const [activeSubTab, setActiveSubTab] = useState<'ENTRY' | 'SAVED'>('ENTRY');
  const [draftRows, setDraftRows] = useState<DraftReportRow[]>([createEmptyRow()]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleAddRows = (count: number = 1) => {
    const newRows: DraftReportRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setDraftRows((prev) => [...prev, ...newRows]);
  };

  const handleUpdateDraftField = (id: string, field: keyof DraftReportRow, value: any) => {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'poNumber') {
          const match = currentCustomerPlanOrders.find(
            (p) => p.poNumber.toUpperCase() === String(value).toUpperCase()
          );
          if (match) {
            updated.itemCode = match.itemCode;
            updated.unit = match.unit;
          }
        }
        return updated;
      })
    );
  };

  const handleUpdateSizeQty = (
    rowId: string,
    type: 'completed' | 'damaged',
    size: string,
    val: string
  ) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (type === 'completed') {
          return {
            ...r,
            completedQuantities: {
              ...r.completedQuantities,
              [size]: num,
            },
          };
        } else {
          return {
            ...r,
            damagedQuantities: {
              ...r.damagedQuantities,
              [size]: num,
            },
          };
        }
      })
    );
  };

  const handleRemoveDraftRow = (id: string) => {
    if (draftRows.length <= 1) {
      setDraftRows([createEmptyRow()]);
      return;
    }
    setDraftRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Helper to get available stock from Tab 6 for a specific PO, itemCode & size
  const getAvailableStock = (poNumber: string, itemCode: string, size: string): number => {
    const key = `${poNumber.trim().toUpperCase()}__${itemCode.trim().toUpperCase()}`;
    const stockItem = currentCustomerRealtimeStock.find((s) => s.key === key);
    if (!stockItem) return 0;
    return stockItem.currentStockSizes[size] || 0;
  };

  // Calculate row total
  const getCompletedTotal = (row: DraftReportRow): number => {
    return sizes.reduce((sum, s) => {
      const q = row.completedQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  const getDamagedTotal = (row: DraftReportRow): number => {
    return sizes.reduce((sum, s) => {
      const q = row.damagedQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  // Save report with Branching Logic:
  // - If enough: confirm completion
  // - If damaged:
  //   - Kho còn tồn: Gắn trạng thái "Xuất bù", tự động trừ vào Tab 6 (compensationFromStock)
  //   - Kho hết tồn: Tự động đẩy phần thiếu sang Tab 4 (compensationFromCustomer)
  const handleSaveReport = (row: DraftReportRow) => {
    if (!currentCustomer) return;
    if (!row.poNumber.trim() || !row.itemCode.trim()) {
      alert('Vui lòng nhập đầy đủ Mã PO và Mã Hàng!', 'Thiếu thông tin', 'warning');
      return;
    }

    const completedQ: Record<string, number> = {};
    const damagedQ: Record<string, number> = {};
    const fromStock: Record<string, number> = {};
    const fromCustomer: Record<string, number> = {};

    let totalDamaged = 0;
    let totalFromStock = 0;
    let totalFromCustomer = 0;

    sizes.forEach((s) => {
      const c = typeof row.completedQuantities[s] === 'number' ? Number(row.completedQuantities[s]) : 0;
      const d = typeof row.damagedQuantities[s] === 'number' ? Number(row.damagedQuantities[s]) : 0;
      completedQ[s] = c;
      damagedQ[s] = d;

      if (d > 0) {
        totalDamaged += d;
        const available = getAvailableStock(row.poNumber, row.itemCode, s);
        if (available >= d) {
          // Case 1: Kho còn đủ hàng -> Lấy tồn kho bù vào
          fromStock[s] = d;
          totalFromStock += d;
        } else if (available > 0) {
          // Case 2a: Kho còn một phần -> Lấy hết phần còn lại, phần thiếu đẩy sang Tab 4
          fromStock[s] = available;
          totalFromStock += available;
          const shortage = d - available;
          fromCustomer[s] = shortage;
          totalFromCustomer += shortage;
        } else {
          // Case 2b: Kho hết sạch -> Toàn bộ đẩy sang Tab 4
          fromCustomer[s] = d;
          totalFromCustomer += d;
        }
      }
    });

    let status: ProductionReportRow['status'] = 'Đủ hàng';
    if (totalFromCustomer > 0) {
      status = 'Đề nghị KH cấp bù';
    } else if (totalFromStock > 0) {
      status = 'Xuất bù từ kho';
    }

    const newReport: ProductionReportRow = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer.id,
      reportDate: row.reportDate.trim() || defaultDate,
      poNumber: row.poNumber.trim().toUpperCase(),
      itemCode: row.itemCode.trim().toUpperCase(),
      lineId: row.lineId,
      unit: row.unit || 'PRS',
      completedQuantities: completedQ,
      damagedQuantities: damagedQ,
      compensationFromStock: fromStock,
      compensationFromCustomer: fromCustomer,
      status,
      note: row.note.trim() || undefined,
    };

    addProductionReport(newReport);
    setDraftRows([createEmptyRow()]);
    setActiveSubTab('SAVED');

    let msg = `✅ ĐÃ GHI NHẬN BÁO CÁO NGHIỆM THU CHUYỀN ${row.lineId}!\n`;
    if (totalDamaged === 0) {
      msg += `• Sản xuất thành công không có hàng hỏng.`;
    } else {
      if (totalFromStock > 0) {
        msg += `• Kho còn tồn: Đã tự động xuất bù ${totalFromStock} đôi từ kho ➔ Trừ tồn kho Tab 5 với trạng thái 'Xuất bù'.\n`;
      }
      if (totalFromCustomer > 0) {
        msg += `• ⚠️ Kho hết tồn cho ${totalFromCustomer} đôi: Đã tự động đẩy dữ liệu sang Tab 4 (In Phiếu Bù) để yêu cầu Khách hàng cấp thêm!\n`;
      }
    }
    alert(msg, 'Đã Ghi Nhận Nghiệm Thu', 'success');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    if (!editingReport.poNumber.trim() || !editingReport.itemCode.trim()) {
      alert('Vui lòng nhập đầy đủ Mã PO và Mã Hàng!', 'Thiếu thông tin', 'warning');
      return;
    }

    const completedQ: Record<string, number> = {};
    const damagedQ: Record<string, number> = {};
    const fromStock: Record<string, number> = {};
    const fromCustomer: Record<string, number> = {};
    let totalDamaged = 0;
    let totalFromStock = 0;
    let totalFromCustomer = 0;

    sizes.forEach((s) => {
      const c = Number(editingReport.completedQuantities[s]) || 0;
      const d = Number(editingReport.damagedQuantities[s]) || 0;
      completedQ[s] = c;
      damagedQ[s] = d;

      if (d > 0) {
        totalDamaged += d;
        const available = getAvailableStock(editingReport.poNumber, editingReport.itemCode, s);
        if (available >= d) {
          fromStock[s] = d;
          totalFromStock += d;
        } else if (available > 0) {
          fromStock[s] = available;
          totalFromStock += available;
          const shortage = d - available;
          fromCustomer[s] = shortage;
          totalFromCustomer += shortage;
        } else {
          fromCustomer[s] = d;
          totalFromCustomer += d;
        }
      }
    });

    let status: ProductionReportRow['status'] = 'Đủ hàng';
    if (totalFromCustomer > 0) {
      status = 'Đề nghị KH cấp bù';
    } else if (totalFromStock > 0) {
      status = 'Xuất bù từ kho';
    }

    const updated: ProductionReportRow = {
      ...editingReport,
      poNumber: editingReport.poNumber.trim().toUpperCase(),
      itemCode: editingReport.itemCode.trim().toUpperCase(),
      completedQuantities: completedQ,
      damagedQuantities: damagedQ,
      compensationFromStock: fromStock,
      compensationFromCustomer: fromCustomer,
      status,
    };

    updateProductionReport(updated);
    toast(`✅ Đã cập nhật báo cáo nghiệm thu PO ${updated.poNumber}!`);
    setEditingReport(null);
  };

  // Filtered saved reports
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return currentCustomerProductionReports;
    const q = searchQuery.toLowerCase();
    return currentCustomerProductionReports.filter(
      (r) =>
        r.poNumber.toLowerCase().includes(q) ||
        r.itemCode.toLowerCase().includes(q) ||
        r.lineId.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [currentCustomerProductionReports, searchQuery]);

  // Export Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Báo Cáo',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Chuyền Sản Xuất',
      'ĐVT',
      'Phân Loại',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL',
      'Trạng Thái Xử Lý Hỏng',
    ];

    const dataRows: any[] = [];
    let stt = 1;
    filteredReports.forEach((rep) => {
      // Completed row
      const compTotal = sizes.reduce((sum, s) => sum + (rep.completedQuantities[s] || 0), 0);
      dataRows.push([
        stt,
        rep.reportDate,
        rep.poNumber,
        rep.itemCode,
        rep.lineId,
        rep.unit,
        'Thành phẩm đạt',
        ...sizes.map((s) => rep.completedQuantities[s] || 0),
        compTotal,
        rep.status,
      ]);

      // Damaged row
      const damTotal = sizes.reduce((sum, s) => sum + (rep.damagedQuantities[s] || 0), 0);
      if (damTotal > 0) {
        dataRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'Làm hư hỏng',
          ...sizes.map((s) => rep.damagedQuantities[s] || 0),
          damTotal,
          `Kho bù: ${sizes.reduce((s, k) => s + (rep.compensationFromStock[k] || 0), 0)} | KH bù: ${sizes.reduce((s, k) => s + (rep.compensationFromCustomer[k] || 0), 0)}`,
        ]);
      }
      stt++;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NghiemThuSX_Tab7');
    XLSX.writeFile(wb, `Tab7_NghiemThuSX_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    return filteredReports.map((r, idx) => {
      const cTotal = sizes.reduce((sum, s) => sum + (r.completedQuantities[s] || 0), 0);
      const dTotal = sizes.reduce((sum, s) => sum + (r.damagedQuantities[s] || 0), 0);
      return {
        stt: idx + 1,
        date: r.reportDate,
        voucherCode: r.lineId,
        poNumber: r.poNumber,
        code: r.itemCode,
        description: `Báo cáo ${r.lineId}: Đạt ${cTotal}, Hỏng ${dTotal}`,
        unit: r.unit,
        sizeQuantities: r.completedQuantities,
        totalQty: cTotal,
        note: `Trạng thái: ${r.status} ${r.note ? `• ${r.note}` : ''}`,
      };
    });
  }, [filteredReports, sizes]);

  return (
    <div className="space-y-4" ref={gridContainerRef}>
      {/* Sub-tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-300 shadow-2xs">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md">
          <button
            type="button"
            onClick={() => setActiveSubTab('ENTRY')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeSubTab === 'ENTRY'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>1. Phiếu Nghiệm Thu &amp; Xử Lý Hỏng Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('SAVED')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeSubTab === 'SAVED'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>2. Sổ Nghiệm Thu Sản Xuất Đã Lưu</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredReports.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {activeSubTab === 'ENTRY' ? (
            <button
              type="button"
              onClick={() => setActiveSubTab('SAVED')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 transition"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem Sổ Đã Lưu ({filteredReports.length}) ➔</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSubTab('ENTRY')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-md border border-sky-200 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Ghi Nhận Đợt Nghiệm Thu Mới</span>
            </button>
          )}

          {onNavigateToTab4 && (
            <button
              type="button"
              onClick={onNavigateToTab4}
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-md border border-rose-200 transition shadow-2xs"
            >
              <span>Nhận Bù Vật Tư (Tab 4) ➔</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: DATA ENTRY FORM */}
      {activeSubTab === 'ENTRY' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>TAB 7: GHI NHẬN SẢN XUẤT XONG (NGHIỆM THU &amp; XỬ LÝ HỎNG)</span>
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Rẽ nhánh: Kho còn tồn ➔ Tự trừ kho "Xuất bù" • Kho hết tồn ➔ Tự đẩy sang Tab 4
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveReport(draftRows[0])}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>LƯU NGHIỆM THU (ENTER)</span>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-4 space-y-4">
            {draftRows.map((row) => {
              const compTotal = getCompletedTotal(row);
              const damTotal = getDamagedTotal(row);

              return (
                <div
                  key={row.id}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveReport(row);
                    }
                  }}
                  className="space-y-4"
                >
                  {/* Row Identification */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Ngày Báo Cáo</label>
                      <input
                        type="text"
                        value={row.reportDate}
                        onChange={(e) => handleUpdateDraftField(row.id, 'reportDate', e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã PO</label>
                      <input
                        type="text"
                        list={`po-rep-list-${row.id}`}
                        value={row.poNumber}
                        onChange={(e) => handleUpdateDraftField(row.id, 'poNumber', e.target.value)}
                        placeholder="MÃ PO"
                        className="w-full text-xs font-mono font-bold text-sky-700 uppercase border border-slate-300 rounded p-1.5 bg-white"
                      />
                      <datalist id={`po-rep-list-${row.id}`}>
                        {currentCustomerPlanOrders.map((p) => (
                          <option key={p.id} value={p.poNumber}>
                            {p.poNumber} - {p.itemCode} ({p.description})
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã Hàng (TT Code)</label>
                      <input
                        type="text"
                        value={row.itemCode}
                        onChange={(e) => handleUpdateDraftField(row.id, 'itemCode', e.target.value)}
                        placeholder="Mã Hàng"
                        className="w-full text-xs font-mono font-bold text-slate-900 uppercase border border-slate-300 rounded p-1.5 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Chuyền Sản Xuất</label>
                      <select
                        value={row.lineId}
                        onChange={(e) => handleUpdateDraftField(row.id, 'lineId', e.target.value)}
                        className="w-full text-xs font-bold text-sky-900 border border-slate-300 rounded p-1.5 bg-white"
                      >
                        {LINE_OPTIONS.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">ĐVT</label>
                      <select
                        value={row.unit}
                        onChange={(e) => handleUpdateDraftField(row.id, 'unit', e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                      >
                        <option value="PRS">PRS</option>
                        <option value="đôi">đôi</option>
                        <option value="bộ">bộ</option>
                        <option value="chiếc">chiếc</option>
                        <option value="cái">cái</option>
                        <option value="mét">mét</option>
                        <option value="cuộn">cuộn</option>
                        <option value="sf">sf</option>
                        <option value="yard/yds">yard/yds</option>
                        {!['PRS', 'đôi', 'bộ', 'chiếc', 'cái', 'mét', 'cuộn', 'sf', 'yard/yds'].includes(row.unit) && row.unit && (
                          <option value={row.unit}>{row.unit}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Matrix Input Table for Completed & Damaged */}
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] border-b border-slate-300">
                        <tr>
                          <th className="p-2 border-r border-slate-300 min-w-[150px]">Hạng Mục Nghiệm Thu</th>
                          {sizes.map((s) => (
                            <th
                              key={s}
                              className="p-2 border-r border-slate-300 min-w-[50px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                            >
                              Size {s}
                            </th>
                          ))}
                          <th className="p-2 min-w-[90px] text-right font-bold bg-slate-100 text-slate-900">
                            TỔNG CỘNG
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {/* Row 1: Thành Phẩm Hoàn Thành Đạt */}
                        <tr className="bg-emerald-50/20">
                          <td className="p-2 border-r border-slate-200 font-bold text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>1. Số Lượng Hoàn Thành Đạt</span>
                          </td>
                          {sizes.map((s) => (
                            <td key={s} className="p-0 border-r border-slate-200">
                              <input
                                type="number"
                                min="0"
                                value={row.completedQuantities[s]}
                                onChange={(e) => handleUpdateSizeQty(row.id, 'completed', s, e.target.value)}
                                placeholder="0"
                                className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-emerald-950 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-right font-mono font-bold text-xs bg-emerald-100 text-emerald-950">
                            {compTotal > 0 ? compTotal.toLocaleString('vi-VN') : '0'}
                          </td>
                        </tr>

                        {/* Row 2: Số Lượng Làm Hư Hỏng */}
                        <tr className="bg-rose-50/20">
                          <td className="p-2 border-r border-slate-200 font-bold text-rose-800 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>2. Số Lượng Làm Hư Hỏng</span>
                          </td>
                          {sizes.map((s) => (
                            <td key={s} className="p-0 border-r border-slate-200">
                              <input
                                type="number"
                                min="0"
                                value={row.damagedQuantities[s]}
                                onChange={(e) => handleUpdateSizeQty(row.id, 'damaged', s, e.target.value)}
                                placeholder="0"
                                className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-rose-950 border-0 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-right font-mono font-bold text-xs bg-rose-100 text-rose-950">
                            {damTotal > 0 ? damTotal.toLocaleString('vi-VN') : '0'}
                          </td>
                        </tr>

                        {/* Row 3: Tồn Kho Hiện Có (Tham chiếu từ Tab 5 để đối chiếu tức thời) */}
                        <tr className="bg-slate-50 text-[11px] text-slate-500">
                          <td className="p-2 border-r border-slate-200 font-medium italic flex items-center gap-1.5">
                            <span>↳ Tồn kho hiện có (Tab 5)</span>
                          </td>
                          {sizes.map((s) => {
                            const stock = getAvailableStock(row.poNumber, row.itemCode, s);
                            return (
                              <td key={s} className="p-1 border-r border-slate-200 text-center font-mono font-semibold text-slate-600">
                                {stock}
                              </td>
                            );
                          })}
                          <td className="p-1 text-right font-mono text-slate-600 italic">
                            Đối chiếu
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Branching Logic Indicator Box */}
                  {damTotal > 0 && (
                    <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>KẾT QUẢ ĐỐI CHIẾU RẼ NHÁNH XỬ LÝ HỎNG TỰ ĐỘNG:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {sizes.map((s) => {
                          const d = typeof row.damagedQuantities[s] === 'number' ? Number(row.damagedQuantities[s]) : 0;
                          if (d <= 0) return null;
                          const avail = getAvailableStock(row.poNumber, row.itemCode, s);
                          const canCompFromStock = avail >= d;
                          return (
                            <div
                              key={s}
                              className={`p-2 rounded border ${
                                canCompFromStock
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                    : 'bg-rose-50 border-rose-300 text-rose-800'
                              }`}
                            >
                              <strong>Size {s}:</strong> Hỏng {d} đôi • Tồn kho hiện còn: {avail} đôi
                              <br />
                              {canCompFromStock ? (
                                <span className="font-semibold text-emerald-700">
                                  ➔ Kho đủ hàng: Tự động trừ tồn kho Tab 5 với trạng thái "Xuất bù".
                                </span>
                              ) : (
                                <span className="font-semibold text-rose-700">
                                  ➔ Kho thiếu {d - avail} đôi: Tự động đẩy phần thiếu sang Tab 4 để In Phiếu Bù!
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Note */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Ghi chú nguyên nhân hỏng / nghiệm thu</label>
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) => handleUpdateDraftField(row.id, 'note', e.target.value)}
                      placeholder="Nguyên nhân hư hỏng (VD: Thao tác ép nhiệt lệch màng, lỗi dao dập...)"
                      className="w-full text-xs border border-slate-300 rounded p-2 bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: SAVED REPORTS */}
      {activeSubTab === 'SAVED' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Sổ Nhật Ký Nghiệm Thu Sản Xuất Đã Lưu ({filteredReports.length} đợt)
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Lịch sử đánh giá tỷ lệ hỏng của từng Chuyền
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-44 sm:w-52">
                <input
                  type="text"
                  placeholder="Tìm PO, chuyền..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                <span>In HTML</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('ENTRY')}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Báo Cáo Nghiệm Thu Mới</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 whitespace-nowrap min-w-[85px]">Ngày BC</th>
                  <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (TT)</th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px] font-bold text-sky-900 bg-sky-50">
                    Chuyền SX
                  </th>
                  <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[80px] bg-emerald-50 text-emerald-900 font-bold">
                    SL Đạt
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[80px] bg-rose-50 text-rose-900 font-bold">
                    SL Hỏng
                  </th>
                  <th className="p-2 border-r border-slate-300 text-center min-w-[125px]">Trạng Thái Xử Lý</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Ghi Chú</th>
                  <th className="p-2 text-center w-16">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 text-xs italic">
                      Chưa có báo cáo nghiệm thu sản xuất nào.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((rep, idx) => {
                    const cTotal = sizes.reduce((sum, s) => sum + (rep.completedQuantities[s] || 0), 0);
                    const dTotal = sizes.reduce((sum, s) => sum + (rep.damagedQuantities[s] || 0), 0);

                    return (
                      <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                          {rep.reportDate}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 whitespace-nowrap">
                          {rep.poNumber}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                          {rep.itemCode}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-bold text-sky-900 bg-sky-50/40">
                          {rep.lineId}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-slate-500">
                          {rep.unit}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                          {cTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-rose-800 bg-rose-50/30">
                          {dTotal > 0 ? dTotal.toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              rep.status === 'Đủ hàng'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rep.status === 'Xuất bù từ kho'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {rep.status}
                          </span>
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-500 text-[11px] truncate max-w-[130px]">
                          {rep.note || '-'}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingReport({
                                  ...rep,
                                  completedQuantities: { ...rep.completedQuantities },
                                  damagedQuantities: { ...rep.damagedQuantities },
                                })
                              }
                              className="p-1 text-slate-400 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                              title="Chỉnh sửa báo cáo"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                confirm(`Bạn có chắc muốn xóa báo cáo nghiệm thu PO ${rep.poNumber} (${rep.itemCode}) tại ${rep.lineId}?`, () => {
                                  deleteProductionReport(rep.id);
                                  toast(`✅ Đã xóa báo cáo PO ${rep.poNumber}`);
                                });
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                              title="Xóa báo cáo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="PHIẾU NGHIỆM THU SẢN XUẤT VÀ XỬ LÝ HÀNG HỎNG (TAB 7)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="07-NT/HONG"
        sizes={sizes}
        rows={printRows}
      />

      {/* Edit Report Modal */}
      {editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-sky-400" />
                <span>CHỈNH SỬA BÁO CÁO NGHIỆM THU - PO: {editingReport.poNumber}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày báo cáo <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingReport.reportDate}
                    onChange={(e) => setEditingReport({ ...editingReport, reportDate: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chuyền sản xuất
                  </label>
                  <select
                    value={editingReport.lineId}
                    onChange={(e) => setEditingReport({ ...editingReport, lineId: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white focus:ring-1 focus:ring-sky-500 font-semibold text-slate-800"
                  >
                    {LINE_OPTIONS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã PO <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingReport.poNumber}
                    onChange={(e) => setEditingReport({ ...editingReport, poNumber: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã hàng (TT Code) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingReport.itemCode}
                    onChange={(e) => setEditingReport({ ...editingReport, itemCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={editingReport.note || ''}
                    onChange={(e) => setEditingReport({ ...editingReport, note: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* SL Đạt Hoàn Thành */}
              <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-900 uppercase">
                    1. Số Lượng Hoàn Thành (SL Đạt)
                  </span>
                  <span className="text-xs font-bold text-emerald-800 font-mono">
                    Tổng: {sizes.reduce((sum, s) => sum + (Number(editingReport.completedQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-emerald-300 rounded p-1.5 text-center">
                      <div className="text-[11px] font-bold text-slate-600 mb-1">Sz {s}</div>
                      <input
                        type="number"
                        min="0"
                        value={editingReport.completedQuantities[s] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setEditingReport({
                            ...editingReport,
                            completedQuantities: {
                              ...editingReport.completedQuantities,
                              [s]: typeof val === 'number' ? val : 0,
                            },
                          });
                        }}
                        className="w-full text-center text-xs font-mono font-bold border border-slate-200 rounded py-1 focus:ring-1 focus:ring-emerald-500 text-emerald-900"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SL Hư Hỏng */}
              <div className="border border-rose-200 rounded-lg p-3 bg-rose-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-900 uppercase">
                    2. Số Lượng Hư Hỏng (SL Hỏng)
                  </span>
                  <span className="text-xs font-bold text-rose-800 font-mono">
                    Tổng: {sizes.reduce((sum, s) => sum + (Number(editingReport.damagedQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-rose-300 rounded p-1.5 text-center">
                      <div className="text-[11px] font-bold text-slate-600 mb-1">Sz {s}</div>
                      <input
                        type="number"
                        min="0"
                        value={editingReport.damagedQuantities[s] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setEditingReport({
                            ...editingReport,
                            damagedQuantities: {
                              ...editingReport.damagedQuantities,
                              [s]: typeof val === 'number' ? val : 0,
                            },
                          });
                        }}
                        className="w-full text-center text-xs font-mono font-bold border border-slate-200 rounded py-1 focus:ring-1 focus:ring-rose-500 text-rose-900"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded shadow-xs transition cursor-pointer"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
