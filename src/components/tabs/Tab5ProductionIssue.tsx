import React, { useState, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ProductionIssueRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  Search,
  Trash2,
  Edit,
  Clipboard,
  X,
  CheckCircle2,
  Factory,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
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
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    currentCustomerProductionIssues,
    addProductionIssues,
    deleteProductionIssue,
    updateProductionIssue,
  } = useInventory();

  const [editingIssue, setEditingIssue] = useState<ProductionIssueRow | null>(null);
  const [selectedForPrint, setSelectedForPrint] = useState<ProductionIssueRow | null>(null);

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
      unit: currentCustomerPlanOrders[0]?.unit || 'PRS',
      sizeQuantities: initialSizes,
      note: '',
    };
  };

  const [draftRows, setDraftRows] = useState<DraftIssueRow[]>([createEmptyRow()]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

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

  // Save all valid drafts to production issues (Enter to save)
  const handleSaveAll = () => {
    if (!currentCustomer) return;
    if (validDraftRows.length === 0) {
      alert('Vui lòng nhập Mã PO, Mã Hàng và số lượng xuất ít nhất 1 dòng!', 'Thiếu thông tin', 'warning');
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
    setDraftRows([createEmptyRow()]);
    toast(`✅ Đã lưu ${newIssues.length} đợt xuất cấp vật tư xuống Chuyền trực tiếp trên bảng!`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveAll();
    }
  };

  // Cột ma trận dữ liệu draft rows để xác định vị trí paste chính xác từ ô được click
  const draftColumns = useMemo(() => [
    { key: 'issueDate', type: 'date' as const },
    { key: 'poNumber', type: 'text' as const },
    { key: 'itemCode', type: 'text' as const },
    { key: 'lineId', type: 'line' as const },
    { key: 'unit', type: 'unit' as const },
    ...sizes.map((s) => ({ key: `size_${s}`, type: 'size' as const, size: s })),
    { key: 'note', type: 'note' as const },
  ], [sizes]);

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    const targetInput = target.closest('[data-row-idx]') as HTMLElement | null;
    if (target.tagName === 'INPUT' && !targetInput) {
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

    if (!isMultiCell && targetInput && !clipText.includes('\t') && !clipText.includes('\n')) {
      return;
    }

    if (!targetInput && !isMultiCell) {
      return;
    }

    e.preventDefault();

    let startRowIdx = 0;
    let startColKey = 'issueDate';

    if (targetInput) {
      const rIdxStr = targetInput.getAttribute('data-row-idx');
      const cKeyStr = targetInput.getAttribute('data-col-key');
      if (rIdxStr !== null) {
        startRowIdx = parseInt(rIdxStr, 10) || 0;
      }
      if (cKeyStr) {
        startColKey = cKeyStr;
      }
    }

    handleApplyMatrixPaste(matrix, startRowIdx, startColKey);
  };

  const handleApplyMatrixPaste = (dataMatrix: string[][], startRowIdx: number = 0, startColKey: string = 'issueDate') => {
    if (!dataMatrix || dataMatrix.length === 0) return;

    const neededRowCount = startRowIdx + dataMatrix.length;
    let currentRows = [...draftRows];

    if (currentRows.length < neededRowCount) {
      const extraCount = neededRowCount - currentRows.length;
      for (let i = 0; i < extraCount; i++) {
        currentRows.push(createEmptyRow());
      }
    }

    const startColIdx = Math.max(0, draftColumns.findIndex((c) => c.key === startColKey));

    for (let r = 0; r < dataMatrix.length; r++) {
      const targetRowIndex = startRowIdx + r;
      const rowValues = dataMatrix[r];
      const targetRow = { ...currentRows[targetRowIndex] };
      const nextSq = { ...targetRow.sizeQuantities };

      for (let c = 0; c < rowValues.length; c++) {
        const targetColIdx = startColIdx + c;
        if (targetColIdx >= draftColumns.length) break;

        const colDef = draftColumns[targetColIdx];
        const rawVal = rowValues[c].trim();

        if (colDef.type === 'date') {
          if (rawVal) targetRow.issueDate = rawVal;
        } else if (colDef.type === 'text') {
          if (colDef.key === 'poNumber') {
            targetRow.poNumber = rawVal.toUpperCase();
            const match = currentCustomerPlanOrders.find(
              (p) => p.poNumber.toUpperCase() === rawVal.toUpperCase()
            );
            if (match) {
              targetRow.itemCode = match.itemCode;
              targetRow.unit = match.unit;
            }
          } else if (colDef.key === 'itemCode') {
            targetRow.itemCode = rawVal.toUpperCase();
          }
        } else if (colDef.type === 'line') {
          const matchLine = LINE_OPTIONS.find(
            (l) => l.toLowerCase() === rawVal.toLowerCase() || l.toLowerCase().includes(rawVal.toLowerCase())
          );
          if (matchLine) {
            targetRow.lineId = matchLine;
          } else if (rawVal) {
            targetRow.lineId = rawVal;
          }
        } else if (colDef.type === 'unit') {
          if (rawVal) targetRow.unit = rawVal;
        } else if (colDef.type === 'size') {
          const sizeName = colDef.size!;
          if (rawVal === '' || rawVal === '-') {
            nextSq[sizeName] = '';
          } else {
            const num = parseFloat(rawVal.replace(/,/g, ''));
            nextSq[sizeName] = isNaN(num) ? '' : Math.max(0, num);
          }
        } else if (colDef.type === 'note') {
          targetRow.note = rawVal;
        }
      }

      targetRow.sizeQuantities = nextSq;
      currentRows[targetRowIndex] = targetRow;
    }

    setDraftRows(currentRows);
    toast(`📋 Đã dán thành công ${dataMatrix.length} dòng dữ liệu vào bảng!`);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue) return;
    if (!editingIssue.poNumber.trim()) {
      alert('Vui lòng nhập Mã PO.', 'Thiếu thông tin', 'warning');
      return;
    }
    if (!editingIssue.itemCode.trim()) {
      alert('Vui lòng nhập Mã Hàng.', 'Thiếu thông tin', 'warning');
      return;
    }

    const sq: Record<string, number> = {};
    let sum = 0;
    sizes.forEach((s) => {
      const v = Number(editingIssue.sizeQuantities[s]) || 0;
      if (v > 0) {
        sq[s] = v;
        sum += v;
      }
    });

    if (sum <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất 1 size!', 'Thiếu số lượng', 'warning');
      return;
    }

    const updated: ProductionIssueRow = {
      ...editingIssue,
      poNumber: editingIssue.poNumber.trim().toUpperCase(),
      itemCode: editingIssue.itemCode.trim().toUpperCase(),
      sizeQuantities: sq,
      totalQty: sum,
    };

    updateProductionIssue(updated);
    toast(`✅ Đã cập nhật đợt xuất PO: ${updated.poNumber}!`);
    setEditingIssue(null);
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

  // Totals for all saved issues
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
    const list = selectedForPrint ? [selectedForPrint] : filteredSavedIssues;
    return list.map((r, idx) => {
      const sq: Record<string, number> = {};
      sizes.forEach((s) => {
        sq[s] = r.sizeQuantities[s] || 0;
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
        totalQty: r.totalQty,
        note: r.note,
      };
    });
  }, [selectedForPrint, filteredSavedIssues, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* Excel Sheet Container */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Top Header & Action Toolbar */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Factory className="w-4 h-4 text-sky-600" />
              <span>TAB 6: XUẤT VẬT TƯ CHO SẢN XUẤT (CẤP PHÁT XUỐNG CHUYỀN)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Căn cứ từ Tab 2 &amp; Tab 5 (Tồn kho) • Nhập số Enter lưu ngay trên bảng Excel
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <div className="relative w-40 sm:w-48">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng, chuyền..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-sky-500 focus:outline-none bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedForPrint(null);
                setShowPrintModal(true);
              }}
              disabled={filteredSavedIssues.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In Bảng</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredSavedIssues.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dán Excel</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(1)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>+1 Dòng</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>+5 Dòng</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={validDraftRows.length === 0}
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>LƯU XUẤT SX (ENTER) {validDraftRows.length > 0 && `(${validDraftRows.length})`}</span>
            </button>
          </div>
        </div>

        {/* Unified Live Excel Table */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-9">#</th>
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
                <th className="p-2 border-r border-slate-300 min-w-[130px]">Ghi Chú</th>
                <th className="p-2 text-center w-24">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {/* PHẦN 1: CÁC DÒNG ĐÃ LƯU TRỰC TIẾP TRÊN PHIẾU (Có nút Sửa & Xóa) */}
              {filteredSavedIssues.map((issue, idx) => (
                <tr key={issue.id} className="bg-white hover:bg-slate-50/80 transition-colors">
                  <td className="p-1.5 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>
                  <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono text-slate-700">
                    {issue.issueDate}
                  </td>
                  <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-sky-700">
                    {issue.poNumber}
                  </td>
                  <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-slate-800">
                    {issue.itemCode}
                  </td>
                  <td className="p-2 border-r border-slate-200 whitespace-nowrap font-semibold text-sky-900 bg-sky-50/30">
                    {issue.lineId}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-center text-slate-600">
                    {issue.unit}
                  </td>

                  {sizes.map((s) => {
                    const q = issue.sizeQuantities[s] || 0;
                    return (
                      <td
                        key={s}
                        className={`p-2 border-r border-slate-200 text-center font-mono ${
                          q > 0 ? 'text-slate-900 font-bold bg-slate-50/50' : 'text-slate-300'
                        }`}
                      >
                        {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                      </td>
                    );
                  })}

                  <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-sky-50/60 text-sky-900">
                    {issue.totalQty.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border-r border-slate-200 text-slate-600 text-[11px] truncate max-w-[140px]">
                    {issue.note || '-'}
                  </td>

                  {/* Nút Sửa, Xóa và In trên mọi dòng */}
                  <td className="p-1.5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedForPrint(issue);
                          setShowPrintModal(true);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                        title="In phiếu xuất này"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingIssue({ ...issue, sizeQuantities: { ...issue.sizeQuantities } })}
                        className="p-1 text-slate-400 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                        title="Chỉnh sửa dòng xuất"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          confirm(
                            `Bạn có chắc muốn xóa đợt xuất PO ${issue.poNumber} (${issue.totalQty} ${issue.unit}) cho ${issue.lineId}?`,
                            () => {
                              deleteProductionIssue(issue.id);
                              toast(`Đã xóa đợt xuất PO ${issue.poNumber}`);
                            }
                          );
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                        title="Xóa dòng xuất"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* PHẦN 2: DÒNG NHẬP LIỆU TRỰC TIẾP (Nhập số Enter lưu ngay trên bảng) */}
              {draftRows.map((row, idx) => {
                const rowTotal = getRowTotal(row);
                return (
                  <tr
                    key={row.id}
                    className="bg-[#f0f7ff]/80 hover:bg-[#e0efff] transition-colors border-t-2 border-sky-300"
                  >
                    <td className="p-1 border-r border-sky-200 text-center font-bold text-sky-700 font-mono text-[11px]">
                      <span className="inline-block px-1 bg-sky-200 text-sky-800 rounded text-[10px]">
                        + Mới
                      </span>
                    </td>

                    <td className="p-0 border-r border-sky-200">
                      <input
                        type="text"
                        data-row-idx={idx}
                        data-col-key="issueDate"
                        value={row.issueDate}
                        onChange={(e) => handleUpdateDraftField(row.id, 'issueDate', e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                      />
                    </td>

                    {/* Mã PO with suggestions */}
                    <td className="p-0 border-r border-sky-200">
                      <input
                        type="text"
                        data-row-idx={idx}
                        data-col-key="poNumber"
                        list={`po-issue-list-${row.id}`}
                        value={row.poNumber}
                        onChange={(e) => handleUpdateDraftField(row.id, 'poNumber', e.target.value)}
                        placeholder="MÃ PO..."
                        className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-800 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                      />
                      <datalist id={`po-issue-list-${row.id}`}>
                        {currentCustomerPlanOrders.map((p) => (
                          <option key={p.id} value={p.poNumber}>
                            {p.poNumber} - {p.itemCode}
                          </option>
                        ))}
                      </datalist>
                    </td>

                    <td className="p-0 border-r border-sky-200">
                      <input
                        type="text"
                        data-row-idx={idx}
                        data-col-key="itemCode"
                        value={row.itemCode}
                        onChange={(e) => handleUpdateDraftField(row.id, 'itemCode', e.target.value)}
                        placeholder="Mã Hàng"
                        className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-900 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                      />
                    </td>

                    {/* Chuyền nhận */}
                    <td className="p-0 border-r border-sky-200 bg-sky-100/50">
                      <select
                        data-row-idx={idx}
                        data-col-key="lineId"
                        value={row.lineId}
                        onChange={(e) => handleUpdateDraftField(row.id, 'lineId', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-bold text-sky-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white cursor-pointer"
                      >
                        {LINE_OPTIONS.map((line) => (
                          <option key={line} value={line}>
                            {line}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-0 border-r border-sky-200">
                      <select
                        data-row-idx={idx}
                        data-col-key="unit"
                        value={row.unit}
                        onChange={(e) => handleUpdateDraftField(row.id, 'unit', e.target.value)}
                        className="w-full h-8 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white cursor-pointer text-center"
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
                      </select>
                    </td>

                    {/* Ô nhập Size (Enter để lưu) */}
                    {sizes.map((s) => (
                      <td key={s} className="p-0 border-r border-sky-200">
                        <input
                          type="number"
                          min="0"
                          data-row-idx={idx}
                          data-col-key={`size_${s}`}
                          value={row.sizeQuantities[s]}
                          onChange={(e) => handleUpdateSizeQty(row.id, s, e.target.value)}
                          placeholder="-"
                          className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      </td>
                    ))}

                    {/* Tổng dòng nháp */}
                    <td className="p-2 border-r border-sky-200 text-right font-mono font-bold text-xs bg-sky-200/60 text-sky-950">
                      {rowTotal > 0 ? rowTotal.toLocaleString('vi-VN') : '-'}
                    </td>

                    {/* Ghi chú */}
                    <td className="p-0 border-r border-sky-200">
                      <input
                        type="text"
                        data-row-idx={idx}
                        data-col-key="note"
                        value={row.note}
                        onChange={(e) => handleUpdateDraftField(row.id, 'note', e.target.value)}
                        placeholder="Ghi chú xuất (nhấn Enter lưu)..."
                        className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                      />
                    </td>

                    <td className="p-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={handleSaveAll}
                          disabled={!row.poNumber.trim() || rowTotal <= 0}
                          className="p-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white rounded shadow-2xs transition cursor-pointer"
                          title="Lưu dòng này (Enter)"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>

                        {draftRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftRow(row.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Xóa dòng nhập này"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* DÒNG TỔNG CỘNG TOÀN BỘ BẢNG */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-400">
                <td colSpan={6} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG ĐÃ XUẤT CHO SẢN XUẤT:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                    {savedSizeTotals[s] > 0 ? savedSizeTotals[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-sky-950 bg-sky-200">
                  {savedGrandTotal > 0 ? savedGrandTotal.toLocaleString('vi-VN') : '0'}
                </td>
                <td colSpan={2} className="p-2 text-slate-600 text-[11px] italic">
                  Đã ghi nhận {filteredSavedIssues.length} đợt xuất cấp
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="text-[11px]">
            <span>💡 <strong>Mẹo:</strong> Nhập số lượng và nhấn <strong>Enter</strong> để lưu ngay vào bảng. Dữ liệu sẽ tự động trừ tồn kho ở Tab 5. Hỗ trợ copy &amp; paste cả khối từ Excel!</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng xuất đã lưu: <strong className="text-sky-700">{savedGrandTotal.toLocaleString('vi-VN')}</strong> ({filteredSavedIssues.length} đợt)
          </div>
        </div>
      </div>

      {/* MODAL SỬA ĐỢT XUẤT VẬT TƯ */}
      {editingIssue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-sky-950 uppercase tracking-wide flex items-center gap-2">
                <Edit className="w-4 h-4 text-sky-600" />
                <span>CHỈNH SỬA ĐỢT XUẤT CẤP CHO CHUYỀN</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingIssue(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày xuất</label>
                  <input
                    type="text"
                    required
                    value={editingIssue.issueDate}
                    onChange={(e) => setEditingIssue({ ...editingIssue, issueDate: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã PO</label>
                  <input
                    type="text"
                    required
                    value={editingIssue.poNumber}
                    onChange={(e) => setEditingIssue({ ...editingIssue, poNumber: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold text-sky-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mã Hàng</label>
                  <input
                    type="text"
                    required
                    value={editingIssue.itemCode}
                    onChange={(e) => setEditingIssue({ ...editingIssue, itemCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chuyền / Bộ phận nhận</label>
                  <select
                    value={editingIssue.lineId}
                    onChange={(e) => setEditingIssue({ ...editingIssue, lineId: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white focus:ring-1 focus:ring-sky-500 font-semibold text-slate-800"
                  >
                    {LINE_OPTIONS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={editingIssue.unit}
                    onChange={(e) => setEditingIssue({ ...editingIssue, unit: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú</label>
                  <input
                    type="text"
                    value={editingIssue.note || ''}
                    onChange={(e) => setEditingIssue({ ...editingIssue, note: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Sizes */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Số lượng xuất theo Size
                  </span>
                  <span className="text-xs font-bold text-sky-700 font-mono">
                    Tổng: {sizes.reduce((sum, s) => sum + (Number(editingIssue.sizeQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-slate-300 rounded p-1.5 text-center">
                      <div className="text-[11px] font-bold text-slate-600 mb-1">Sz {s}</div>
                      <input
                        type="number"
                        min="0"
                        value={editingIssue.sizeQuantities[s] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setEditingIssue({
                            ...editingIssue,
                            sizeQuantities: {
                              ...editingIssue.sizeQuantities,
                              [s]: typeof val === 'number' ? val : 0,
                            },
                          });
                        }}
                        className="w-full text-center text-xs font-mono font-bold border border-slate-200 rounded py-1 focus:ring-1 focus:ring-sky-500"
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
                  onClick={() => setEditingIssue(null)}
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

      {/* MODAL IN PHIẾU XUẤT CẤP CHO CHUYỀN */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setSelectedForPrint(null);
        }}
        documentTitle={selectedForPrint ? `PHIẾU XUẤT CẤP VẬT TƯ CHO ${selectedForPrint.lineId}` : 'BẢNG TỔNG HỢP XUẤT CẤP VẬT TƯ CHO SẢN XUẤT'}
        documentNumber={selectedForPrint ? `PXK-SX-${selectedForPrint.poNumber}` : 'TH-XUAT-SX'}
        dateStr={selectedForPrint?.issueDate || defaultDate}
        customerName={currentCustomer?.name || 'Khách hàng'}
        poNumber={selectedForPrint?.poNumber}
        sizes={sizes}
        rows={printRows}
      />

      {/* MODAL DÁN EXCEL TIỆN ÍCH */}
      <ExcelPasteModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onApply={(matrix) => handleApplyMatrixPaste(matrix, 0, 'issueDate')}
        title="Dán dữ liệu xuất cấp sản xuất từ Excel"
        instructions="Copy các ô từ Excel (Ngày, Mã PO, Mã Hàng, Chuyền, ĐVT, các Size) và dán vào đây:"
      />
    </div>
  );
};
