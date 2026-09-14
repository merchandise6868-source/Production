import React, { useState, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ProductionReportRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Save,
  Search,
  Trash2,
  Edit,
  X,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
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

export const Tab7ProductionReport: React.FC<Tab7ProductionReportProps> = () => {
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
  const [selectedForPrint, setSelectedForPrint] = useState<ProductionReportRow | null>(null);

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
      unit: currentCustomerPlanOrders[0]?.unit || 'PRS',
      completedQuantities: compInit,
      damagedQuantities: damInit,
      note: '',
    };
  };

  const [draftRow, setDraftRow] = useState<DraftReportRow>(createEmptyRow);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleUpdateDraftField = (field: keyof DraftReportRow, value: any) => {
    setDraftRow((prev) => {
      const updated = { ...prev, [field]: value };
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
    });
  };

  const handleUpdateSizeQty = (
    type: 'completed' | 'damaged',
    size: string,
    val: string
  ) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setDraftRow((prev) => {
      if (type === 'completed') {
        return {
          ...prev,
          completedQuantities: {
            ...prev.completedQuantities,
            [size]: num,
          },
        };
      } else {
        return {
          ...prev,
          damagedQuantities: {
            ...prev.damagedQuantities,
            [size]: num,
          },
        };
      }
    });
  };

  // Helper to get available stock from Tab 6 for a specific PO, itemCode & size
  const getAvailableStock = (poNumber: string, itemCode: string, size: string): number => {
    const key = `${poNumber.trim().toUpperCase()}__${itemCode.trim().toUpperCase()}`;
    const stockItem = currentCustomerRealtimeStock.find((s) => s.key === key);
    if (!stockItem) return 0;
    return stockItem.currentStockSizes[size] || 0;
  };

  // Calculate totals
  const draftCompTotal = useMemo(() => {
    return sizes.reduce((sum, s) => {
      const q = draftRow.completedQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  }, [draftRow.completedQuantities, sizes]);

  const draftDamTotal = useMemo(() => {
    return sizes.reduce((sum, s) => {
      const q = draftRow.damagedQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  }, [draftRow.damagedQuantities, sizes]);

  // Save report (Enter saves)
  const handleSaveReport = () => {
    if (!currentCustomer) return;
    if (!draftRow.poNumber.trim() || !draftRow.itemCode.trim()) {
      alert('Vui lòng nhập đầy đủ Mã PO và Mã Hàng!', 'Thiếu thông tin', 'warning');
      return;
    }

    if (draftCompTotal <= 0 && draftDamTotal <= 0) {
      alert('Vui lòng nhập số lượng hoàn thành đạt hoặc số lượng hư hỏng!', 'Thiếu số lượng', 'warning');
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
      const c = typeof draftRow.completedQuantities[s] === 'number' ? Number(draftRow.completedQuantities[s]) : 0;
      const d = typeof draftRow.damagedQuantities[s] === 'number' ? Number(draftRow.damagedQuantities[s]) : 0;
      completedQ[s] = c;
      damagedQ[s] = d;

      if (d > 0) {
        totalDamaged += d;
        const available = getAvailableStock(draftRow.poNumber, draftRow.itemCode, s);
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

    const newReport: ProductionReportRow = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer.id,
      reportDate: draftRow.reportDate.trim() || defaultDate,
      poNumber: draftRow.poNumber.trim().toUpperCase(),
      itemCode: draftRow.itemCode.trim().toUpperCase(),
      lineId: draftRow.lineId,
      unit: draftRow.unit || 'PRS',
      completedQuantities: completedQ,
      damagedQuantities: damagedQ,
      compensationFromStock: fromStock,
      compensationFromCustomer: fromCustomer,
      status,
      note: draftRow.note.trim() || undefined,
    };

    addProductionReport(newReport);
    setDraftRow(createEmptyRow());

    let msg = `✅ ĐÃ GHI NHẬN BÁO CÁO NGHIỆM THU CHUYỀN ${draftRow.lineId}!\n`;
    if (totalDamaged === 0) {
      msg += `• Sản xuất hoàn thành ${draftCompTotal} đôi đạt chuẩn không có hàng hỏng.`;
    } else {
      if (totalFromStock > 0) {
        msg += `• Kho còn tồn: Đã tự động xuất bù ${totalFromStock} đôi từ kho (Trừ tồn kho Tab 5).\n`;
      }
      if (totalFromCustomer > 0) {
        msg += `• Kho hết tồn cho ${totalFromCustomer} đôi: Đã tự động đẩy sang Tab 4 để In Phiếu Bù Khách hàng!\n`;
      }
    }
    toast(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveReport();
    }
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
    const list = selectedForPrint ? [selectedForPrint] : filteredReports;
    return list.map((r, idx) => {
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
  }, [selectedForPrint, filteredReports, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Excel Sheet Container */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Top Header & Toolbar */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 7: GHI NHẬN SẢN XUẤT XONG (NGHIỆM THU CHUYỀN)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Nhập số đạt &amp; hỏng, Enter lưu ngay trên bảng Excel • Tự động chuyển hàng hoàn thành sang Tab 8
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <div className="relative w-40 sm:w-48">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng, chuyền..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedForPrint(null);
                setShowPrintModal(true);
              }}
              disabled={filteredReports.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In Bảng</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredReports.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={handleSaveReport}
              disabled={!draftRow.poNumber.trim() || (draftCompTotal <= 0 && draftDamTotal <= 0)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>LƯU NGHIỆM THU (ENTER)</span>
            </button>
          </div>
        </div>

        {/* Unified Live Excel Table */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-9">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[90px]">Ngày BC *</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng *</th>
                <th className="p-2 border-r border-slate-300 min-w-[110px] bg-sky-50 text-sky-900 font-bold">
                  Chuyền SX *
                </th>
                <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Phân Loại</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[80px] text-right bg-emerald-100 text-emerald-950 font-bold">
                  TỔNG SL
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[140px] text-center">Trạng Thái Xử Lý</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Ghi Chú</th>
                <th className="p-2 text-center w-24">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {/* PHẦN 1: CÁC DÒNG BÁO CÁO ĐÃ LƯU (Có nút Sửa & Xóa) */}
              {filteredReports.map((rep, idx) => {
                const compTotal = sizes.reduce((sum, s) => sum + (rep.completedQuantities[s] || 0), 0);
                const damTotal = sizes.reduce((sum, s) => sum + (rep.damagedQuantities[s] || 0), 0);

                return (
                  <React.Fragment key={rep.id}>
                    {/* Dòng Thành phẩm hoàn thành đạt */}
                    <tr className="bg-white hover:bg-slate-50 transition-colors">
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-1.5 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px] align-middle bg-white"
                      >
                        {idx + 1}
                      </td>
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-2 border-r border-slate-200 whitespace-nowrap font-mono text-slate-700 align-middle bg-white"
                      >
                        {rep.reportDate}
                      </td>
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-sky-700 align-middle bg-white"
                      >
                        {rep.poNumber}
                      </td>
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-slate-800 align-middle bg-white"
                      >
                        {rep.itemCode}
                      </td>
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-2 border-r border-slate-200 whitespace-nowrap font-semibold text-sky-900 bg-sky-50/40 align-middle"
                      >
                        {rep.lineId}
                      </td>
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-2 border-r border-slate-200 text-center text-slate-600 align-middle bg-white"
                      >
                        {rep.unit}
                      </td>

                      <td className="p-2 border-r border-slate-200 font-semibold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Thành phẩm đạt</span>
                      </td>

                      {sizes.map((s) => {
                        const q = rep.completedQuantities[s] || 0;
                        return (
                          <td
                            key={s}
                            className={`p-2 border-r border-slate-200 text-center font-mono ${
                              q > 0 ? 'text-emerald-900 font-bold bg-emerald-50/40' : 'text-slate-300'
                            }`}
                          >
                            {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                          </td>
                        );
                      })}

                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-emerald-50 text-emerald-950">
                        {compTotal.toLocaleString('vi-VN')}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            rep.status === 'Đủ hàng'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : rep.status === 'Xuất bù từ kho'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300'
                              : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </td>

                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-2 border-r border-slate-200 text-slate-600 text-[11px] truncate max-w-[140px] align-middle bg-white"
                      >
                        {rep.note || '-'}
                      </td>

                      {/* Nút Sửa & Xóa trên mỗi báo cáo */}
                      <td
                        rowSpan={damTotal > 0 ? 2 : 1}
                        className="p-1.5 text-center whitespace-nowrap align-middle bg-white"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedForPrint(rep);
                              setShowPrintModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                            title="In báo cáo này"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

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

                    {/* Dòng Làm hư hỏng (nếu có) */}
                    {damTotal > 0 && (
                      <tr className="bg-rose-50/20 hover:bg-rose-50/40 transition-colors border-b-2 border-slate-300">
                        <td className="p-2 border-r border-slate-200 font-semibold text-rose-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>Làm hư hỏng</span>
                        </td>

                        {sizes.map((s) => {
                          const q = rep.damagedQuantities[s] || 0;
                          return (
                            <td
                              key={s}
                              className={`p-2 border-r border-slate-200 text-center font-mono ${
                                q > 0 ? 'text-rose-900 font-bold bg-rose-100/60' : 'text-slate-300'
                              }`}
                            >
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-rose-100 text-rose-950">
                          {damTotal.toLocaleString('vi-VN')}
                        </td>

                        <td className="p-2 border-r border-slate-200 text-center text-[10px] text-slate-600">
                          Kho bù: <strong>{sizes.reduce((s, k) => s + (rep.compensationFromStock[k] || 0), 0)}</strong> | KH bù: <strong>{sizes.reduce((s, k) => s + (rep.compensationFromCustomer[k] || 0), 0)}</strong>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* PHẦN 2: DÒNG NHẬP LIỆU TRỰC TIẾP TRÊN PHIẾU (Enter để lưu) */}
              {/* Row 1: Thông tin chung + Số lượng Thành Phẩm Đạt */}
              <tr className="bg-[#f0fdf4] hover:bg-[#dcfce7] transition-colors border-t-2 border-emerald-400">
                <td rowSpan={2} className="p-1.5 border-r border-emerald-300 text-center font-bold text-emerald-800 font-mono text-[11px] align-middle bg-[#f0fdf4]">
                  <span className="inline-block px-1 bg-emerald-200 text-emerald-900 rounded text-[10px]">
                    + Mới
                  </span>
                </td>

                <td rowSpan={2} className="p-0 border-r border-emerald-300 align-middle bg-[#f0fdf4]">
                  <input
                    type="text"
                    value={draftRow.reportDate}
                    onChange={(e) => handleUpdateDraftField('reportDate', e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </td>

                {/* Mã PO with suggestions */}
                <td rowSpan={2} className="p-0 border-r border-emerald-300 align-middle bg-[#f0fdf4]">
                  <input
                    type="text"
                    list="po-report-list"
                    value={draftRow.poNumber}
                    onChange={(e) => handleUpdateDraftField('poNumber', e.target.value)}
                    placeholder="MÃ PO..."
                    className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-800 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                  <datalist id="po-report-list">
                    {currentCustomerPlanOrders.map((p) => (
                      <option key={p.id} value={p.poNumber}>
                        {p.poNumber} - {p.itemCode}
                      </option>
                    ))}
                  </datalist>
                </td>

                <td rowSpan={2} className="p-0 border-r border-emerald-300 align-middle bg-[#f0fdf4]">
                  <input
                    type="text"
                    value={draftRow.itemCode}
                    onChange={(e) => handleUpdateDraftField('itemCode', e.target.value)}
                    placeholder="Mã Hàng"
                    className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-900 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </td>

                <td rowSpan={2} className="p-0 border-r border-emerald-300 bg-sky-50/50 align-middle">
                  <select
                    value={draftRow.lineId}
                    onChange={(e) => handleUpdateDraftField('lineId', e.target.value)}
                    className="w-full h-8 px-2 text-xs font-bold text-sky-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white cursor-pointer"
                  >
                    {LINE_OPTIONS.map((line) => (
                      <option key={line} value={line}>
                        {line}
                      </option>
                    ))}
                  </select>
                </td>

                <td rowSpan={2} className="p-0 border-r border-emerald-300 align-middle bg-[#f0fdf4]">
                  <input
                    type="text"
                    value={draftRow.unit}
                    onChange={(e) => handleUpdateDraftField('unit', e.target.value)}
                    className="w-full h-8 px-1 text-xs text-center bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </td>

                <td className="p-2 border-r border-emerald-300 font-bold text-emerald-900 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>1. Đạt chuẩn (Nhập)</span>
                </td>

                {/* Nhập số lượng đạt chuẩn */}
                {sizes.map((s) => (
                  <td key={s} className="p-0 border-r border-emerald-300">
                    <input
                      type="number"
                      min="0"
                      value={draftRow.completedQuantities[s]}
                      onChange={(e) => handleUpdateSizeQty('completed', s, e.target.value)}
                      placeholder="-"
                      className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-emerald-950 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </td>
                ))}

                <td className="p-2 border-r border-emerald-300 text-right font-mono font-bold text-xs bg-emerald-200 text-emerald-950">
                  {draftCompTotal > 0 ? draftCompTotal.toLocaleString('vi-VN') : '-'}
                </td>

                <td className="p-2 border-r border-emerald-300 text-center text-[10px] text-emerald-800 font-semibold">
                  Tồn Tab 5 trừ tự động
                </td>

                <td rowSpan={2} className="p-0 border-r border-emerald-300 align-middle bg-[#f0fdf4]">
                  <input
                    type="text"
                    value={draftRow.note}
                    onChange={(e) => handleUpdateDraftField('note', e.target.value)}
                    placeholder="Ghi chú nguyên nhân hỏng (Enter lưu)..."
                    className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                  />
                </td>

                <td rowSpan={2} className="p-1.5 text-center whitespace-nowrap align-middle bg-[#f0fdf4]">
                  <button
                    type="button"
                    onClick={handleSaveReport}
                    disabled={!draftRow.poNumber.trim() || (draftCompTotal <= 0 && draftDamTotal <= 0)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded shadow-2xs transition font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                    title="Lưu báo cáo nghiệm thu này (Enter)"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu (Enter)</span>
                  </button>
                </td>
              </tr>

              {/* Row 2: Số lượng Làm Hư Hỏng (Tùy chọn) */}
              <tr className="bg-[#fff1f2] hover:bg-[#ffe4e6] transition-colors border-b-2 border-emerald-400">
                <td className="p-2 border-r border-rose-300 font-bold text-rose-900 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>2. Làm hỏng (nếu có)</span>
                </td>

                {sizes.map((s) => (
                  <td key={s} className="p-0 border-r border-rose-300">
                    <input
                      type="number"
                      min="0"
                      value={draftRow.damagedQuantities[s]}
                      onChange={(e) => handleUpdateSizeQty('damaged', s, e.target.value)}
                      placeholder="-"
                      className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-rose-950 border-0 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </td>
                ))}

                <td className="p-2 border-r border-rose-300 text-right font-mono font-bold text-xs bg-rose-200 text-rose-950">
                  {draftDamTotal > 0 ? draftDamTotal.toLocaleString('vi-VN') : '-'}
                </td>

                <td className="p-2 border-r border-rose-300 text-center text-[10px] text-rose-800 font-semibold">
                  {draftDamTotal > 0 ? 'Tự động tính bù kho/KH' : '-'}
                </td>
              </tr>

              {/* DÒNG TỔNG CỘNG TOÀN BỘ BẢNG */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-400">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG THÀNH PHẨM ĐÃ NGHIỆM THU:
                </td>
                {sizes.map((s) => {
                  const sComp = filteredReports.reduce((sum, r) => sum + (r.completedQuantities[s] || 0), 0);
                  return (
                    <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-950">
                      {sComp > 0 ? sComp.toLocaleString('vi-VN') : '-'}
                    </td>
                  );
                })}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-200">
                  {filteredReports.reduce((sum, r) => sum + sizes.reduce((sub, s) => sub + (r.completedQuantities[s] || 0), 0), 0).toLocaleString('vi-VN')}
                </td>
                <td colSpan={3} className="p-2 text-slate-600 text-[11px] italic">
                  Tổng {filteredReports.length} đợt nghiệm thu chuyền
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="text-[11px]">
            <span>💡 <strong>Mẹo:</strong> Nhập số lượng đạt chuẩn (và số lượng hỏng nếu có) rồi nhấn <strong>Enter</strong> để lưu ngay vào bảng. Thành phẩm đạt sẽ tự động đồng bộ sang Tab 8!</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng báo cáo đã lưu: <strong className="text-emerald-700">{filteredReports.length}</strong> đợt
          </div>
        </div>
      </div>

      {/* MODAL SỬA BÁO CÁO NGHIỆM THU */}
      {editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-800 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-emerald-300" />
                <span>CHỈNH SỬA BÁO CÁO NGHIỆM THU - PO: {editingReport.poNumber}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingReport(null)}
                className="text-slate-300 hover:text-white p-1 rounded transition cursor-pointer"
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
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chuyền sản xuất
                  </label>
                  <select
                    value={editingReport.lineId}
                    onChange={(e) => setEditingReport({ ...editingReport, lineId: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white focus:ring-1 focus:ring-emerald-500 font-semibold text-slate-800"
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
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
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
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
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
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* SL Đạt Hoàn Thành */}
              <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-900 uppercase">
                    1. Số lượng hoàn thành đạt theo Size
                  </span>
                  <span className="text-xs font-bold text-emerald-800 font-mono">
                    Tổng đạt: {sizes.reduce((sum, s) => sum + (Number(editingReport.completedQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-slate-300 rounded p-1.5 text-center">
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
                        className="w-full text-center text-xs font-mono font-bold border border-slate-200 rounded py-1 focus:ring-1 focus:ring-emerald-500"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SL Làm Hư Hỏng */}
              <div className="border border-rose-200 rounded-lg p-3 bg-rose-50/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-900 uppercase">
                    2. Số lượng làm hư hỏng theo Size (nếu có)
                  </span>
                  <span className="text-xs font-bold text-rose-800 font-mono">
                    Tổng hỏng: {sizes.reduce((sum, s) => sum + (Number(editingReport.damagedQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-slate-300 rounded p-1.5 text-center">
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
                        className="w-full text-center text-xs font-mono font-bold border border-slate-200 rounded py-1 focus:ring-1 focus:ring-rose-500"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

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
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition cursor-pointer"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IN PHIẾU NGHIỆM THU */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setSelectedForPrint(null);
        }}
        documentTitle={selectedForPrint ? `BÁO CÁO NGHIỆM THU CHUYỀN ${selectedForPrint.lineId}` : 'BẢNG TỔNG HỢP BÁO CÁO NGHIỆM THU SẢN XUẤT'}
        documentNumber={selectedForPrint ? `BB-NT-${selectedForPrint.poNumber}` : 'TH-NGHIEM-THU'}
        dateStr={selectedForPrint?.reportDate || defaultDate}
        customerName={currentCustomer?.name || 'Khách hàng'}
        poNumber={selectedForPrint?.poNumber}
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
