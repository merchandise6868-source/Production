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
  ChevronDown,
  ChevronUp,
  Layers,
  Info,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

export const Tab3Discrepancy: React.FC = () => {
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
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEGATIVE_ONLY' | 'MATCH_ONLY' | 'SURPLUS_ONLY'>('ALL');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [expandedPoKey, setExpandedPoKey] = useState<string | null>(null);

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
      if (filterMode === 'SURPLUS_ONLY') return !row.hasNegative && row.totalDiff > 0;
      return true;
    });
  }, [currentCustomerDiscrepancies, searchQuery, filterMode]);

  // Negative rows count (thiếu cần bù)
  const negativeRowsCount = useMemo(() => {
    return currentCustomerDiscrepancies.filter((r) => r.hasNegative).length;
  }, [currentCustomerDiscrepancies]);

  // Match rows count (khớp đủ 100%)
  const matchRowsCount = useMemo(() => {
    return currentCustomerDiscrepancies.filter((r) => !r.hasNegative && r.totalDiff === 0).length;
  }, [currentCustomerDiscrepancies]);

  // Surplus rows count (giao thừa)
  const surplusRowsCount = useMemo(() => {
    return currentCustomerDiscrepancies.filter((r) => !r.hasNegative && r.totalDiff > 0).length;
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

  const grandTotalOriginalPlan = useMemo(() => {
    return filteredDiscrepancies.reduce((sum, r) => sum + (r.originalPlanQty ?? r.totalPlan), 0);
  }, [filteredDiscrepancies]);

  const grandTotalCompActual = useMemo(() => {
    return filteredDiscrepancies.reduce((sum, r) => sum + (r.compensationActualQty ?? 0), 0);
  }, [filteredDiscrepancies]);

  const grandTotalActual = useMemo(() => {
    return filteredDiscrepancies.reduce((sum, r) => sum + r.totalActual, 0);
  }, [filteredDiscrepancies]);

  // Export Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Nhập',
      'Mã PO',
      'Code Vật tư',
      'Trạng Thái PO',
      'Số Phiếu KH',
      'Diễn Giải',
      'ĐVT',
      ...sizes.map((s) => `Chênh Lệch Size ${s}`),
      'Tổng Chênh Lệch',
      'Cần Cấp Bù?',
      'SL Đơn Gốc (Tab 1)',
      'Đã Nhận Bù (Tab 2)',
      'Tổng Đã Nhận (Tab 2)',
    ];

    const dataRows = filteredDiscrepancies.map((r, idx) => [
      idx + 1,
      r.receiptDate,
      r.poNumber,
      r.itemCode,
      r.statusText || (r.hasNegative ? 'Thiếu cần bù' : r.totalDiff > 0 ? 'Giao thừa' : 'Khớp đủ'),
      r.voucherCode,
      r.description,
      r.unit,
      ...sizes.map((s) => r.diffSizes[s] || 0),
      r.totalDiff,
      r.needsCompensation ? 'CẦN BÙ [X]' : 'Khớp / Thừa',
      r.originalPlanQty ?? r.totalPlan,
      r.compensationActualQty ?? 0,
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
        note: r.needsCompensation
          ? `CẦN BÙ [X] (Gốc: ${r.originalPlanQty ?? r.totalPlan}, Đã nhận: ${r.totalActual})`
          : `Khớp đủ (Tổng nhận: ${r.totalActual})`,
      };
    });
  }, [filteredDiscrepancies]);

  const toggleExpand = (poKey: string) => {
    setExpandedPoKey((prev) => (prev === poKey ? null : poKey));
  };

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
                Hệ thống tự động đánh dấu <strong>Cần Bù [X]</strong> • Khi giao tiếp các lần sau (Lần 2, Lần 3...) của PO, số chênh lệch tự động cộng dồn về 0 khi đủ. Trạng thái <strong>Hàng bù (mua)</strong> được quản lý như một vật tư độc lập.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 flex items-center justify-between gap-3 text-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">
              Tuyệt vời! Toàn bộ số lượng thực nhận đang khớp hoặc thừa so với phiếu ({filteredDiscrepancies.length} PO).
            </span>
          </div>
        </div>
      )}

      {/* Main Grid Card */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-sky-600" />
              <span>TAB 3: SỐ VẬT TƯ CHÊNH LỆCH (TỰ ĐỘNG TÍNH & CẢNH BÁO ÂM)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Group by theo PO • Công thức: Tổng Thực Nhận Lũy Kế (Tab 2) - Kế Hoạch Đơn Gốc (Tab 1)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In HTML</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Tìm PO, Code Vật tư, số phiếu..."
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
                className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition ${
                  filterMode === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({currentCustomerDiscrepancies.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('NEGATIVE_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition ${
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
                className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition ${
                  filterMode === 'MATCH_ONLY'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Khớp Đủ ({matchRowsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('SURPLUS_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition ${
                  filterMode === 'SURPLUS_ONLY'
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-sky-700 hover:bg-sky-50'
                }`}
              >
                Giao Thừa ({surplusRowsCount})
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
              0: Đã nhận đủ
            </span>
            <span className="text-slate-300">|</span>
            <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-600">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
              Số dương (+): Giao thừa
            </span>
          </div>
        </div>

        {/* Grid Table */}
        <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[85px] bg-slate-100 text-slate-500">Ngày Nhập</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px] bg-slate-100 text-slate-500">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px] bg-slate-100 text-slate-500">Code Vật tư</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px] text-center bg-indigo-50/80 text-indigo-900 font-bold">
                  Trạng Thái PO
                </th>
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
                <th className="p-2 border-r border-slate-300 min-w-[75px] text-right bg-sky-50 text-sky-900 font-bold" title="Kế hoạch đơn gốc (Hàng đơn Tab 1)">
                  SL Đơn Gốc
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[70px] text-right bg-purple-50 text-purple-900 font-bold" title="Hàng bù đã nhận (Hàng bù Tab 2)">
                  Đã Nhận Bù
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[80px] text-right bg-emerald-50 text-emerald-950 font-bold" title="Tổng thực nhận lũy kế = Gốc + Bù">
                  Tổng Đã Nhận
                </th>
                <th className="p-2 text-center w-16 bg-slate-50 text-slate-600">
                  Chi Tiết
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredDiscrepancies.length === 0 ? (
                <tr>
                  <td colSpan={8 + sizes.length + 5} className="p-8 text-center text-slate-400 text-xs italic">
                    Chưa có số liệu đối soát. Vui lòng kiểm tra Tab 1 và Tab 2!
                  </td>
                </tr>
              ) : (
                filteredDiscrepancies.map((row, idx) => {
                  const isExpanded = expandedPoKey === row.planOrderId;
                  const originalPlan = row.originalPlanQty ?? row.totalPlan;
                  const compActual = row.compensationActualQty ?? 0;

                  return (
                    <React.Fragment key={row.planOrderId}>
                      <tr
                        className={`transition-colors ${
                          row.hasNegative ? 'bg-rose-50/40 hover:bg-rose-50/70' : isExpanded ? 'bg-indigo-50/20' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70 whitespace-nowrap">
                          {row.receiptDate}
                        </td>

                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 bg-slate-50/70 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.planOrderId)}
                            className="inline-flex items-center gap-1.5 hover:underline cursor-pointer text-left"
                            title="Bấm để xem chi tiết các đợt giao nhận của PO này"
                          >
                            <span>{row.poNumber}</span>
                            {row.isCompensationItem && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                Hàng bù (mua)
                              </span>
                            )}
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-sky-600" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </td>

                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-800 bg-slate-50/70">
                          {row.itemCode}
                        </td>

                        {/* Trạng Thái PO (Huy hiệu chuẩn) */}
                        <td className="p-1.5 border-r border-slate-200 text-center">
                          {row.hasNegative ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              🔴 Thiếu cần bù
                            </span>
                          ) : row.totalDiff > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                              🔵 Giao thừa (+{row.totalDiff})
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              🟢 Đã đủ (Khớp)
                            </span>
                          )}
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

                        {/* Discrepancy per size with automatic coloring */}
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
                                  ? 'bg-sky-50 text-sky-700 font-bold'
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
                              ? 'bg-sky-100 text-sky-900 font-extrabold'
                              : 'bg-emerald-50 text-emerald-800 font-bold'
                          }`}
                        >
                          {row.totalDiff !== 0 ? (row.totalDiff > 0 ? `+${row.totalDiff}` : `${row.totalDiff}`) : '0'}
                        </td>

                        {/* Cột BÙ? (Tự động tích [x] và tô đỏ nếu có size âm) */}
                        <td className="p-2 border-r border-slate-200 text-center">
                          {row.needsCompensation ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white shadow-2xs">
                              [X] BÙ
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-600 font-bold">✓ Đủ</span>
                          )}
                        </td>

                        {/* Total Original Plan */}
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs text-sky-900 bg-sky-50/40">
                          {originalPlan.toLocaleString('vi-VN')}
                        </td>

                        {/* Total Comp Actual Received */}
                        <td className="p-2 border-r border-slate-200 text-right font-mono text-xs text-purple-900 bg-purple-50/40">
                          {compActual > 0 ? compActual.toLocaleString('vi-VN') : '-'}
                        </td>

                        {/* Total Actual (Lũy kế) */}
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-50/40">
                          {row.totalActual.toLocaleString('vi-VN')}
                        </td>

                        {/* Action: Expand Detail */}
                        <td className="p-1 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.planOrderId)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-sky-700 hover:bg-sky-50 rounded border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1 mx-auto"
                            title="Xem lịch sử các phiếu giao & nhận của PO này"
                          >
                            <Layers className="w-3 h-3 text-sky-600" />
                            <span>{isExpanded ? 'Đóng' : 'Xem'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Sub-row: Chi tiết các đợt giao nhận của PO này */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b-2 border-slate-300">
                          <td colSpan={8 + sizes.length + 5} className="p-3.5 pl-8">
                            <div className="bg-white rounded-lg border border-slate-300 p-3.5 space-y-3 shadow-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                    <Info className="w-3.5 h-3.5 text-sky-600" />
                                    LỊCH SỬ GIAO NHẬN CHI TIẾT CỦA MÃ PO:
                                    <span className="font-mono text-sky-700 underline">{row.poNumber}</span>
                                    {row.isCompensationItem && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                        Hàng bù (mua)
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    (Vật tư: {row.itemCode} - {row.description})
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                                  Công thức: Thực nhận ({row.totalActual}) - Đơn gốc ({originalPlan}) = <strong>{row.totalDiff}</strong>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                {/* Tab 1 Slips */}
                                <div className="border border-slate-200 rounded-lg p-2.5 bg-sky-50/30 space-y-2">
                                  <h5 className="font-bold text-[11px] text-sky-900 uppercase flex items-center justify-between">
                                    <span>TAB 1: Các Phiếu Giao ({row.matchingPlans?.length || 0} phiếu)</span>
                                    <span className="font-mono text-xs text-sky-800">Mục tiêu gốc (Lần 1): {originalPlan}</span>
                                  </h5>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {row.matchingPlans?.map((p, pIdx) => (
                                      <div key={p.id} className="p-2 bg-white rounded border border-sky-200/80 text-[11px] space-y-1">
                                        <div className="flex items-center justify-between font-medium">
                                          <span>
                                            #{pIdx + 1} • <strong className="text-amber-800">Lần {p.round || 1}</strong> • Ngày: {p.receiptDate} • Phiếu: {p.voucherCode || 'N/A'}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            p.status === 'Hàng bù (mua)' || p.status === 'Hàng bù'
                                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                              : 'bg-sky-100 text-sky-800 border border-sky-200'
                                          }`}>
                                            {p.status || 'Hàng đơn'}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-600">
                                          {sizes.map((s) => {
                                            const q = p.sizeQuantities?.[s];
                                            if (!q) return null;
                                            return <span key={s} className="bg-slate-100 px-1 py-0.5 rounded">S{s}: {q}</span>;
                                          })}
                                          <span className="font-bold text-sky-800 ml-auto">Tổng: {p.totalQty}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Tab 2 Receives */}
                                <div className="border border-slate-200 rounded-lg p-2.5 bg-emerald-50/30 space-y-2">
                                  <h5 className="font-bold text-[11px] text-emerald-900 uppercase flex items-center justify-between">
                                    <span>TAB 2: Các Đợt Thực Nhận ({row.matchingActuals?.length || 0} đợt)</span>
                                    <span className="font-mono text-xs text-emerald-800">Tổng đã nhận: {row.totalActual}</span>
                                  </h5>
                                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {row.matchingActuals?.map((a, aIdx) => (
                                      <div key={a.id} className="p-2 bg-white rounded border border-emerald-200/80 text-[11px] space-y-1">
                                        <div className="flex items-center justify-between font-medium">
                                          <span>
                                            #{aIdx + 1} • <strong className="text-amber-800">Lần {a.round || 1}</strong> • Ngày: {a.receiptDate} • Phiếu: {a.voucherCode || 'N/A'}
                                          </span>
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            a.status === 'Hàng bù (mua)' || a.status === 'Hàng bù'
                                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                          }`}>
                                            {a.status || 'Hàng đơn'}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-600">
                                          {sizes.map((s) => {
                                            const q = a.sizeQuantities?.[s];
                                            if (!q) return null;
                                            return <span key={s} className="bg-slate-100 px-1 py-0.5 rounded">S{s}: {q}</span>;
                                          })}
                                          <span className="font-bold text-emerald-800 ml-auto">Tổng: {a.totalQty}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {/* Total Summary Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={8} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CHÊNH LỆCH TOÀN BỘ:
                </td>
                {sizes.map((s) => {
                  const d = diffSizeTotals[s] || 0;
                  return (
                    <td
                      key={s}
                      className={`p-2 border-r border-slate-300 text-center font-mono font-bold text-xs ${
                        d < 0 ? 'text-rose-700 font-extrabold' : d > 0 ? 'text-sky-700' : 'text-slate-700'
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
                      ? 'text-sky-800'
                      : 'text-slate-800'
                  }`}
                >
                  {grandTotalDiff !== 0 ? (grandTotalDiff > 0 ? `+${grandTotalDiff}` : `${grandTotalDiff}`) : '0'}
                </td>
                <td className="p-2 border-r border-slate-300 text-center text-xs">
                  {negativeRowsCount > 0 ? (
                    <span className="text-rose-700 font-bold">{negativeRowsCount} đơn bù</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">✓ Khớp</span>
                  )}
                </td>
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-sky-950 bg-sky-100">
                  {grandTotalOriginalPlan.toLocaleString('vi-VN')}
                </td>
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-purple-950 bg-purple-100">
                  {grandTotalCompActual > 0 ? grandTotalCompActual.toLocaleString('vi-VN') : '-'}
                </td>
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-100">
                  {grandTotalActual.toLocaleString('vi-VN')}
                </td>
                <td className="p-2 text-slate-500 text-[11px] italic text-center">
                  Tổng {filteredDiscrepancies.length} PO
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 <strong>Nguyên tắc:</strong> Mỗi mã PO là một dòng tổng hợp duy nhất. Khi hàng bù về ở Tab 1 &amp; Tab 2, số chênh lệch tự động bù trừ về 0 và chuyển sang trạng thái "Đã đủ".</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Hiển thị <strong>{filteredDiscrepancies.length}</strong> đơn PO • Cần bù: <strong className="text-rose-600">{negativeRowsCount}</strong> • Đã đủ: <strong className="text-emerald-600">{matchRowsCount}</strong>
          </div>
        </div>
      </div>

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="BẢNG ĐỐI SOÁT CHÊNH LỆCH VẬT TƯ (GROUP BY PO)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="03-CL/VT"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
