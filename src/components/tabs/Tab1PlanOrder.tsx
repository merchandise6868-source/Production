import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { PlanOrderRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  Search,
  Edit,
  Trash2,
  Clipboard,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';
import { SearchablePoSelect } from '../common/SearchablePoSelect';
import { handleCellArrowNavigation } from '../../utils/tableNavigation';

export interface Tab1PlanItem {
  id: string;
  isNew?: boolean;
  isEditing: boolean;
  receiptDate: string;
  poNumber: string;
  round?: number;
  itemCode: string;
  voucherCode: string;
  description: string;
  unit: string;
  sizeQuantities: Record<string, number | ''>;
  status?: 'Hàng đơn' | 'Hàng bù (mua)' | 'Hàng bù';
  note: string;
}

export const Tab1PlanOrder: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
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

  const createBlankItem = (idx: number, isEditing: boolean = true): Tab1PlanItem => {
    const initialSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      initialSizes[s] = '';
    });
    return {
      id: `draft-plan-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      isNew: true,
      isEditing,
      receiptDate: defaultDate,
      poNumber: '',
      round: 1,
      itemCode: '',
      voucherCode: '',
      description: '',
      unit: 'PRS',
      sizeQuantities: initialSizes,
      status: '' as any,
      note: '',
    };
  };

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // State danh sách các dòng đơn kế hoạch trên bảng
  const [planItems, setPlanItems] = useState<Tab1PlanItem[]>(() => {
    if (currentCustomerPlanOrders.length > 0) {
      return currentCustomerPlanOrders.map((p) => {
        const sq: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          sq[s] = typeof p.sizeQuantities[s] === 'number' ? p.sizeQuantities[s] : '';
        });
        return {
          id: p.id,
          isNew: false,
          isEditing: false, // Mặc định khóa dòng
          receiptDate: p.receiptDate,
          poNumber: p.poNumber,
          round: p.round || 1,
          itemCode: p.itemCode,
          voucherCode: p.voucherCode || '',
          description: p.description || '',
          unit: p.unit || 'PRS',
          sizeQuantities: sq,
          status: p.status === 'Hàng bù' ? 'Hàng bù (mua)' : (p.status || 'Hàng đơn'),
          note: p.note || '',
        };
      });
    }
    return [createBlankItem(0, true)];
  });

  // Đồng bộ khi đổi khách hàng hoặc dữ liệu thay đổi
  useEffect(() => {
    if (currentCustomerPlanOrders.length === 0) {
      setPlanItems((prev) => {
        if (prev.length === 0) return [createBlankItem(0, true)];
        return prev;
      });
      return;
    }

    setPlanItems((prev) => {
      const editingMap = new Map(prev.filter((p) => p.isEditing).map((p) => [p.id, p]));
      const newItems: Tab1PlanItem[] = currentCustomerPlanOrders.map((p) => {
        if (editingMap.has(p.id)) {
          return editingMap.get(p.id)!;
        }
        const sq: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          sq[s] = typeof p.sizeQuantities[s] === 'number' ? p.sizeQuantities[s] : '';
        });
        return {
          id: p.id,
          isNew: false,
          isEditing: false,
          receiptDate: p.receiptDate,
          poNumber: p.poNumber,
          round: p.round || 1,
          itemCode: p.itemCode,
          voucherCode: p.voucherCode || '',
          description: p.description || '',
          unit: p.unit || 'PRS',
          sizeQuantities: sq,
          status: p.status === 'Hàng bù' ? 'Hàng bù (mua)' : (p.status || 'Hàng đơn'),
          note: p.note || '',
        };
      });

      const unsavedNewRows = prev.filter((p) => p.isNew && p.isEditing);
      return [...newItems, ...unsavedNewRows];
    });
  }, [currentCustomerPlanOrders, currentCustomer?.id]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForPrint, setSelectedForPrint] = useState<PlanOrderRow | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // Thêm dòng mới: Tự tăng số thứ tự
  const handleAddRows = (count: number = 1) => {
    setPlanItems((prev) => {
      const added: Tab1PlanItem[] = [];
      for (let i = 0; i < count; i++) {
        added.push(createBlankItem(prev.length + i, true));
      }
      return [...prev, ...added];
    });
    toast(`➕ Đã thêm ${count} dòng mới với số thứ tự tăng tự động!`);
  };

  const handleUpdateItemField = (id: string, field: keyof Tab1PlanItem, value: any) => {
    setPlanItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'itemCode' && !item.description) {
          updated.description = `Vật tư ${value}`;
        }
        return updated;
      })
    );
  };

  const handleUpdateItemSizeQty = (id: string, size: string, val: string) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setPlanItems((prev) =>
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

  const getItemTotal = (item: Tab1PlanItem): number => {
    return sizes.reduce((sum, s) => {
      const q = item.sizeQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  // Mở khóa sửa trực tiếp trên dòng đó (Không mở form popup!)
  const handleUnlockRow = (id: string) => {
    setPlanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEditing: true } : item))
    );
  };

  // Cập nhật trạng thái tức thời (Hàng đơn <-> Hàng bù (mua)) và tự động lưu đồng bộ
  const handleStatusChange = (id: string, newStatus: 'Hàng đơn' | 'Hàng bù (mua)') => {
    handleUpdateItemField(id, 'status', newStatus);
    const existing = currentCustomerPlanOrders.find((p) => p.id === id);
    if (existing) {
      updatePlanOrder({ ...existing, status: newStatus });
      toast(`✅ Đã lưu trạng thái: ${newStatus}`);
    }
  };

  // Nhấn Enter hoặc bấm Lưu: Lưu và KHÓA DÒNG TẠI CHỖ (Giữ nguyên vị trí dòng, không thêm dòng thêm ô)
  const handleSaveRow = (id: string) => {
    const item = planItems.find((r) => r.id === id);
    if (!item) return;

    if (!item.poNumber.trim() || !item.itemCode.trim()) {
      alert('Vui lòng nhập đầy đủ Mã PO và Code Vật tư!', 'Thiếu thông tin', 'warning');
      return;
    }

    if (!item.status) {
      alert('Vui lòng chọn Trạng Thái (Hàng đơn hoặc Hàng bù (mua))!', 'Chưa chọn Trạng Thái', 'warning');
      return;
    }

    const total = getItemTotal(item);
    if (total <= 0) {
      alert('Vui lòng nhập số lượng cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    const sq: Record<string, number> = {};
    sizes.forEach((s) => {
      sq[s] = typeof item.sizeQuantities[s] === 'number' ? Number(item.sizeQuantities[s]) : 0;
    });

    const planData: PlanOrderRow = {
      id: item.isNew ? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : item.id,
      customerId: currentCustomer?.id || '',
      receiptDate: item.receiptDate.trim() || defaultDate,
      poNumber: item.poNumber.trim().toUpperCase(),
      round: item.round || 1,
      itemCode: item.itemCode.trim().toUpperCase(),
      voucherCode: item.voucherCode.trim() || undefined,
      description: item.description.trim() || `Vật tư ${item.itemCode}`,
      unit: item.unit || 'PRS',
      sizeQuantities: sq,
      totalQty: total,
      status: item.status as any,
      note: item.note.trim() || undefined,
    };

    if (item.isNew) {
      addPlanOrders([planData]);
    } else {
      updatePlanOrder(planData);
    }

    // KHÓA DÒNG NGAY TẠI CHỖ
    setPlanItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              id: planData.id,
              isNew: false,
              isEditing: false, // Khóa dòng!
            }
          : r
      )
    );

    toast(`🔒 Đã lưu & khóa dòng PO ${planData.poNumber} (Lần ${planData.round || 1}) thành công! Nhấn Sửa ✏️ để mở khóa sửa lại.`);
  };

  // Xóa dòng
  const handleDeleteRow = (item: Tab1PlanItem) => {
    confirm(`Bạn có chắc muốn xóa dòng kế hoạch PO ${item.poNumber || 'này'}?`, () => {
      if (!item.isNew) {
        deletePlanOrder(item.id);
      }
      setPlanItems((prev) => {
        const next = prev.filter((r) => r.id !== item.id);
        if (next.length === 0) {
          return [createBlankItem(0, true)];
        }
        return next;
      });
      toast(`Đã xóa dòng PO ${item.poNumber || ''}`);
    });
  };

  // Cột ma trận dán Excel
  const draftColumns = useMemo(() => [
    { key: 'receiptDate', type: 'date' as const },
    { key: 'poNumber', type: 'text' as const },
    { key: 'round', type: 'number' as const },
    { key: 'itemCode', type: 'text' as const },
    { key: 'status', type: 'status' as const },
    { key: 'voucherCode', type: 'text' as const },
    { key: 'description', type: 'text' as const },
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
    let startColKey = 'receiptDate';

    if (targetInput) {
      const rIdxStr = targetInput.getAttribute('data-row-idx');
      const cKeyStr = targetInput.getAttribute('data-col-key');
      if (rIdxStr !== null) startRowIdx = parseInt(rIdxStr, 10) || 0;
      if (cKeyStr) startColKey = cKeyStr;
    }

    handleApplyMatrixPaste(matrix, startRowIdx, startColKey);
  };

  const handleApplyMatrixPaste = (dataMatrix: string[][], startRowIdx: number = 0, startColKey: string = 'receiptDate') => {
    if (!dataMatrix || dataMatrix.length === 0) return;

    const neededRowCount = startRowIdx + dataMatrix.length;
    let currentRows = [...planItems];

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
          if (rawVal) targetRow.receiptDate = rawVal;
        } else if (colDef.type === 'number' || colDef.key === 'round') {
          targetRow.round = Math.max(1, parseInt(rawVal) || 1);
        } else if (colDef.type === 'text') {
          if (colDef.key === 'poNumber') targetRow.poNumber = rawVal.toUpperCase();
          else if (colDef.key === 'itemCode') {
            targetRow.itemCode = rawVal.toUpperCase();
            if (!targetRow.description) targetRow.description = `Vật tư ${rawVal.toUpperCase()}`;
          } else if (colDef.key === 'voucherCode') targetRow.voucherCode = rawVal;
          else if (colDef.key === 'description') targetRow.description = rawVal;
        } else if (colDef.type === 'unit') {
          if (rawVal) targetRow.unit = rawVal;
        } else if (colDef.type === 'status') {
          targetRow.status = /bù/i.test(rawVal) ? 'Hàng bù (mua)' : 'Hàng đơn';
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

    setPlanItems(currentRows);
    toast(`📋 Đã dán thành công ${dataMatrix.length} dòng dữ liệu vào bảng!`);
  };

  // Lọc tìm kiếm
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return planItems;
    const q = searchQuery.toLowerCase();
    return planItems.filter(
      (p) =>
        p.poNumber.toLowerCase().includes(q) ||
        p.itemCode.toLowerCase().includes(q) ||
        p.voucherCode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.note && p.note.toLowerCase().includes(q))
    );
  }, [planItems, searchQuery]);

  // Tổng cộng dải size
  const sizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredItems.reduce((sum, p) => {
        const q = p.sizeQuantities[s];
        return sum + (typeof q === 'number' ? q : 0);
      }, 0);
    });
    return totals;
  }, [filteredItems, sizes]);

  const grandTotal = useMemo(() => {
    return filteredItems.reduce((sum, p) => sum + getItemTotal(p), 0);
  }, [filteredItems, sizes]);

  // Xuất Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Nhận',
      'Mã PO',
      'Lần',
      'Code Vật tư',
      'Trạng Thái',
      'Số Phiếu Giao',
      'Quy Cách / Diễn Giải',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Kế Hoạch',
      'Ghi Chú',
    ];

    const dataRows = filteredItems.map((p, idx) => [
      idx + 1,
      p.receiptDate,
      p.poNumber,
      p.round || 1,
      p.itemCode,
      p.status || 'Hàng đơn',
      p.voucherCode,
      p.description,
      p.unit,
      ...sizes.map((s) => (typeof p.sizeQuantities[s] === 'number' ? p.sizeQuantities[s] : 0)),
      getItemTotal(p),
      p.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoVatTuTrenPhieu_Tab1');
    XLSX.writeFile(wb, `Tab1_SoVatTuTrenPhieu_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // In chuẩn bị
  const printRows: PrintTableRow[] = useMemo(() => {
    const list = selectedForPrint
      ? [selectedForPrint]
      : filteredItems.map((p) => {
          const sq: Record<string, number> = {};
          sizes.forEach((s) => {
            sq[s] = typeof p.sizeQuantities[s] === 'number' ? Number(p.sizeQuantities[s]) : 0;
          });
          return {
            id: p.id,
            customerId: currentCustomer?.id || '',
            receiptDate: p.receiptDate,
            poNumber: p.poNumber,
            itemCode: p.itemCode,
            voucherCode: p.voucherCode,
            description: p.description,
            unit: p.unit,
            sizeQuantities: sq,
            totalQty: getItemTotal(p),
            note: p.note,
          };
        });

    return list.map((r, idx) => ({
      stt: idx + 1,
      date: r.receiptDate,
      voucherCode: r.voucherCode || `PO-${r.poNumber}`,
      poNumber: r.poNumber,
      code: r.itemCode,
      description: r.description || `Vật tư ${r.itemCode}`,
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
              <FileSpreadsheet className="w-4 h-4 text-sky-600" />
              <span>TAB 1: SỐ VẬT TƯ TRÊN PHIẾU (KHÁCH HÀNG GỬI)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Nhập số Enter lưu và khóa dòng tại chỗ • Bấm Sửa để mở khóa trực tiếp trên ô
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <div className="relative w-40 sm:w-48">
              <input
                type="text"
                placeholder="Tìm PO, Code Vật tư, phiếu..."
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
        <div ref={gridContainerRef} className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-9">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[95px]">Ngày Nhận *</th>
                <th className="p-2 border-r border-slate-300 min-w-[130px]">Mã PO *</th>
                <th className="p-2 border-r border-slate-300 text-center w-14 bg-amber-50/80 text-amber-950 font-bold">
                  Lần
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Code Vật tư *</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px] text-center bg-indigo-50/80 text-indigo-900 font-bold">
                  Trạng Thái
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Số Phiếu Giao</th>
                <th className="p-2 border-r border-slate-300 min-w-[140px]">Quy Cách / Diễn Giải</th>
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
                  TỔNG SL
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[130px]">Ghi Chú</th>
                <th className="p-2 text-center w-24">Thao Tác</th>
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

                    {/* Ngày Nhận */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 font-mono text-slate-700 whitespace-nowrap">
                          {item.receiptDate}
                        </div>
                      ) : (
                        <input
                          type="text"
                          data-row-idx={idx}
                          data-col-key="receiptDate"
                          value={item.receiptDate}
                          onChange={(e) => handleUpdateItemField(item.id, 'receiptDate', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="DD/MM/YYYY"
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white font-mono"
                        />
                      )}
                    </td>

                    {/* Mã PO (Autocomplete Dropdown gợi ý khi gõ) */}
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
                          placeholder="Gõ mã PO..."
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-800 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      )}
                    </td>

                    {/* Cột Lần */}
                    <td className="p-0 border-r border-slate-200 text-center bg-amber-50/20">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 text-center font-mono font-bold text-amber-900 whitespace-nowrap cursor-pointer hover:bg-amber-100/50 transition-colors"
                          title="Click để sửa Lần"
                        >
                          Lần {item.round || 1}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          data-row-idx={idx}
                          data-col-key="round"
                          value={item.round ?? 1}
                          onChange={(e) =>
                            handleUpdateItemField(item.id, 'round', Math.max(1, parseInt(e.target.value) || 1))
                          }
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white text-amber-900"
                        />
                      )}
                    </td>

                    {/* Code Vật tư (trước là Mã hàng TT) */}
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

                    {/* Trạng Thái (Dropdown: Hàng đơn hoặc Hàng bù (mua)) */}
                    <td className="p-0 border-r border-slate-200 text-center bg-indigo-50/20">
                      <select
                        data-row-idx={idx}
                        data-col-key="status"
                        value={item.status === 'Hàng bù' ? 'Hàng bù (mua)' : (item.status || '')}
                        onChange={(e) =>
                          handleStatusChange(item.id, e.target.value as 'Hàng đơn' | 'Hàng bù (mua)')
                        }
                        onKeyDown={(e) => {
                          handleCellArrowNavigation(e, gridContainerRef);
                          if (e.key === 'Enter') handleSaveRow(item.id);
                        }}
                        className={`w-full h-8 px-1 text-xs font-semibold bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white cursor-pointer text-center ${
                          item.status === 'Hàng bù (mua)' || item.status === 'Hàng bù'
                            ? 'text-purple-800 font-bold bg-purple-50'
                            : item.status === 'Hàng đơn'
                            ? 'text-sky-800 font-bold'
                            : 'text-amber-700 italic font-normal'
                        }`}
                      >
                        <option value="">-- Chọn trạng thái --</option>
                        <option value="Hàng đơn">Hàng đơn</option>
                        <option value="Hàng bù (mua)">Hàng bù (mua)</option>
                      </select>
                    </td>

                    {/* Số Phiếu Giao */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 text-slate-700 whitespace-nowrap">{item.voucherCode || '-'}</div>
                      ) : (
                        <input
                          type="text"
                          data-row-idx={idx}
                          data-col-key="voucherCode"
                          value={item.voucherCode}
                          onChange={(e) => handleUpdateItemField(item.id, 'voucherCode', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Số phiếu giao..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      )}
                    </td>

                    {/* Quy Cách / Diễn Giải */}
                    <td className="p-0 border-r border-slate-200">
                      {isLocked ? (
                        <div className="p-2 text-slate-700 truncate max-w-[150px]">{item.description}</div>
                      ) : (
                        <input
                          type="text"
                          data-row-idx={idx}
                          data-col-key="description"
                          value={item.description}
                          onChange={(e) => handleUpdateItemField(item.id, 'description', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Quy cách vật tư..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
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

                    {/* Tổng SL */}
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
                          placeholder="Ghi chú đơn..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white"
                        />
                      )}
                    </td>

                    {/* Thao Tác (Khóa có Sửa/Xóa, Đang sửa có Lưu/Xóa) */}
                    <td className="p-1.5 text-center whitespace-nowrap">
                      {isLocked ? (
                        <div className="flex items-center justify-center gap-1">
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
                            title="Xóa dòng kế hoạch này"
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
                                receiptDate: item.receiptDate,
                                poNumber: item.poNumber,
                                itemCode: item.itemCode,
                                voucherCode: item.voucherCode,
                                description: item.description,
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
                          {/* Nút Lưu & Khóa dòng */}
                          <button
                            type="button"
                            onClick={() => handleSaveRow(item.id)}
                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-1"
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
                <td colSpan={8} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG TRÊN PHIẾU KẾ HOẠCH:
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
                  Tổng {filteredItems.length} dòng vật tư kế hoạch
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
            Tổng cộng: <strong className="text-sky-700">{filteredItems.length}</strong> dòng PO kế hoạch
          </div>
        </div>
      </div>

      {/* MODAL IN PHIẾU KẾ HOẠCH */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setSelectedForPrint(null);
        }}
        documentTitle={
          selectedForPrint
            ? `PHIẾU VẬT TƯ ĐƠN HÀNG - PO: ${selectedForPrint.poNumber}`
            : 'BẢNG TỔNG HỢP SỐ VẬT TƯ TRÊN PHIẾU'
        }
        documentNumber={selectedForPrint ? `PKH-${selectedForPrint.poNumber}` : 'TH-KE-HOACH'}
        dateStr={selectedForPrint?.receiptDate || defaultDate}
        customerName={currentCustomer?.name || 'Khách hàng'}
        poNumber={selectedForPrint?.poNumber}
        sizes={sizes}
        rows={printRows}
      />

      {/* MODAL DÁN EXCEL TIỆN ÍCH */}
      <ExcelPasteModal
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        onApply={(matrix) => handleApplyMatrixPaste(matrix, 0, 'receiptDate')}
        title="Dán dữ liệu số trên phiếu từ Excel"
        instructions="Copy các ô từ Excel (Ngày, Mã PO, Code Vật tư, Số Phiếu, Quy Cách, ĐVT, các Size) và dán vào đây:"
      />
    </div>
  );
};
