import React, { useState, useRef, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { PlanOrderRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  RotateCcw,
  Search,
  Edit,
  Trash2,
  Clipboard,
  X,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

interface DraftPlanRow {
  id: string;
  receiptDate: string;
  poNumber: string;
  itemCode: string;
  voucherCode: string;
  description: string;
  unit: string;
  sizeQuantities: Record<string, number | ''>;
  note: string;
}

export const Tab1PlanOrder: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    addPlanOrders,
    updatePlanOrder,
    deletePlanOrder,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const createEmptyRow = (): DraftPlanRow => {
    const initialSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      initialSizes[s] = '';
    });
    return {
      id: `draft-plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      receiptDate: defaultDate,
      poNumber: '',
      itemCode: '',
      voucherCode: '',
      description: '',
      unit: 'PRS',
      sizeQuantities: initialSizes,
      note: '',
    };
  };

  const [activeSubTab, setActiveSubTab] = useState<'ENTRY' | 'SAVED'>('ENTRY');
  const [draftRows, setDraftRows] = useState<DraftPlanRow[]>([createEmptyRow(), createEmptyRow()]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDataSource, setPrintDataSource] = useState<'DRAFT' | 'SAVED'>('SAVED');
  const [editingRow, setEditingRow] = useState<PlanOrderRow | null>(null);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleAddRows = (count: number = 1) => {
    const newRows: DraftPlanRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setDraftRows((prev) => [...prev, ...newRows]);
  };

  const handleUpdateDraftField = (id: string, field: keyof DraftPlanRow, value: any) => {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'itemCode' && !r.description) {
          updated.description = `Vật tư ${value}`;
        }
        return updated;
      })
    );
  };

  const handleUpdateSizeQty = (rowId: string, size: string, val: string) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          sizeQuantities: {
            ...r.sizeQuantities,
            [size]: num,
          },
        };
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

  const handleClearDraftRows = () => {
    if (window.confirm('Bạn có muốn xóa trắng các dòng đang nhập?')) {
      setDraftRows([createEmptyRow(), createEmptyRow()]);
    }
  };

  const getRowTotal = (row: DraftPlanRow): number => {
    return sizes.reduce((sum, s) => {
      const q = row.sizeQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  const validDraftRows = draftRows.filter((r) => {
    const total = getRowTotal(r);
    const hasCode = r.poNumber.trim() && r.itemCode.trim();
    return hasCode && total > 0;
  });

  const draftSizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = draftRows.reduce((sum, r) => {
        const q = r.sizeQuantities[s];
        return sum + (typeof q === 'number' ? q : 0);
      }, 0);
    });
    return totals;
  }, [draftRows, sizes]);

  const draftGrandTotal = useMemo(() => {
    return draftRows.reduce((sum, r) => sum + getRowTotal(r), 0);
  }, [draftRows, sizes]);

  // Save drafts
  const handleSaveAll = () => {
    if (!currentCustomer) {
      alert('Chưa chọn Khách Hàng.');
      return;
    }
    if (validDraftRows.length === 0) {
      alert('Vui lòng nhập Mã PO, Mã Hàng (TT Code) và số lượng từng size ít nhất 1 dòng!');
      return;
    }

    const newPlanOrders: PlanOrderRow[] = validDraftRows.map((r, idx) => {
      const sizeQ: Record<string, number> = {};
      sizes.forEach((s) => {
        sizeQ[s] = typeof r.sizeQuantities[s] === 'number' ? Number(r.sizeQuantities[s]) : 0;
      });
      return {
        id: `plan-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        customerId: currentCustomer.id,
        receiptDate: r.receiptDate.trim() || defaultDate,
        poNumber: r.poNumber.trim().toUpperCase(),
        itemCode: r.itemCode.trim().toUpperCase(),
        voucherCode: r.voucherCode.trim() || 'P-KEHOACH',
        description: r.description.trim() || 'Vật tư theo đơn',
        unit: r.unit || 'PRS',
        sizeQuantities: sizeQ,
        totalQty: getRowTotal(r),
        note: r.note.trim() || undefined,
        createdAt: `${defaultDate} ${new Date().toLocaleTimeString('vi-VN')}`,
      };
    });

    addPlanOrders(newPlanOrders);
    setDraftRows([createEmptyRow(), createEmptyRow()]);
    setActiveSubTab('SAVED');
    alert(`✅ Đã lưu ${newPlanOrders.length} đơn hàng kế hoạch vào Tab 1! Dữ liệu đã sẵn sàng cho Tab 2.`);
  };

  // Keyboard shortcut: Ctrl + Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveAll();
    }
  };

  // Paste from Excel
  const parseExcelText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const parsedRows: DraftPlanRow[] = [];

    lines.forEach((line, idx) => {
      const cells = line.split('\t').map((c) => c.trim());
      if (cells.length === 0 || (idx === 0 && cells[0].toLowerCase().includes('ngày'))) {
        return; // skip header
      }

      // Thứ tự cột chuẩn: NGÀY -> MÃ PO -> MÃ HÀNG -> SỐ PHIẾU KH -> DIỄN GIẢI -> ĐVT -> SIZE 4 -> ... -> SIZE 12
      const date = cells[0] || defaultDate;
      const poNumber = (cells[1] || '').toUpperCase();
      const itemCode = (cells[2] || '').toUpperCase();
      const voucherCode = cells[3] || '';
      const description = cells[4] || '';
      const unit = cells[5] || 'PRS';

      const sq: Record<string, number | ''> = {};
      sizes.forEach((s, sIdx) => {
        const valStr = cells[6 + sIdx];
        if (!valStr || valStr === '-' || valStr === '0') {
          sq[s] = '';
        } else {
          const num = parseFloat(valStr.replace(/,/g, ''));
          sq[s] = isNaN(num) ? '' : num;
        }
      });

      if (poNumber || itemCode) {
        parsedRows.push({
          id: `paste-plan-${Date.now()}-${idx}`,
          receiptDate: date,
          poNumber,
          itemCode,
          voucherCode,
          description: description || `Vật tư ${itemCode}`,
          unit,
          sizeQuantities: sq,
          note: 'Dán từ Excel',
        });
      }
    });

    return parsedRows;
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    const clipText = e.clipboardData.getData('text');
    if (!clipText || !clipText.includes('\t')) return;

    e.preventDefault();
    const rows = parseExcelText(clipText);
    if (rows.length > 0) {
      setDraftRows((prev) => {
        const nonEmpties = prev.filter((r) => r.poNumber.trim() || r.itemCode.trim());
        return [...nonEmpties, ...rows];
      });
      alert(`📋 Đã phân tích và dán thành công ${rows.length} dòng đơn hàng từ Excel!`);
    }
  };

  // Filtered saved orders
  const filteredSavedOrders = useMemo(() => {
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

  // Export Excel
  const handleExportExcel = () => {
    if (filteredSavedOrders.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }
    const headers = [
      'STT',
      'Ngày Nhập',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Số Phiếu KH',
      'Diễn Giải',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng Cộng',
      'Ghi Chú',
    ];

    const dataRows = filteredSavedOrders.map((p, idx) => [
      idx + 1,
      p.receiptDate,
      p.poNumber,
      p.itemCode,
      p.voucherCode,
      p.description,
      p.unit,
      ...sizes.map((s) => p.sizeQuantities[s] || 0),
      p.totalQty,
      p.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoTrenPhieu_Tab1');
    XLSX.writeFile(wb, `Tab1_SoTrenPhieu_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    const list = printDataSource === 'DRAFT' ? validDraftRows : filteredSavedOrders;
    return list.map((r, idx) => {
      const sq: Record<string, number> = {};
      sizes.forEach((s) => {
        sq[s] = typeof r.sizeQuantities[s] === 'number' ? (r.sizeQuantities[s] as number) : 0;
      });
      return {
        stt: idx + 1,
        date: r.receiptDate,
        voucherCode: r.voucherCode,
        poNumber: r.poNumber,
        code: 'itemCode' in r ? (r as any).itemCode : '',
        description: r.description,
        unit: r.unit,
        sizeQuantities: sq,
        totalQty: 'totalQty' in r ? (r as any).totalQty : getRowTotal(r as any),
        note: r.note,
      };
    });
  }, [printDataSource, validDraftRows, filteredSavedOrders, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* Sub-tab Navigation */}
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
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" />
            <span>1. Bảng Khởi Tạo Đơn Hàng Mới</span>
            {validDraftRows.length > 0 && (
              <span className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {validDraftRows.length} dòng
              </span>
            )}
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
            <span>2. Sổ Đơn Hàng Trên Phiếu Đã Lưu</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredSavedOrders.length}
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
              <span>Xem Sổ Đã Lưu ({filteredSavedOrders.length}) ➔</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSubTab('ENTRY')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-md border border-sky-200 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Khởi Tạo Đơn Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: DATA ENTRY SPREADSHEET */}
      {activeSubTab === 'ENTRY' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                TAB 1: KHỞI TẠO ĐƠN HÀNG (ĐỊNH DANH 1 LẦN DUY NHẤT)
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Định danh cho toàn bộ Tab 2 → 7
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPrintDataSource('DRAFT');
                  setShowPrintModal(true);
                }}
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
                onClick={() => handleAddRows(1)}
                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-sky-600" />
                <span>+1 Dòng</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddRows(5)}
                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs"
              >
                <Plus className="w-3 h-3 text-sky-600" />
                <span>+5 Dòng</span>
              </button>

              <button
                type="button"
                onClick={handleClearDraftRows}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
                title="Xóa trắng các dòng đang gõ"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={validDraftRows.length === 0}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>LƯU KẾ HOẠCH (ENTER) {validDraftRows.length > 0 && `(${validDraftRows.length})`}</span>
              </button>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[95px]">Ngày Nhập *</th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO *</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT Code) *</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Số Phiếu KH</th>
                  <th className="p-2 border-r border-slate-300 min-w-[150px]">Diễn Giải</th>
                  <th className="p-2 border-r border-slate-300 text-center w-14">ĐVT</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-slate-100 text-slate-900 font-bold">
                    TỔNG CỘNG
                  </th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Ghi Chú</th>
                  <th className="p-2 text-center w-8">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {draftRows.map((row, idx) => {
                  const rowTotal = getRowTotal(row);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-1 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.receiptDate}
                          onChange={(e) => handleUpdateDraftField(row.id, 'receiptDate', e.target.value)}
                          placeholder="DD/MM/YYYY"
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.poNumber}
                          onChange={(e) => handleUpdateDraftField(row.id, 'poNumber', e.target.value)}
                          placeholder="MÃ PO"
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-700 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.itemCode}
                          onChange={(e) => handleUpdateDraftField(row.id, 'itemCode', e.target.value)}
                          placeholder="Mã TT Code"
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-900 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.voucherCode}
                          onChange={(e) => handleUpdateDraftField(row.id, 'voucherCode', e.target.value)}
                          placeholder="Số phiếu KH"
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleUpdateDraftField(row.id, 'description', e.target.value)}
                          placeholder="Tên diễn giải vật tư..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <select
                          value={row.unit}
                          onChange={(e) => handleUpdateDraftField(row.id, 'unit', e.target.value)}
                          className="w-full h-8 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        >
                          <option value="PRS">PRS</option>
                          <option value="đôi">đôi</option>
                          <option value="bộ">bộ</option>
                          <option value="chiếc">chiếc</option>
                          <option value="cái">cái</option>
                          <option value="mét">mét</option>
                        </select>
                      </td>

                      {/* Size Quantities */}
                      {sizes.map((s) => (
                        <td key={s} className="p-0 border-r border-slate-200">
                          <input
                            type="number"
                            min="0"
                            value={row.sizeQuantities[s]}
                            onChange={(e) => handleUpdateSizeQty(row.id, s, e.target.value)}
                            placeholder="-"
                            className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                          />
                        </td>
                      ))}

                      {/* Row Total */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-slate-50 text-slate-800">
                        {rowTotal > 0 ? rowTotal.toLocaleString('vi-VN') : '-'}
                      </td>

                      {/* Note */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) => handleUpdateDraftField(row.id, 'note', e.target.value)}
                          placeholder="Ghi chú..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                        />
                      </td>

                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftRow(row.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                  <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    TỔNG CỘNG TRÊN PHIẾU:
                  </td>
                  {sizes.map((s) => (
                    <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                      {draftSizeTotals[s] > 0 ? draftSizeTotals[s].toLocaleString('vi-VN') : '-'}
                    </td>
                  ))}
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-indigo-900">
                    {draftGrandTotal > 0 ? draftGrandTotal.toLocaleString('vi-VN') : '0'}
                  </td>
                  <td colSpan={2} className="p-2 text-slate-500 text-[11px] italic">
                    {validDraftRows.length} dòng sẵn sàng lưu
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer bar */}
          <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-3 text-[11px]">
              <span>💡 <strong>Tab</strong> để nhảy ô • <strong>Ctrl + Enter</strong> để lưu toàn bộ.</span>
            </div>
            <div className="text-[11px] text-slate-600">
              Hiển thị {draftRows.length} dòng nhập • Tổng SL: <strong>{draftGrandTotal.toLocaleString('vi-VN')}</strong>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SAVED PLAN ORDERS */}
      {activeSubTab === 'SAVED' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Sổ Đơn Hàng Trên Phiếu Đã Khởi Tạo ({filteredSavedOrders.length} đơn)
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Dữ liệu gốc dùng làm căn cứ đối soát Tab 2 & 3
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-44 sm:w-52">
                <input
                  type="text"
                  placeholder="Tìm PO, mã hàng..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setPrintDataSource('SAVED');
                  setShowPrintModal(true);
                }}
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
                <span>+ Khởi Tạo Đơn Mới</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 whitespace-nowrap min-w-[85px]">Ngày Nhập</th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT Code)</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Số Phiếu KH</th>
                  <th className="p-2 border-r border-slate-300 min-w-[150px]">Diễn Giải</th>
                  <th className="p-2 border-r border-slate-300 text-center w-14">ĐVT</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-slate-100 text-slate-900 font-bold">
                    TỔNG CỘNG
                  </th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Ghi Chú</th>
                  <th className="p-2 text-center w-16">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredSavedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7 + sizes.length + 2} className="p-6 text-center text-slate-400 text-xs italic">
                      Chưa có đơn hàng kế hoạch nào cho khách hàng này.
                    </td>
                  </tr>
                ) : (
                  filteredSavedOrders.map((order, idx) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                        {order.receiptDate}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 whitespace-nowrap">
                        {order.poNumber}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {order.itemCode}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">
                        {order.voucherCode || '-'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">
                        {order.description}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-medium">
                        {order.unit}
                      </td>

                      {sizes.map((s) => {
                        const q = order.sizeQuantities[s];
                        return (
                          <td
                            key={s}
                            className={`p-2 border-r border-slate-200 text-center font-mono ${
                              q ? 'font-bold text-slate-900 bg-slate-50/50' : 'text-slate-300'
                            }`}
                          >
                            {q ? q.toLocaleString('vi-VN') : '-'}
                          </td>
                        );
                      })}

                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-slate-50 text-indigo-900">
                        {order.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-500 text-[11px] truncate max-w-[120px]">
                        {order.note || '-'}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingRow(order)}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded transition"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Bạn có chắc muốn xóa đơn hàng ${order.poNumber} (${order.itemCode})?`)) {
                                deletePlanOrder(order.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: DÁN TỪ EXCEL */}
      <ExcelPasteModal<DraftPlanRow>
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        title="Dán Dữ Liệu Đơn Hàng Từ Excel (Tab 1)"
        description="Copy bảng từ Excel (Ctrl+C), dán vào đây (Ctrl+V). Thứ tự chuẩn: Ngày -> Mã PO -> Mã Hàng -> Số Phiếu KH -> Diễn Giải -> ĐVT -> Size 4...12"
        columnsSample={[
          'Ngày',
          'Mã PO',
          'Mã Hàng (TT)',
          'Số Phiếu',
          'Diễn Giải',
          'ĐVT',
          ...sizes.map((s) => `Size ${s}`),
        ]}
        parseFunction={(text) => parseExcelText(text)}
        onApply={(rows) => {
          setDraftRows((prev) => {
            const nonEmpties = prev.filter((r) => r.poNumber.trim() || r.itemCode.trim());
            return [...nonEmpties, ...rows];
          });
          setShowPasteModal(false);
          alert(`Đã nạp ${rows.length} dòng từ Excel!`);
        }}
      />

      {/* MODAL: IN HTML */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="PHIẾU KẾ HOẠCH ĐƠN HÀNG (SỐ TRÊN PHIẾU - TAB 1)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="01-KH/VT"
        sizes={sizes}
        rows={printRows}
      />

      {/* MODAL: CHỈNH SỬA DÒNG ĐÃ LƯU */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Chỉnh Sửa Đơn Kế Hoạch: {editingRow.poNumber} ({editingRow.itemCode})</h3>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                let sum = 0;
                sizes.forEach((s) => {
                  sum += Number(editingRow.sizeQuantities[s]) || 0;
                });
                updatePlanOrder({ ...editingRow, totalQty: sum });
                setEditingRow(null);
                alert('Đã cập nhật đơn hàng kế hoạch!');
              }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã PO</label>
                  <input
                    type="text"
                    value={editingRow.poNumber}
                    onChange={(e) => setEditingRow({ ...editingRow, poNumber: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Mã Hàng (TT Code)</label>
                  <input
                    type="text"
                    value={editingRow.itemCode}
                    onChange={(e) => setEditingRow({ ...editingRow, itemCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs font-mono font-bold border border-slate-300 rounded p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Số Phiếu KH</label>
                  <input
                    type="text"
                    value={editingRow.voucherCode}
                    onChange={(e) => setEditingRow({ ...editingRow, voucherCode: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Diễn Giải</label>
                  <input
                    type="text"
                    value={editingRow.description}
                    onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Ghi Chú</label>
                  <input
                    type="text"
                    value={editingRow.note || ''}
                    onChange={(e) => setEditingRow({ ...editingRow, note: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Số Lượng Từng Size (Kế hoạch trên phiếu)</label>
                <div className="grid grid-cols-5 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {sizes.map((s) => (
                    <div key={s} className="text-center">
                      <span className="block text-[10px] font-bold text-slate-600 mb-0.5">Size {s}</span>
                      <input
                        type="number"
                        min="0"
                        value={editingRow.sizeQuantities[s] || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setEditingRow({
                            ...editingRow,
                            sizeQuantities: {
                              ...editingRow.sizeQuantities,
                              [s]: val,
                            },
                          });
                        }}
                        className="w-full text-center text-xs font-mono font-bold border border-slate-300 rounded p-1 bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-sm"
                >
                  Lưu Thay Đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
