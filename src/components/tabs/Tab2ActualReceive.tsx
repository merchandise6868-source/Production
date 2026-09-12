import React, { useState, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ActualReceiveRow } from '../../types';
import {
  Printer,
  Download,
  Save,
  RotateCcw,
  Search,
  Clipboard,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Edit,
  Trash2,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';

export const Tab2ActualReceive: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    saveActualReceives,
    resetActualReceive,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  // Local state for actual receive draft inputs mapped by planOrderId
  const [actualMap, setActualMap] = useState<Record<string, Record<string, number | ''>>>(() => {
    const map: Record<string, Record<string, number | ''>> = {};
    currentCustomerPlanOrders.forEach((plan) => {
      const existing = currentCustomerActualReceives.find((a) => a.planOrderId === plan.id);
      const rowSizes: Record<string, number | ''> = {};
      sizes.forEach((s) => {
        if (existing && typeof existing.sizeQuantities[s] === 'number') {
          rowSizes[s] = existing.sizeQuantities[s];
        } else {
          rowSizes[s] = '';
        }
      });
      map[plan.id] = rowSizes;
    });
    return map;
  });

  // Notes per row
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => {
    const nMap: Record<string, string> = {};
    currentCustomerActualReceives.forEach((a) => {
      if (a.note) nMap[a.planOrderId] = a.note;
    });
    return nMap;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [poErrorRows, setPoErrorRows] = useState<Set<string>>(new Set());

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Sync actualMap when currentCustomerPlanOrders changes
  React.useEffect(() => {
    setActualMap((prev) => {
      const next = { ...prev };
      currentCustomerPlanOrders.forEach((plan) => {
        if (!next[plan.id]) {
          const existing = currentCustomerActualReceives.find((a) => a.planOrderId === plan.id);
          const rowSizes: Record<string, number | ''> = {};
          sizes.forEach((s) => {
            rowSizes[s] = existing && typeof existing.sizeQuantities[s] === 'number' ? existing.sizeQuantities[s] : '';
          });
          next[plan.id] = rowSizes;
        }
      });
      return next;
    });
  }, [currentCustomerPlanOrders, currentCustomerActualReceives, sizes]);

  // Update actual size quantity for a specific planOrderId
  const handleUpdateQty = (planId: string, size: string, val: string) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setActualMap((prev) => ({
      ...prev,
      [planId]: {
        ...(prev[planId] || {}),
        [size]: num,
      },
    }));
  };

  // Quick populate 100% from Tab 1
  const handleCopyFromPlan = (planId?: string) => {
    if (planId) {
      const plan = currentCustomerPlanOrders.find((p) => p.id === planId);
      if (!plan) return;
      setActualMap((prev) => ({
        ...prev,
        [planId]: { ...plan.sizeQuantities },
      }));
    } else {
      confirm('Sao chép toàn bộ số lượng từ phiếu sang thực nhận?', () => {
        const next: Record<string, Record<string, number | ''>> = {};
        currentCustomerPlanOrders.forEach((p) => {
          next[p.id] = { ...p.sizeQuantities };
        });
        setActualMap(next);
        toast('Đã sao chép toàn bộ số lượng từ phiếu sang thực nhận!');
      });
    }
  };

  // Calculate row total actual
  const getRowActualTotal = (planId: string): number => {
    const row = actualMap[planId] || {};
    return sizes.reduce((sum, s) => {
      const q = row[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  // Filtered plan orders
  const filteredPlanOrders = useMemo(() => {
    if (!searchQuery.trim()) return currentCustomerPlanOrders;
    const q = searchQuery.toLowerCase();
    return currentCustomerPlanOrders.filter(
      (p) =>
        p.poNumber.toLowerCase().includes(q) ||
        p.itemCode.toLowerCase().includes(q) ||
        p.voucherCode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [currentCustomerPlanOrders, searchQuery]);

  // Column totals
  const actualSizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredPlanOrders.reduce((sum, p) => {
        const q = actualMap[p.id]?.[s];
        return sum + (typeof q === 'number' ? q : 0);
      }, 0);
    });
    return totals;
  }, [filteredPlanOrders, actualMap, sizes]);

  const actualGrandTotal = useMemo(() => {
    return filteredPlanOrders.reduce((sum, p) => sum + getRowActualTotal(p.id), 0);
  }, [filteredPlanOrders, actualMap, sizes]);

  // Save all actual receives to Context (Flow to Tab 6 & Tab 3)
  const handleSaveAllActuals = () => {
    if (!currentCustomer) return;

    const actualRowsToSave: ActualReceiveRow[] = [];
    currentCustomerPlanOrders.forEach((plan) => {
      const sizeQ: Record<string, number> = {};
      let total = 0;
      sizes.forEach((s) => {
        const q = actualMap[plan.id]?.[s];
        const num = typeof q === 'number' ? q : 0;
        sizeQ[s] = num;
        total += num;
      });

      actualRowsToSave.push({
        id: `act-${plan.id}`,
        planOrderId: plan.id,
        customerId: currentCustomer.id,
        sizeQuantities: sizeQ,
        totalQty: total,
        note: notesMap[plan.id] || undefined,
        updatedAt: new Date().toLocaleString('vi-VN'),
      });
    });

    saveActualReceives(actualRowsToSave);
    toast(`✅ Đã lưu ${actualRowsToSave.length} phiếu thực nhận vào hệ thống!`);
  };

  // Keyboard shortcut: Enter saves all actuals
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveAllActuals();
    }
  };

  const handleResetRow = (planId: string, poNumber: string) => {
    confirm(`Bạn có chắc muốn xóa/đặt lại số lượng thực nhận của PO ${poNumber} về 0?`, () => {
      setActualMap((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      setNotesMap((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      resetActualReceive(planId);
      toast(`✅ Đã đặt lại số thực nhận PO ${poNumber} về 0`);
    });
  };

  // Excel paste handling with PO matching & Error highlighting
  const handleExcelPaste = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const errors = new Set<string>();
    const updatedMap = { ...actualMap };

    lines.forEach((line, idx) => {
      const cells = line.split('\t').map((c) => c.trim());
      if (cells.length === 0 || (idx === 0 && cells[0].toLowerCase().includes('ngày'))) {
        return; // header
      }

      // Column order: NGÀY -> MÃ PO -> MÃ HÀNG -> SỐ PHIẾU KH -> DIỄN GIẢI -> ĐVT -> SIZE 4 -> ... -> SIZE 12
      const poNum = (cells[1] || '').toUpperCase();
      const itemCode = (cells[2] || '').toUpperCase();

      // Find matching plan order from Tab 1
      const matchingPlan = currentCustomerPlanOrders.find(
        (p) => p.poNumber.toUpperCase() === poNum && (!itemCode || p.itemCode.toUpperCase() === itemCode)
      );

      if (!matchingPlan) {
        errors.add(poNum || `Dòng-${idx + 1}`);
        return;
      }

      const sq: Record<string, number | ''> = { ...(updatedMap[matchingPlan.id] || {}) };
      sizes.forEach((s, sIdx) => {
        const valStr = cells[6 + sIdx];
        if (valStr !== undefined) {
          if (valStr === '' || valStr === '-' || valStr === '0') {
            sq[s] = 0;
          } else {
            const num = parseFloat(valStr.replace(/,/g, ''));
            sq[s] = isNaN(num) ? 0 : num;
          }
        }
      });

      updatedMap[matchingPlan.id] = sq;
    });

    setActualMap(updatedMap);
    setPoErrorRows(errors);

    if (errors.size > 0) {
      alert(`⚠️ CẢNH BÁO LỆCH MÃ PO KHI DÁN EXCEL:\nCó ${errors.size} mã PO không khớp với đơn hàng ở Tab 1: ${Array.from(errors).join(', ')}. Các ô lỗi được đánh dấu đỏ.`);
    } else {
      alert('📋 Đã dán và đối soát thành công toàn bộ số thực nhận từ Excel!');
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    // Không can thiệp nếu đang dán vào ô tìm kiếm hoặc ô bên ngoài bảng
    if (target.tagName === 'INPUT' && !target.hasAttribute('data-size') && !target.closest('td')?.querySelector('input[data-size]')) {
      return;
    }

    const clipText = e.clipboardData.getData('text');
    if (!clipText) return;

    const rawLines = clipText.split(/\r?\n/);
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
      rawLines.pop();
    }
    if (rawLines.length === 0) return;

    const matrix = rawLines.map((line) => line.split('\t'));
    const isMultiCell = matrix.length > 1 || matrix[0].length > 1;

    const sizeInput = target.hasAttribute('data-size')
      ? target
      : (target.closest('td')?.querySelector('input[data-size]') as HTMLElement | null);

    // Trường hợp 1: Đang chọn vào 1 ô Size cụ thể -> Dán ma trận số lượng size từ ô đó sang phải và xuống dưới
    if (sizeInput) {
      if (!isMultiCell && !clipText.includes('\t') && !clipText.includes('\n')) {
        return;
      }

      e.preventDefault();

      const startPlanIdxStr = sizeInput.getAttribute('data-plan-idx');
      const startPlanIdx = startPlanIdxStr !== null ? parseInt(startPlanIdxStr, 10) : 0;
      const startSize = sizeInput.getAttribute('data-size') || sizes[0];
      const startSizeIdx = Math.max(0, sizes.indexOf(startSize));

      let dataMatrix = matrix;
      if (
        dataMatrix.length > 1 &&
        dataMatrix[0].some((c) =>
          /^(size\s*\d+|ngày(\s*nhập)?|mã\s*po|mã\s*hàng|tt\s*code|số\s*phiếu|diễn\s*giải|đvt|stt)$/i.test(
            c.trim().toLowerCase()
          )
        )
      ) {
        dataMatrix = dataMatrix.slice(1);
      }

      const updatedMap = { ...actualMap };

      dataMatrix.forEach((rowCells, rOffset) => {
        const targetPlanIdx = startPlanIdx + rOffset;
        if (targetPlanIdx >= filteredPlanOrders.length) return;

        const plan = filteredPlanOrders[targetPlanIdx];
        const currentSq = { ...(updatedMap[plan.id] || {}) };

        rowCells.forEach((cellRaw, cOffset) => {
          const targetSizeIdx = startSizeIdx + cOffset;
          if (targetSizeIdx >= sizes.length) return;

          const s = sizes[targetSizeIdx];
          const val = cellRaw.trim();

          if (!val || val === '-' || val === '0') {
            currentSq[s] = 0;
          } else {
            const num = parseFloat(val.replace(/,/g, ''));
            currentSq[s] = isNaN(num) ? 0 : Math.max(0, num);
          }
        });

        updatedMap[plan.id] = currentSq;
      });

      setActualMap(updatedMap);
      toast(`📋 Đã dán thành công ${dataMatrix.length} dòng số lượng thực nhận bắt đầu từ Size ${startSize}!`);
      return;
    }

    // Trường hợp 2: Dán bảng đầy đủ có cột Mã PO từ Excel
    if (clipText.includes('\t')) {
      e.preventDefault();
      handleExcelPaste(clipText);
    }
  };

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
      ...sizes.map((s) => `Size ${s}`),
      'Tổng Thực Nhận',
      'Ghi Chú',
    ];

    const dataRows = filteredPlanOrders.map((p, idx) => [
      idx + 1,
      p.receiptDate,
      p.poNumber,
      p.itemCode,
      p.voucherCode,
      p.description,
      p.unit,
      ...sizes.map((s) => actualMap[p.id]?.[s] || 0),
      getRowActualTotal(p.id),
      notesMap[p.id] || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoThucNhan_Tab2');
    XLSX.writeFile(wb, `Tab2_SoThucNhan_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    return filteredPlanOrders.map((p, idx) => {
      const sq: Record<string, number> = {};
      sizes.forEach((s) => {
        sq[s] = Number(actualMap[p.id]?.[s]) || 0;
      });
      return {
        stt: idx + 1,
        date: p.receiptDate,
        voucherCode: p.voucherCode,
        poNumber: p.poNumber,
        code: p.itemCode,
        description: p.description,
        unit: p.unit,
        sizeQuantities: sq,
        totalQty: getRowActualTotal(p.id),
        note: notesMap[p.id] || '',
      };
    });
  }, [filteredPlanOrders, actualMap, notesMap, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* Top Banner Notice */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 2: SỐ THỰC NHẬN (NHẬP THỰC TẾ & TỒN KHO BAN ĐẦU)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Định danh tự đọc từ Tab 1 • Nhập số thực tế từng size
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
              onClick={() => setShowPasteModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
            >
              <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dán Excel</span>
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
              onClick={() => handleCopyFromPlan()}
              className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              title="Điền nhanh 100% số lượng từ phiếu nếu nhận đủ"
            >
              <Copy className="w-3.5 h-3.5 text-sky-600" />
              <span>Nhận Đủ (Copy P)</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllActuals}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>LƯU THỰC NHẬN (ENTER)</span>
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Tìm PO, mã hàng, số phiếu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>

          <div className="text-[11px] text-slate-600 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Các cột xám là thông tin định danh Read-only từ Tab 1. Chỉ gõ vào các ô Size trắng.</span>
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
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-emerald-50 text-emerald-900"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-emerald-100 text-emerald-950 font-bold">
                  THỰC NHẬN
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[70px] text-right bg-slate-100 text-slate-600">
                  SL PHIẾU
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Ghi Chú</th>
                <th className="p-2 text-center w-16">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredPlanOrders.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                    Chưa có đơn hàng nào ở Tab 1. Vui lòng sang Tab 1 để khởi tạo đơn hàng trước!
                  </td>
                </tr>
              ) : (
                filteredPlanOrders.map((plan, idx) => {
                  const actualTotal = getRowActualTotal(plan.id);
                  const isPoError = poErrorRows.has(plan.poNumber);

                  return (
                    <tr
                      key={plan.id}
                      onKeyDown={handleKeyDown}
                      className={`hover:bg-slate-50 transition-colors ${
                        isPoError ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Read-only Identity columns from Tab 1 */}
                      <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70 whitespace-nowrap">
                        {plan.receiptDate}
                      </td>

                      <td
                        className={`p-2 border-r border-slate-200 font-mono font-bold whitespace-nowrap ${
                          isPoError ? 'text-rose-700 bg-rose-100' : 'text-sky-700 bg-slate-50/70'
                        }`}
                      >
                        {plan.poNumber}
                        {isPoError && <span className="ml-1 text-[9px] text-rose-600 font-bold">[LỆCH]</span>}
                      </td>

                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-800 bg-slate-50/70">
                        {plan.itemCode}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70">
                        {plan.voucherCode || '-'}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-600 bg-slate-50/70 truncate max-w-[150px]">
                        {plan.description}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-center text-slate-500 bg-slate-50/70 font-medium">
                        {plan.unit}
                      </td>

                      {/* Editable Actual Quantities per Size */}
                      {sizes.map((s) => {
                        const val = actualMap[plan.id]?.[s];
                        return (
                          <td key={s} className="p-0 border-r border-slate-200">
                            <input
                              id={`act-input-${plan.id}-${s}`}
                              data-plan-id={plan.id}
                              data-plan-idx={idx}
                              data-size={s}
                              type="number"
                              min="0"
                              value={val !== undefined ? val : ''}
                              onChange={(e) => handleUpdateQty(plan.id, s, e.target.value)}
                              placeholder="-"
                              className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-slate-900 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        );
                      })}

                      {/* Total Actual */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-emerald-50/60 text-emerald-900">
                        {actualTotal > 0 ? actualTotal.toLocaleString('vi-VN') : '-'}
                      </td>

                      {/* Total Plan (for comparison) */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono text-xs bg-slate-50 text-slate-500">
                        {plan.totalQty.toLocaleString('vi-VN')}
                      </td>

                      {/* Note */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={notesMap[plan.id] || ''}
                          onChange={(e) =>
                            setNotesMap((prev) => ({ ...prev, [plan.id]: e.target.value }))
                          }
                          placeholder="Ghi chú thực nhận..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                        />
                      </td>

                      {/* Actions: Nhận đủ, Sửa, Xóa */}
                      <td className="p-1 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyFromPlan(plan.id)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-slate-200 transition cursor-pointer"
                            title="Chép 100% SL từ trên phiếu sang dòng này"
                          >
                            Nhận đủ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`act-input-${plan.id}-${sizes[0]}`);
                              if (el) el.focus();
                            }}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Chỉnh sửa số lượng thực nhận"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetRow(plan.id, plan.poNumber)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa/Đặt lại số lượng thực nhận về 0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Summary Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG THỰC NHẬN TOÀN BỘ:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-950">
                    {actualSizeTotals[s] > 0 ? actualSizeTotals[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-900">
                  {actualGrandTotal > 0 ? actualGrandTotal.toLocaleString('vi-VN') : '0'}
                </td>
                <td colSpan={3} className="p-2 text-slate-500 text-[11px] italic">
                  Đồng bộ sang Tab 5 (Đường 1: Tồn đầu)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 <strong>Tab</strong> để nhảy ô • <strong>Ctrl + Enter</strong> để lưu toàn bộ thực nhận.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong>{filteredPlanOrders.length}</strong> đơn hàng • Tổng SL thực nhận: <strong>{actualGrandTotal.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
      </div>

      {/* Excel Paste Modal */}
      <ExcelPasteModal<any>
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        title="Dán Số Lượng Thực Nhận Từ Excel (Tab 2)"
        description="Copy bảng thực nhận từ Excel (Ctrl+C), dán vào đây (Ctrl+V). Hệ thống tự động đối soát Mã PO với Tab 1."
        columnsSample={[
          'Ngày',
          'Mã PO',
          'Mã Hàng',
          'Số Phiếu',
          'Diễn Giải',
          'ĐVT',
          ...sizes.map((s) => `Size ${s}`),
        ]}
        parseFunction={(text) => {
          handleExcelPaste(text);
          return [];
        }}
        onApply={() => {
          setShowPasteModal(false);
        }}
      />

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="PHIẾU GHI NHẬN SỐ LƯỢNG THỰC NHẬN (TAB 2)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="02-TN/VT"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
