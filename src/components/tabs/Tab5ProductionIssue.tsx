import React, { useState, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ProductionIssueRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  RotateCcw,
  Search,
  Trash2,
  Clipboard,
  X,
  Factory,
  History,
  Send,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

interface DraftIssueRow {
  id: string;
  issueDate: string;
  poNumber: string;
  itemCode: string;
  lineId: string;
  unit: string;
  sizeQuantities: Record<string, number | ''>;
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

export const Tab5ProductionIssue: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    currentCustomerProductionIssues,
    addProductionIssues,
    deleteProductionIssue,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const createEmptyRow = (): DraftIssueRow => {
    const initialSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      initialSizes[s] = '';
    });
    return {
      id: `draft-issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      issueDate: defaultDate,
      poNumber: currentCustomerPlanOrders[0]?.poNumber || '',
      itemCode: currentCustomerPlanOrders[0]?.itemCode || '',
      lineId: 'Chuyền 1',
      unit: 'PRS',
      sizeQuantities: initialSizes,
      note: '',
    };
  };

  const [activeSubTab, setActiveSubTab] = useState<'ENTRY' | 'SAVED'>('ENTRY');
  const [draftRows, setDraftRows] = useState<DraftIssueRow[]>([createEmptyRow(), createEmptyRow()]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDataSource, setPrintDataSource] = useState<'DRAFT' | 'SAVED'>('SAVED');

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleAddRows = (count: number = 1) => {
    const newRows: DraftIssueRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setDraftRows((prev) => [...prev, ...newRows]);
  };

  const handleUpdateDraftField = (id: string, field: keyof DraftIssueRow, value: any) => {
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

  const getRowTotal = (row: DraftIssueRow): number => {
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

  // Save drafts to production issues
  const handleSaveAll = () => {
    if (!currentCustomer) return;
    if (validDraftRows.length === 0) {
      alert('Vui lòng nhập Mã PO, Mã Hàng và số lượng xuất ít nhất 1 dòng!');
      return;
    }

    const newIssues: ProductionIssueRow[] = validDraftRows.map((r, idx) => {
      const sq: Record<string, number> = {};
      sizes.forEach((s) => {
        sq[s] = typeof r.sizeQuantities[s] === 'number' ? Number(r.sizeQuantities[s]) : 0;
      });
      return {
        id: `issue-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        customerId: currentCustomer.id,
        issueDate: r.issueDate.trim() || defaultDate,
        poNumber: r.poNumber.trim().toUpperCase(),
        itemCode: r.itemCode.trim().toUpperCase(),
        lineId: r.lineId,
        unit: r.unit || 'PRS',
        sizeQuantities: sq,
        totalQty: getRowTotal(r),
        note: r.note.trim() || undefined,
      };
    });

    addProductionIssues(newIssues);
    setDraftRows([createEmptyRow(), createEmptyRow()]);
    setActiveSubTab('SAVED');
    alert(`✅ Đã lưu ${newIssues.length} đợt xuất cấp vật tư xuống Chuyền!\n• Hệ thống đã đẩy số liệu sang Tab 5 (Đường 2) để trừ lùi tồn kho.`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveAll();
    }
  };

  // Filtered saved issues
  const filteredSavedIssues = useMemo(() => {
    if (!searchQuery.trim()) return currentCustomerProductionIssues;
    const q = searchQuery.toLowerCase();
    return currentCustomerProductionIssues.filter(
      (i) =>
        i.poNumber.toLowerCase().includes(q) ||
        i.itemCode.toLowerCase().includes(q) ||
        i.lineId.toLowerCase().includes(q) ||
        (i.note && i.note.toLowerCase().includes(q))
    );
  }, [currentCustomerProductionIssues, searchQuery]);

  const savedSizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredSavedIssues.reduce((sum, i) => sum + (i.sizeQuantities[s] || 0), 0);
    });
    return totals;
  }, [filteredSavedIssues, sizes]);

  const savedGrandTotal = useMemo(() => {
    return filteredSavedIssues.reduce((sum, i) => sum + i.totalQty, 0);
  }, [filteredSavedIssues]);

  // Export Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Xuất',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Bộ Phận Nhận (Chuyền)',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Xuất',
      'Ghi Chú',
    ];

    const dataRows = filteredSavedIssues.map((i, idx) => [
      idx + 1,
      i.issueDate,
      i.poNumber,
      i.itemCode,
      i.lineId,
      i.unit,
      ...sizes.map((s) => i.sizeQuantities[s] || 0),
      i.totalQty,
      i.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'XuatChoSX_Tab6');
    XLSX.writeFile(wb, `Tab6_XuatChoSX_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    const list = printDataSource === 'DRAFT' ? validDraftRows : filteredSavedIssues;
    return list.map((r, idx) => {
      const sq: Record<string, number> = {};
      sizes.forEach((s) => {
        sq[s] = typeof r.sizeQuantities[s] === 'number' ? (r.sizeQuantities[s] as number) : 0;
      });
      return {
        stt: idx + 1,
        date: r.issueDate,
        voucherCode: r.lineId,
        poNumber: r.poNumber,
        code: r.itemCode,
        description: `Xuất cấp vật tư cho ${r.lineId}`,
        unit: r.unit,
        sizeQuantities: sq,
        totalQty: 'totalQty' in r ? (r as any).totalQty : getRowTotal(r as any),
        note: r.note,
      };
    });
  }, [printDataSource, validDraftRows, filteredSavedIssues, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
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
            <Factory className="w-3.5 h-3.5 text-sky-600" />
            <span>1. Bảng Xuất Cấp Vật Tư Cho Chuyền Mới</span>
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
            <span>2. Sổ Xuất Cấp Sản Xuất Đã Lưu</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredSavedIssues.length}
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
              <span>Xem Sổ Đã Xuất ({filteredSavedIssues.length}) ➔</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSubTab('ENTRY')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-md border border-sky-200 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Xuất Thêm Cho Chuyền</span>
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
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                <Send className="w-4 h-4 text-sky-600" />
                <span>TAB 6: XUẤT CHO SẢN XUẤT (CẤP PHÁT XUỐNG CHUYỀN)</span>
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Căn cứ từ Tab 2 &amp; Tab 5 (Tồn kho) • Tự động trừ lùi tồn kho ở Tab 5
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
                onClick={handleSaveAll}
                disabled={validDraftRows.length === 0}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>LƯU XUẤT SX (ENTER) {validDraftRows.length > 0 && `(${validDraftRows.length})`}</span>
              </button>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[95px]">Ngày Xuất *</th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO *</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT) *</th>
                  <th className="p-2 border-r border-slate-300 min-w-[130px] bg-sky-50 text-sky-900 font-bold">
                    Bộ Phận Nhận (Chuyền) *
                  </th>
                  <th className="p-2 border-r border-slate-300 text-center w-14">ĐVT</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-sky-100 text-sky-950 font-bold">
                    TỔNG XUẤT
                  </th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Ghi Chú</th>
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
                          value={row.issueDate}
                          onChange={(e) => handleUpdateDraftField(row.id, 'issueDate', e.target.value)}
                          placeholder="DD/MM/YYYY"
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      </td>

                      {/* Mã PO with suggestions from Tab 1 */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          list={`po-issue-list-${row.id}`}
                          value={row.poNumber}
                          onChange={(e) => handleUpdateDraftField(row.id, 'poNumber', e.target.value)}
                          placeholder="MÃ PO"
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-700 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                        <datalist id={`po-issue-list-${row.id}`}>
                          {currentCustomerPlanOrders.map((p) => (
                            <option key={p.id} value={p.poNumber}>
                              {p.poNumber} - {p.itemCode} ({p.description})
                            </option>
                          ))}
                        </datalist>
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.itemCode}
                          onChange={(e) => handleUpdateDraftField(row.id, 'itemCode', e.target.value)}
                          placeholder="Mã Hàng"
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-900 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      </td>

                      {/* Dropdown Bộ phận nhận (Chuyền) */}
                      <td className="p-0 border-r border-slate-200 bg-sky-50/50">
                        <select
                          value={row.lineId}
                          onChange={(e) => handleUpdateDraftField(row.id, 'lineId', e.target.value)}
                          className="w-full h-8 px-2 text-xs font-bold text-sky-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        >
                          {LINE_OPTIONS.map((line) => (
                            <option key={line} value={line}>
                              {line}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="p-0 border-r border-slate-200">
                        <select
                          value={row.unit}
                          onChange={(e) => handleUpdateDraftField(row.id, 'unit', e.target.value)}
                          className="w-full h-8 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        >
                          <option value="PRS">PRS</option>
                          <option value="đôi">đôi</option>
                          <option value="bộ">bộ</option>
                          <option value="cái">cái</option>
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
                            className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                          />
                        </td>
                      ))}

                      {/* Total */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-sky-50 text-sky-900">
                        {rowTotal > 0 ? rowTotal.toLocaleString('vi-VN') : '-'}
                      </td>

                      {/* Note */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          value={row.note}
                          onChange={(e) => handleUpdateDraftField(row.id, 'note', e.target.value)}
                          placeholder="Ghi chú xuất..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
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
                  <td colSpan={6} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    TỔNG CỘNG XUẤT CHO SẢN XUẤT:
                  </td>
                  {sizes.map((s) => (
                    <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                      {draftSizeTotals[s] > 0 ? draftSizeTotals[s].toLocaleString('vi-VN') : '-'}
                    </td>
                  ))}
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-sky-900">
                    {draftGrandTotal > 0 ? draftGrandTotal.toLocaleString('vi-VN') : '0'}
                  </td>
                  <td colSpan={2} className="p-2 text-slate-500 text-[11px] italic">
                    {validDraftRows.length} dòng sẵn sàng xuất
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
            <div className="text-[11px]">
              <span>💡 Vật tư xuất ở Tab 6 sẽ tự động được ghi nhận là <strong>"Xuất sản xuất"</strong> và trừ tồn kho ở Tab 5.</span>
            </div>
            <div className="text-[11px] text-slate-600">
              Tổng SL xuất dự kiến: <strong>{draftGrandTotal.toLocaleString('vi-VN')}</strong>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: SAVED ISSUES */}
      {activeSubTab === 'SAVED' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Sổ Nhật Ký Xuất Cấp Cho Chuyền Đã Lưu ({filteredSavedIssues.length} đợt)
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Dữ liệu trừ lùi tồn kho ở Tab 5 (Đường số 2)
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
                <span>+ Xuất Thêm Cho Chuyền</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 whitespace-nowrap min-w-[85px]">Ngày Xuất</th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT)</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px] font-bold text-sky-900 bg-sky-50">
                    Bộ Phận Nhận
                  </th>
                  <th className="p-2 border-r border-slate-300 text-center w-14">ĐVT</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-sky-100 text-sky-950 font-bold">
                    TỔNG XUẤT
                  </th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Ghi Chú</th>
                  <th className="p-2 text-center w-14">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredSavedIssues.length === 0 ? (
                  <tr>
                    <td colSpan={6 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                      Chưa có phiếu xuất cấp nào cho chuyền.
                    </td>
                  </tr>
                ) : (
                  filteredSavedIssues.map((issue, idx) => (
                    <tr key={issue.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                        {issue.issueDate}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 whitespace-nowrap">
                        {issue.poNumber}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {issue.itemCode}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-bold text-sky-900 bg-sky-50/40">
                        {issue.lineId}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-medium">
                        {issue.unit}
                      </td>

                      {sizes.map((s) => {
                        const q = issue.sizeQuantities[s];
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

                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-sky-50 text-sky-900">
                        {issue.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-500 text-[11px] truncate max-w-[120px]">
                        {issue.note || '-'}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Xóa đợt xuất ${issue.poNumber} cho ${issue.lineId}?`)) {
                              deleteProductionIssue(issue.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
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
        title="PHIẾU XUẤT CẤP VẬT TƯ CHO SẢN XUẤT (TAB 6)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="06-XK/SX"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
