import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Factory,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';
import { SearchablePoSelect } from '../common/SearchablePoSelect';
import { handleCellArrowNavigation } from '../../utils/tableNavigation';

export interface Tab6IssueItem {
  id: string;
  isNew?: boolean;
  isEditing: boolean;
  issueDate: string;
  poNumber: string;
  itemCode: string;
  detailName?: string;
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
    currentCustomerPOs,
    currentCustomerPlanOrders,
    currentCustomerProductionIssues,
    currentCustomerRealtimeStock,
    addProductionIssues,
    deleteProductionIssue,
    updateProductionIssue,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  // Lấy danh sách tên chi tiết / vật tư có trong PO đó
  const getPoDetails = (poNumber: string) => {
    const matching = currentCustomerPlanOrders.filter(
      (p) => p.poNumber.toUpperCase() === poNumber.toUpperCase()
    );
    const details = matching.map((p) => p.description || p.itemCode).filter(Boolean);
    return Array.from(new Set(details));
  };

  // Nút Xuất đủ: Điền nhanh 100% số lượng từ Tồn kho Tab 5 hoặc Kế hoạch Tab 1
  const handleCopyAvailableStock = (rowId: string) => {
    const item = issueItems.find((r) => r.id === rowId);
    if (!item) return;
    const stockItem = currentCustomerRealtimeStock.find(
      (r) =>
        r.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
        (!item.itemCode || r.itemCode.toUpperCase() === item.itemCode.toUpperCase())
    );
    const planItem = currentCustomerPlanOrders.find(
      (p) =>
        p.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
        (!item.itemCode || p.itemCode.toUpperCase() === item.itemCode.toUpperCase())
    );

    const newSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      const avail = stockItem ? stockItem.currentStockSizes[s] : undefined;
      if (typeof avail === 'number' && avail > 0) {
        newSizes[s] = avail;
      } else if (planItem && typeof planItem.sizeQuantities[s] === 'number' && planItem.sizeQuantities[s] > 0) {
        newSizes[s] = planItem.sizeQuantities[s];
      } else {
        newSizes[s] = '';
      }
    });

    setIssueItems((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, sizeQuantities: newSizes, isEditing: true } : r))
    );
    toast(`Đã điền số lượng "Xuất đủ" cho dòng PO ${item.poNumber}!`);
  };

  const createBlankItem = (idx: number, isEditing: boolean = true): Tab6IssueItem => {
    const sq: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      sq[s] = '';
    });

    const defaultPlan = currentCustomerPlanOrders[idx] || currentCustomerPlanOrders[0];
    return {
      id: `draft-issue-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      isNew: true,
      isEditing,
      issueDate: defaultDate,
      poNumber: defaultPlan?.poNumber || '',
      itemCode: defaultPlan?.itemCode || '',
      detailName: defaultPlan?.description || '',
      lineId: 'Chuyền 1',
      unit: defaultPlan?.unit || 'PRS',
      sizeQuantities: sq,
      note: '',
    };
  };

  // State danh sách các dòng xuất trên bảng (mỗi dòng giữ nguyên vị trí, lưu Enter khóa dòng, sửa mở khóa tại chỗ)
  const [issueItems, setIssueItems] = useState<Tab6IssueItem[]>(() => {
    if (currentCustomerProductionIssues.length > 0) {
      return currentCustomerProductionIssues.map((i) => {
        const sq: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          sq[s] = typeof i.sizeQuantities[s] === 'number' ? i.sizeQuantities[s] : '';
        });
        return {
          id: i.id,
          isNew: false,
          isEditing: false, // Mặc định khóa dòng
          issueDate: i.issueDate,
          poNumber: i.poNumber,
          itemCode: i.itemCode,
          detailName: i.detailName || '',
          lineId: i.lineId,
          unit: i.unit || 'PRS',
          sizeQuantities: sq,
          note: i.note || '',
        };
      });
    }
    return [createBlankItem(0, true)];
  });

  // Đồng bộ khi đổi khách hàng mà không làm mất dòng đang sửa
  useEffect(() => {
    if (currentCustomerProductionIssues.length === 0) {
      setIssueItems((prev) => {
        if (prev.length === 0) return [createBlankItem(0, true)];
        return prev;
      });
      return;
    }

    setIssueItems((prev) => {
      const editingMap = new Map(prev.filter((p) => p.isEditing).map((p) => [p.id, p]));
      const newItems: Tab6IssueItem[] = currentCustomerProductionIssues.map((i) => {
        if (editingMap.has(i.id)) {
          return editingMap.get(i.id)!;
        }
        const sq: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          sq[s] = typeof i.sizeQuantities[s] === 'number' ? i.sizeQuantities[s] : '';
        });
        return {
          id: i.id,
          isNew: false,
          isEditing: false,
          issueDate: i.issueDate,
          poNumber: i.poNumber,
          itemCode: i.itemCode,
          detailName: i.detailName || '',
          lineId: i.lineId,
          unit: i.unit || 'PRS',
          sizeQuantities: sq,
          note: i.note || '',
        };
      });

      const unsavedNewRows = prev.filter((p) => p.isNew && p.isEditing);
      return [...newItems, ...unsavedNewRows];
    });
  }, [currentCustomerProductionIssues, currentCustomer?.id]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForPrint, setSelectedForPrint] = useState<ProductionIssueRow | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Thêm dòng mới: Tự tăng số thứ tự
  const handleAddRows = (count: number = 1) => {
    setIssueItems((prev) => {
      const added: Tab6IssueItem[] = [];
      for (let i = 0; i < count; i++) {
        added.push(createBlankItem(prev.length + i, true));
      }
      return [...prev, ...added];
    });
    toast(`➕ Đã thêm ${count} dòng mới với số thứ tự tăng tự động!`);
  };

  const handleUpdateItemField = (id: string, field: keyof Tab6IssueItem, value: any) => {
    setIssueItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
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

  const handleUpdateItemSizeQty = (id: string, size: string, val: string) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setIssueItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          sizeQuantities: {
            ...item.sizeQuantities,
            [size]: num,
          },
        };
      })
    );
  };

  const getItemTotal = (item: Tab6IssueItem): number => {
    return sizes.reduce((sum, s) => {
      const q = item.sizeQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  // Mở khóa sửa trực tiếp trên dòng đó (Không mở form popup!)
  const handleUnlockRow = (id: string) => {
    setIssueItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEditing: true } : item))
    );
  };

  // Nhấn Enter hoặc bấm Lưu: Lưu và KHÓA DÒNG TẠI CHỖ (Giữ nguyên vị trí dòng, không thêm dòng thêm ô)
  const handleSaveRow = (id: string) => {
    const item = issueItems.find((r) => r.id === id);
    if (!item) return;

    if (!item.poNumber.trim() || !item.itemCode.trim()) {
      alert('Vui lòng nhập đầy đủ Mã PO và Code Vật tư!', 'Thiếu thông tin', 'warning');
      return;
    }

    const total = getItemTotal(item);
    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    const sq: Record<string, number> = {};
    sizes.forEach((s) => {
      sq[s] = typeof item.sizeQuantities[s] === 'number' ? Number(item.sizeQuantities[s]) : 0;
    });

    const issueData: ProductionIssueRow = {
      id: item.isNew ? `issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : item.id,
      customerId: currentCustomer?.id || '',
      issueDate: item.issueDate.trim() || defaultDate,
      poNumber: item.poNumber.trim().toUpperCase(),
      itemCode: item.itemCode.trim().toUpperCase(),
      detailName: item.detailName?.trim() || undefined,
      lineId: item.lineId,
      unit: item.unit || 'PRS',
      sizeQuantities: sq,
      totalQty: total,
      note: item.note.trim() || undefined,
    };

    if (item.isNew) {
      addProductionIssues([issueData]);
    } else {
      updateProductionIssue(issueData);
    }

    // KHÓA DÒNG NGAY TẠI CHỖ
    setIssueItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              id: issueData.id,
              isNew: false,
              isEditing: false, // Khóa dòng!
            }
          : r
      )
    );

    toast(`🔒 Đã lưu & khóa dòng PO ${issueData.poNumber} thành công! Nhấn Sửa ✏️ để mở khóa sửa lại.`);
  };

  // Xóa dòng
  const handleDeleteRow = (item: Tab6IssueItem) => {
    confirm(
      `Bạn có chắc muốn xóa đợt xuất PO ${item.poNumber || 'này'}?\nSố lượng sẽ tự động hoàn trả lại tồn kho Tab 5!`,
      () => {
        if (!item.isNew) {
          deleteProductionIssue(item.id);
        }
        setIssueItems((prev) => {
          const next = prev.filter((r) => r.id !== item.id);
          if (next.length === 0) {
            return [createBlankItem(0, true)];
          }
          return next;
        });
        toast(`Đã xóa dòng PO ${item.poNumber || ''}`);
      }
    );
  };

  // Cột ma trận dán Excel
  const draftColumns = useMemo(() => [
    { key: 'issueDate', type: 'date' as const },
    { key: 'poNumber', type: 'text' as const },
    { key: 'itemCode', type: 'text' as const },
    { key: 'detailName', type: 'text' as const },
    { key: 'lineId', type: 'line' as const },
    { key: 'unit', type: 'unit' as const },
    ...sizes.map((s) => ({ key: `size_${s}`, type: 'size' as const, size: s })),
    { key: 'note', type: 'note' as const },
  ], [sizes]);

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    const targetInput = target.closest('[data-row-idx]') as HTMLElement | null;
    if (target.tagName === 'INPUT' && !targetInput) return;

    const clipText = e.clipboardData.getData('text');
    if (!clipText) return;

    const rawLines = clipText.split(/\r?\n/);
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
      rawLines.pop();
    }
    if (rawLines.length === 0) return;

    const matrix = rawLines.map((line) => line.split('\t'));
    const isMultiCell = matrix.length > 1 || matrix[0].length > 1;

    if (!isMultiCell && targetInput && !clipText.includes('\t') && !clipText.includes('\n')) return;
    if (!targetInput && !isMultiCell) return;

    e.preventDefault();

    let startRowIdx = 0;
    let startColKey = 'issueDate';

    if (targetInput) {
      const rIdxStr = targetInput.getAttribute('data-row-idx');
      const cKeyStr = targetInput.getAttribute('data-col-key');
      if (rIdxStr !== null) startRowIdx = parseInt(rIdxStr, 10) || 0;
      if (cKeyStr) startColKey = cKeyStr;
    }

    handleApplyMatrixPaste(matrix, startRowIdx, startColKey);
  };

  const handleApplyMatrixPaste = (dataMatrix: string[][], startRowIdx: number = 0, startColKey: string = 'issueDate') => {
    if (!dataMatrix || dataMatrix.length === 0) return;

    const neededRowCount = startRowIdx + dataMatrix.length;
    let currentRows = [...issueItems];

    if (currentRows.length < neededRowCount) {
      const extraCount = neededRowCount - currentRows.length;
      for (let i = 0; i < extraCount; i++) {
        currentRows.push(createBlankItem(currentRows.length, true));
      }
    }

    const startColIdx = Math.max(0, draftColumns.findIndex((c) => c.key === startColKey));

    for (let r = 0; r < dataMatrix.length; r++) {
      const targetRowIndex = startRowIdx + r;
      const rowValues = dataMatrix[r];
      const targetRow = { ...currentRows[targetRowIndex], isEditing: true };
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

    setIssueItems(currentRows);
    toast(`📋 Đã dán thành công ${dataMatrix.length} dòng dữ liệu vào bảng!`);
  };

  // Lọc tìm kiếm
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return issueItems;
    const q = searchQuery.toLowerCase();
    return issueItems.filter(
      (i) =>
        i.poNumber.toLowerCase().includes(q) ||
        i.itemCode.toLowerCase().includes(q) ||
        (i.detailName && i.detailName.toLowerCase().includes(q)) ||
        i.lineId.toLowerCase().includes(q) ||
        (i.note && i.note.toLowerCase().includes(q))
    );
  }, [issueItems, searchQuery]);

  // Tổng cộng dải size
  const sizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredItems.reduce((sum, i) => {
        const q = i.sizeQuantities[s];
        return sum + (typeof q === 'number' ? q : 0);
      }, 0);
    });
    return totals;
  }, [filteredItems, sizes]);

  const grandTotal = useMemo(() => {
    return filteredItems.reduce((sum, i) => sum + getItemTotal(i), 0);
  }, [filteredItems, sizes]);

  // Xuất Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Xuất',
      'Mã PO',
      'Code Vật tư',
      'Tên Chi Tiết',
      'Bộ Phận Nhận (Chuyền)',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Xuất',
      'Ghi Chú',
    ];

    const dataRows = filteredItems.map((i, idx) => [
      idx + 1,
      i.issueDate,
      i.poNumber,
      i.itemCode,
      i.detailName || '',
      i.lineId,
      i.unit,
      ...sizes.map((s) => (typeof i.sizeQuantities[s] === 'number' ? i.sizeQuantities[s] : 0)),
      getItemTotal(i),
      i.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'XuatChoSX_Tab6');
    XLSX.writeFile(wb, `Tab6_XuatChoSX_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // In chuẩn bị
  const printRows: PrintTableRow[] = useMemo(() => {
    const list = selectedForPrint
      ? [selectedForPrint]
      : filteredItems.map((r) => {
          const sq: Record<string, number> = {};
          sizes.forEach((s) => {
            sq[s] = typeof r.sizeQuantities[s] === 'number' ? Number(r.sizeQuantities[s]) : 0;
          });
          return {
            id: r.id,
            customerId: currentCustomer?.id || '',
            issueDate: r.issueDate,
            poNumber: r.poNumber,
            itemCode: r.itemCode,
            lineId: r.lineId,
            unit: r.unit,
            sizeQuantities: sq,
            totalQty: getItemTotal(r),
            note: r.note,
          };
        });

    return list.map((r, idx) => ({
      stt: idx + 1,
      date: r.issueDate,
      voucherCode: r.lineId,
      poNumber: r.poNumber,
      code: r.itemCode,
      description: `Xuất cấp vật tư cho ${r.lineId}`,
      unit: r.unit,
      sizeQuantities: r.sizeQuantities,
      totalQty: r.totalQty,
      note: r.note,
    }));
  }, [selectedForPrint, filteredItems, sizes, currentCustomer]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onPaste={handleContainerPaste}
    >
      {/* Bảng Excel Duy Nhất */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Top Header & Toolbar */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Factory className="w-4 h-4 text-sky-600" />
              <span>TAB 6: XUẤT VẬT TƯ CHO SẢN XUẤT (CẤP PHÁT XUỐNG CHUYỀN)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Nhập số Enter lưu và khóa dòng tại chỗ • Bấm Sửa để mở khóa trực tiếp trên ô
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <div className="relative w-40 sm:w-48">
              <input
                type="text"
                placeholder="Tìm PO, Code Vật tư, chuyền..."
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
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In Bảng</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
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
              className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>+1 Dòng</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>+5 Dòng</span>
            </button>
          </div>
        </div>

        {/* Bảng Dữ Liệu Excel (Khóa dòng tại chỗ, mở khóa sửa ngay trên ô) */}
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-9">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[95px]">Ngày Xuất *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã PO *</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Code Vật tư *</th>
                <th className="p-2 border-r border-slate-300 min-w-[130px]">Tên Chi Tiết</th>
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
                <th className="p-2 text-center w-28">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredItems.map((item, idx) => {
                const isLocked = !item.isEditing;
                const rowTotal = getItemTotal(item);
                const rowStt = idx + 1; // Tự động tăng số thứ tự cho bất kỳ dòng nào

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isLocked ? 'bg-white hover:bg-slate-50' : 'bg-[#f0f7ff]'
                    }`}
                  >
                    {/* Cột STT: Tự động tăng số thứ tự */}
                    <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-slate-600 text-[11px]">
                      {rowStt}
                    </td>

                    {/* Ngày Xuất */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 font-mono text-slate-700 whitespace-nowrap">
                          {item.issueDate}
                        </div>
                      ) : (
                        <input
                          type="text"
                          data-row-idx={idx}
                          data-col-key="issueDate"
                          value={item.issueDate}
                          onChange={(e) => handleUpdateItemField(item.id, 'issueDate', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="DD/MM/YYYY"
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white font-mono"
                        />
                      )}
                    </td>

                    {/* Mã PO (Autocomplete Dropdown) */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 font-mono font-bold text-sky-700 whitespace-nowrap">
                          {item.poNumber}
                        </div>
                      ) : (
                        <SearchablePoSelect
                          value={item.poNumber}
                          pos={currentCustomerPOs}
                          rowIdx={idx}
                          colKey="poNumber"
                          onChange={(val) => handleUpdateItemField(item.id, 'poNumber', val)}
                          onSelectPo={(po) => {
                            if (!item.itemCode && po.style) {
                              handleUpdateItemField(item.id, 'itemCode', po.style);
                            }
                            if (!item.unit && po.unit) {
                              handleUpdateItemField(item.id, 'unit', po.unit);
                            }
                          }}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Mã PO..."
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-800 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      )}
                    </td>

                    {/* Code Vật tư */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {item.itemCode}
                        </div>
                      ) : (
                        <input
                          type="text"
                          data-row-idx={idx}
                          data-col-key="itemCode"
                          value={item.itemCode}
                          onChange={(e) => handleUpdateItemField(item.id, 'itemCode', e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Code Vật tư"
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-900 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      )}
                    </td>

                    {/* Tên Chi Tiết (Dropdown danh sách chi tiết có trong PO đó) */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 text-slate-700 whitespace-nowrap">
                          {item.detailName || '-'}
                        </div>
                      ) : (
                        <select
                          data-row-idx={idx}
                          data-col-key="detailName"
                          value={item.detailName || ''}
                          onChange={(e) => handleUpdateItemField(item.id, 'detailName', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white cursor-pointer text-slate-700 font-medium"
                        >
                          <option value="">-- Chọn chi tiết --</option>
                          {getPoDetails(item.poNumber).map((det) => (
                            <option key={det} value={det}>
                              {det}
                            </option>
                          ))}
                          {item.detailName && !getPoDetails(item.poNumber).includes(item.detailName) && (
                            <option value={item.detailName}>{item.detailName}</option>
                          )}
                        </select>
                      )}
                    </td>

                    {/* Bộ Phận Nhận (Chuyền) */}
                    <td className="p-0 border-r border-slate-200 bg-sky-50/40">
                      {isLocked ? (
                        <div className="p-2 font-semibold text-sky-900 whitespace-nowrap">
                          {item.lineId}
                        </div>
                      ) : (
                        <select
                          data-row-idx={idx}
                          data-col-key="lineId"
                          value={item.lineId}
                          onChange={(e) => handleUpdateItemField(item.id, 'lineId', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          className="w-full h-8 px-2 text-xs font-bold text-sky-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white cursor-pointer"
                        >
                          {LINE_OPTIONS.map((line) => (
                            <option key={line} value={line}>
                              {line}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* ĐVT */}
                    <td className="p-0 border-r border-slate-200 text-center">
                      {isLocked ? (
                        <div className="p-2 text-slate-600">{item.unit}</div>
                      ) : (
                        <select
                          data-row-idx={idx}
                          data-col-key="unit"
                          value={item.unit}
                          onChange={(e) => handleUpdateItemField(item.id, 'unit', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
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
                      )}
                    </td>

                    {/* Size Quantities */}
                    {sizes.map((s) => {
                      const val = item.sizeQuantities[s];
                      return (
                        <td key={s} className="p-0 border-r border-slate-200 text-center">
                          {isLocked ? (
                            <div
                              className={`p-2 font-mono font-bold ${
                                typeof val === 'number' && val > 0 ? 'text-slate-900 bg-slate-50/60' : 'text-slate-300'
                              }`}
                            >
                              {typeof val === 'number' && val > 0 ? val.toLocaleString('vi-VN') : '-'}
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              data-row-idx={idx}
                              data-col-key={`size_${s}`}
                              value={val ?? ''}
                              onChange={(e) => handleUpdateItemSizeQty(item.id, s, e.target.value)}
                              onKeyDown={(e) => {
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveRow(item.id);
                              }}
                              placeholder="-"
                              className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-slate-900 border border-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                          )}
                        </td>
                      );
                    })}

                    {/* Tổng Xuất */}
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-sky-50/60 text-sky-900">
                      {rowTotal > 0 ? rowTotal.toLocaleString('vi-VN') : '-'}
                    </td>

                    {/* Ghi Chú */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 text-slate-600 text-[11px] truncate max-w-[140px]">
                          {item.note || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          data-row-idx={idx}
                          data-col-key="note"
                          value={item.note}
                          onChange={(e) => handleUpdateItemField(item.id, 'note', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Ghi chú xuất..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      )}
                    </td>

                    {/* Thao Tác (Khóa có Xuất đủ, Sửa/Xóa, Đang sửa có Xuất đủ, Lưu/Xóa) */}
                    <td className="p-1.5 text-center whitespace-nowrap">
                      {isLocked ? (
                        <div className="flex items-center justify-center gap-1">
                          {/* Nút Xuất đủ */}
                          <button
                            type="button"
                            onClick={() => handleCopyAvailableStock(item.id)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 rounded border border-sky-200 transition cursor-pointer"
                            title="Xuất đủ theo tồn kho khả dụng hiện có của mã PO này"
                          >
                            Xuất đủ
                          </button>

                          {/* Nút Sửa: Mở khóa trực tiếp ngay tại ô */}
                          <button
                            type="button"
                            onClick={() => handleUnlockRow(item.id)}
                            className="p-1 text-slate-500 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Mở khóa dòng này để sửa trực tiếp trên ô"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Xóa */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(item)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa dòng xuất này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút In */}
                          <button
                            type="button"
                            onClick={() => {
                              const sq: Record<string, number> = {};
                              sizes.forEach((s) => {
                                sq[s] = typeof item.sizeQuantities[s] === 'number' ? Number(item.sizeQuantities[s]) : 0;
                              });
                              setSelectedForPrint({
                                id: item.id,
                                customerId: currentCustomer?.id || '',
                                issueDate: item.issueDate,
                                poNumber: item.poNumber,
                                itemCode: item.itemCode,
                                lineId: item.lineId,
                                unit: item.unit,
                                sizeQuantities: sq,
                                totalQty: getItemTotal(item),
                                note: item.note,
                              });
                              setShowPrintModal(true);
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                            title="In phiếu này"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {/* Nút Xuất đủ khi đang sửa */}
                          <button
                            type="button"
                            onClick={() => handleCopyAvailableStock(item.id)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 hover:bg-sky-50 rounded border border-sky-200 transition cursor-pointer"
                            title="Xuất đủ theo tồn kho khả dụng hiện có của mã PO này"
                          >
                            Xuất đủ
                          </button>

                          {/* Nút Lưu & Khóa dòng */}
                          <button
                            type="button"
                            onClick={() => handleSaveRow(item.id)}
                            className="px-2 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-0.5"
                            title="Lưu dữ liệu và khóa dòng lại (Enter)"
                          >
                            <Save className="w-3 h-3" />
                            <span>Lưu</span>
                          </button>

                          {/* Nút Xóa dòng nháp */}
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(item)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Hủy/Xóa dòng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* DÒNG TỔNG CỘNG TOÀN BỘ BẢNG */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-400">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG ĐÃ XUẤT CHO SẢN XUẤT:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                    {sizeTotals[s] > 0 ? sizeTotals[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-sky-950 bg-sky-200">
                  {grandTotal > 0 ? grandTotal.toLocaleString('vi-VN') : '0'}
                </td>
                <td colSpan={2} className="p-2 text-slate-600 text-[11px] italic">
                  Tổng {filteredItems.length} đợt xuất cấp
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="text-[11px]">
            <span>
              💡 <strong>Quy tắc thao tác:</strong> Nhập số lượng và nhấn <strong>Enter</strong> (hoặc bấm Lưu) để lưu và <strong>khóa dòng tại chỗ</strong>. Khi cần điều chỉnh, bấm nút <strong>Sửa ✏️</strong> để mở khóa sửa trực tiếp ngay trên ô, không mở form mới!
            </span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong className="text-sky-700">{filteredItems.length}</strong> dòng PO xuất cấp
          </div>
        </div>
      </div>

      {/* MODAL IN PHIẾU XUẤT CẤP CHO CHUYỀN */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setSelectedForPrint(null);
        }}
        documentTitle={
          selectedForPrint
            ? `PHIẾU XUẤT CẤP VẬT TƯ CHO ${selectedForPrint.lineId}`
            : 'BẢNG TỔNG HỢP XUẤT CẤP VẬT TƯ CHO SẢN XUẤT'
        }
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
        instructions="Copy các ô từ Excel (Ngày, Mã PO, Code Vật tư, Chuyền, ĐVT, các Size) và dán vào đây:"
      />
    </div>
  );
};
