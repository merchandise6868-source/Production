import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { DiscrepancyRow } from '../../types';
import {
  Printer,
  Download,
  Search,
  Scale,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

interface Tab3DiscrepancyProps {
  onNavigateToTab4?: () => void;
}

export const Tab3Discrepancy: React.FC<Tab3DiscrepancyProps> = ({ onNavigateToTab4 }) => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerDiscrepancies,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEGATIVE_ONLY' | 'MATCH_ONLY'>('ALL');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Filtered rows
  const filteredDiscrepancies = useMemo(() => {
    return currentCustomerDiscrepancies.filter((row) => {
      const matchSearch =
        !searchQuery.trim() ||
        row.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.voucherCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterMode === 'NEGATIVE_ONLY') return row.hasNegative;
      if (filterMode === 'MATCH_ONLY') return !row.hasNegative && row.totalDiff === 0;
      return true;
    });
  }, [currentCustomerDiscrepancies, searchQuery, filterMode]);

  // Negative rows count
  const negativeRowsCount = useMemo(() => {
    return currentCustomerDiscrepancies.filter((r) => r.hasNegative).length;
  }, [currentCustomerDiscrepancies]);

  // Total discrepancy sum across filtered rows
  const diffSizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredDiscrepancies.reduce((sum, r) => {
        return sum + (r.diffSizes[s] || 0);
      }, 0);
    });
    return totals;
  }, [filteredDiscrepancies, sizes]);

  const grandTotalDiff = useMemo(() => {
    return filteredDiscrepancies.reduce((sum, r) => sum + r.totalDiff, 0);
  }, [filteredDiscrepancies]);

  // Export Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Nhập',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Số Phiếu KH',
      'Diễn Giải',
      'ĐVT',
      ...sizes.map((s) => `Chênh Lệch Size ${s}`),
      'Tổng Chênh Lệch',
      'Cần Cấp Bù?',
      'SL Trên Phiếu (Tab 1)',
      'SL Thực Nhận (Tab 2)',
    ];

    const dataRows = filteredDiscrepancies.map((r, idx) => [
      idx + 1,
      r.receiptDate,
      r.poNumber,
      r.itemCode,
      r.voucherCode,
      r.description,
      r.unit,
      ...sizes.map((s) => r.diffSizes[s] || 0),
      r.totalDiff,
      r.needsCompensation ? 'CẦN BÙ [X]' : 'Khớp / Thừa',
      r.totalPlan,
      r.totalActual,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoChenhLech_Tab3');
    XLSX.writeFile(wb, `Tab3_SoChenhLech_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    return filteredDiscrepancies.map((r, idx) => {
      return {
        stt: idx + 1,
        date: r.receiptDate,
        voucherCode: r.voucherCode,
        poNumber: r.poNumber,
        code: r.itemCode,
        description: r.description,
        unit: r.unit,
        sizeQuantities: r.diffSizes,
        totalQty: r.totalDiff,
        note: r.needsCompensation ? 'Cần Khách hàng cấp bù nguyên liệu' : 'Số liệu đủ/khớp',
      };
    });
  }, [filteredDiscrepancies]);

  return (
    <div className="space-y-4">
      {/* Alert Banner if any negative discrepancies exist */}
      {negativeRowsCount > 0 ? (
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-rose-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-bold">
                Phát hiện {negativeRowsCount} đơn hàng giao THIẾU (Chênh lệch âm &lt; 0)
              </p>
              <p className="text-[11px] text-rose-600">
                Hệ thống đã tự động tích dấu BÙ? [x] và sẵn sàng chuyển sang Tab 4 để in phiếu đề nghị cấp bù.
              </p>
            </div>
          </div>

          {onNavigateToTab4 && (
            <button
              type="button"
              onClick={onNavigateToTab4}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
            >
              <span>Chuyển sang Tab 4 (In Phiếu Bù)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-center justify-between gap-3 text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">
              Tuyệt vời! Toàn bộ số lượng thực nhận đang khớp hoặc thừa so với phiếu ({filteredDiscrepancies.length} đơn).
            </span>
          </div>
        </div>
      )}

      {/* Main Grid Card (Structure identical to Tab 1 & Tab 2) */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-600" />
              <span>TAB 3: SỐ VẬT TƯ CHÊNH LỆCH (TỰ ĐỘNG TÍNH & CẢNH BÁO ÂM)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Công thức: Thực Nhận (Tab 2) - Trên Phiếu (Tab 1)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
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

            {onNavigateToTab4 && negativeRowsCount > 0 && (
              <button
                type="button"
                onClick={onNavigateToTab4}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
              >
                <span>Sang Tab 4 Nhận Bù Vật Tư ({negativeRowsCount}) ➔</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng, số phiếu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Segmented Filter */}
            <div className="inline-flex rounded-md shadow-2xs bg-white border border-slate-300 p-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({currentCustomerDiscrepancies.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('NEGATIVE_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'NEGATIVE_ONLY'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Cần Bù ({negativeRowsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('MATCH_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'MATCH_ONLY'
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Khớp Đủ
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-600">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              Ô đỏ / số âm (-): Khách giao thiếu
            </span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Số dương (+): Khách giao thừa
            </span>
          </div>
        </div>

        {/* Grid Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[85px] bg-slate-100 text-slate-500">Ngày Nhập</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px] bg-slate-100 text-slate-500">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px] bg-slate-100 text-slate-500">Mã Hàng (TT)</th>
                <th className="p-2 border-r border-slate-300 min-w-[115px] bg-slate-100 text-slate-500">Số Phiếu KH</th>
                <th className="p-2 border-r border-slate-300 min-w-[145px] bg-slate-100 text-slate-500">Diễn Giải</th>
                <th className="p-2 border-r border-slate-300 text-center w-14 bg-slate-100 text-slate-500">ĐVT</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-slate-100 text-slate-900 font-bold">
                  TỔNG LỆCH
                </th>
                <th className="p-2 border-r border-slate-300 text-center min-w-[75px] bg-rose-50 text-rose-900 font-bold">
                  BÙ? [X]
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[65px] text-right bg-slate-50 text-slate-500">
                  SL Phiếu
                </th>
                <th className="p-2 text-right min-w-[65px] bg-slate-50 text-slate-500">
                  Thực Nhận
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredDiscrepancies.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 4} className="p-8 text-center text-slate-400 text-xs italic">
                    Chưa có số liệu đối soát. Vui lòng kiểm tra Tab 1 và Tab 2!
                  </td>
                </tr>
              ) : (
                filteredDiscrepancies.map((row, idx) => {
                  return (
                    <tr
                      key={row.planOrderId}
                      className={`hover:bg-slate-50 transition-colors ${
                        row.hasNegative ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70 whitespace-nowrap">
                        {row.receiptDate}
                      </td>

                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 bg-slate-50/70 whitespace-nowrap">
                        {row.poNumber}
                      </td>

                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-800 bg-slate-50/70">
                        {row.itemCode}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70">
                        {row.voucherCode || '-'}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70 truncate max-w-[150px]">
                        {row.description}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-center text-slate-500 bg-slate-50/70 font-medium">
                        {row.unit}
                      </td>

                      {/* Discrepancy per size with automatic Red coloring if negative */}
                      {sizes.map((s) => {
                        const diff = row.diffSizes[s] || 0;
                        const isNeg = diff < 0;
                        const isPos = diff > 0;

                        return (
                          <td
                            key={s}
                            className={`p-2 border-r border-slate-200 text-center font-mono font-bold text-xs ${
                              isNeg
                                ? 'bg-rose-100 text-rose-700 font-extrabold border-rose-300'
                                : isPos
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'text-slate-300'
                            }`}
                          >
                            {diff !== 0 ? (diff > 0 ? `+${diff}` : `${diff}`) : '-'}
                          </td>
                        );
                      })}

                      {/* Total Discrepancy */}
                      <td
                        className={`p-2 border-r border-slate-200 text-right font-mono font-bold text-xs ${
                          row.totalDiff < 0
                            ? 'bg-rose-100 text-rose-800 font-extrabold'
                            : row.totalDiff > 0
                            ? 'bg-emerald-100 text-emerald-900 font-extrabold'
                            : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {row.totalDiff !== 0
                          ? row.totalDiff > 0
                            ? `+${row.totalDiff}`
                            : `${row.totalDiff}`
                          : '0'}
                      </td>

                      {/* Cột BÙ? (Tự động tích [x] và tô đỏ nếu có size âm) */}
                      <td className="p-2 border-r border-slate-200 text-center">
                        {row.needsCompensation ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-2xs">
                            [X] BÙ
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-semibold">Khớp</span>
                        )}
                      </td>

                      {/* Total Plan */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono text-xs text-slate-500 bg-slate-50/50">
                        {row.totalPlan.toLocaleString('vi-VN')}
                      </td>

                      {/* Total Actual */}
                      <td className="p-2 text-right font-mono text-xs text-slate-800 bg-slate-50/50">
                        {row.totalActual.toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Summary Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CHÊNH LỆCH:
                </td>
                {sizes.map((s) => {
                  const d = diffSizeTotals[s] || 0;
                  return (
                    <td
                      key={s}
                      className={`p-2 border-r border-slate-300 text-center font-mono font-bold text-xs ${
                        d < 0 ? 'text-rose-700 font-extrabold' : d > 0 ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {d !== 0 ? (d > 0 ? `+${d}` : `${d}`) : '-'}
                    </td>
                  );
                })}
                <td
                  className={`p-2 border-r border-slate-300 text-right font-mono font-bold text-xs ${
                    grandTotalDiff < 0
                      ? 'text-rose-800 font-extrabold'
                      : grandTotalDiff > 0
                      ? 'text-emerald-800'
                      : 'text-slate-800'
                  }`}
                >
                  {grandTotalDiff !== 0 ? (grandTotalDiff > 0 ? `+${grandTotalDiff}` : `${grandTotalDiff}`) : '0'}
                </td>
                <td colSpan={3} className="p-2 text-slate-500 text-[11px] italic">
                  {negativeRowsCount > 0 ? `${negativeRowsCount} đơn tự động chuyển Tab 4` : 'Khớp 100%'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 Số liệu chênh lệch được cập nhật thời gian thực ngay khi gõ số liệu ở Tab 1 hoặc Tab 2.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Hiển thị <strong>{filteredDiscrepancies.length}</strong> đơn • Đơn thiếu cần bù: <strong className="text-rose-600">{negativeRowsCount}</strong>
          </div>
        </div>
      </div>

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="BẢNG ĐỐI SOÁT CHÊNH LỆCH VẬT TƯ (THỰC NHẬN - TRÊN PHIẾU)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="03-CL/VT"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
