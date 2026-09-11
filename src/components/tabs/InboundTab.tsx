import React, { useState, useRef, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialReceipt } from '../../types';
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
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { exportInboundReceiptsToExcel } from '../../utils/excelExport';
import {
  parseInboundMatrixClipboard,
  ParsedInboundMatrixRow,
} from '../../utils/excelClipboard';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';

interface DraftMatrixRow {
  id: string;
  receiptDate: string;
  voucherCode: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  unit: string;
  sizeQuantities: Record<string, number | ''>;
  isCompReceipt: boolean;
  note: string;
}

interface SavedMatrixGroup {
  groupKey: string;
  receiptDate: string;
  voucherCode: string;
  poId: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  unit: string;
  isCompensationReceipt: boolean;
  note: string;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  receiptIds: string[];
}

export const InboundTab: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerReceipts,
    addReceipt,
    updateReceipt,
    deleteReceipt,
    addPurchaseOrder,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();

  // Dynamic horizontal sizes from customer's active size run
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  // Helper to create an empty draft matrix row
  const createEmptyRow = (): DraftMatrixRow => {
    const initialSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      initialSizes[s] = '';
    });

    return {
      id: `draft-mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      receiptDate: defaultDate,
      voucherCode: '',
      poNumber: currentCustomerPOs[0]?.poNumber || '',
      originalName: '',
      vnName: '',
      unit: 'PRS',
      sizeQuantities: initialSizes,
      isCompReceipt: false,
      note: '',
    };
  };

  // Draft rows state - start with 2 empty rows for immediate typing
  const [draftRows, setDraftRows] = useState<DraftMatrixRow[]>([
    createEmptyRow(),
    createEmptyRow(),
  ]);

  // Sub-tab view mode: 'ENTRY' (Chỉ hiển thị bảng nhập) vs 'HISTORY' (Sổ nhật ký đã lưu)
  const [activeSubTab, setActiveSubTab] = useState<'ENTRY' | 'HISTORY'>('ENTRY');

  // Modals
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDataSource, setPrintDataSource] = useState<'DRAFT' | 'SAVED'>('SAVED');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingGroup, setEditingGroup] = useState<SavedMatrixGroup | null>(null);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Add 1 or more draft rows
  const handleAddRows = (count: number = 1) => {
    const newRows: DraftMatrixRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setDraftRows((prev) => [...prev, ...newRows]);
  };

  // Update a field in a draft row
  const handleUpdateDraftField = (
    id: string,
    field: keyof DraftMatrixRow,
    value: any
  ) => {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'originalName' && !r.vnName) {
          updated.vnName = value;
        }
        return updated;
      })
    );
  };

  // Update quantity for a specific size in a draft row
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

  // Remove a draft row
  const handleRemoveDraftRow = (id: string) => {
    if (draftRows.length <= 1) {
      setDraftRows([createEmptyRow()]);
      return;
    }
    setDraftRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Clear all draft rows
  const handleClearDraftRows = () => {
    if (window.confirm('Bạn có muốn xóa trắng các dòng đang nhập dở?')) {
      setDraftRows([createEmptyRow(), createEmptyRow()]);
    }
  };

  // Calculate row total sum across all sizes
  const getRowTotal = (row: DraftMatrixRow): number => {
    return sizes.reduce((sum, s) => {
      const q = row.sizeQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  // Check valid draft rows ready to save
  const validDraftRows = draftRows.filter((r) => {
    const total = getRowTotal(r);
    const hasName = r.originalName.trim() || r.vnName.trim();
    return hasName && total > 0;
  });

  // Calculate draft columns totals (Hàng tổng cộng chân bảng như Hình 2)
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

  // SAVE ALL DRAFT ROWS
  const handleSaveAllDraftRows = () => {
    if (!currentCustomer) {
      alert('Chưa chọn Khách hàng.');
      return;
    }

    if (validDraftRows.length === 0) {
      alert('Chưa có dòng nào có số lượng hợp lệ để lưu! Vui lòng nhập Mã Hàng và Số Lượng các Size.');
      return;
    }

    let savedRowCount = 0;

    validDraftRows.forEach((row, rIdx) => {
      const cleanPoNum = row.poNumber.trim().toUpperCase() || 'PO-CHUNG';
      let po = currentCustomerPOs.find(
        (p) => p.poNumber.toUpperCase() === cleanPoNum
      );

      let finalPoId = po?.id;
      if (!po) {
        const newPo = {
          id: `po-${Date.now()}-${rIdx}`,
          customerId: currentCustomer.id,
          poNumber: cleanPoNum,
          style: row.vnName.trim() || 'Style tiêu chuẩn',
          orderDate: row.receiptDate.trim() || defaultDate,
          targetQty: getRowTotal(row),
          unit: row.unit || 'PRS',
        };
        addPurchaseOrder(newPo);
        finalPoId = newPo.id;
      }

      const batchId = `batch-${Date.now()}-${rIdx}-${Math.random().toString(36).slice(2, 6)}`;
      const voucherCode = row.voucherCode.trim();

      sizes.forEach((s) => {
        const qty = row.sizeQuantities[s];
        if (typeof qty === 'number' && qty > 0) {
          const newReceipt: MaterialReceipt = {
            id: `rec-${batchId}-${s}`,
            receiptDate: row.receiptDate.trim() || defaultDate,
            voucherCode: voucherCode || undefined,
            batchId,
            poId: finalPoId!,
            customerId: currentCustomer.id,
            originalName: row.originalName.trim() || row.vnName.trim() || 'Vật tư',
            vnName: row.vnName.trim() || row.originalName.trim() || 'Vật tư',
            size: s,
            unit: row.unit || 'PRS',
            qtyDoc: qty,
            qtyActual: qty,
            discrepancy: 0,
            isCompensationReceipt: row.isCompReceipt,
            note: row.note.trim() || (voucherCode ? `Phiếu ${voucherCode}` : undefined),
          };

          addReceipt(newReceipt);
        }
      });

      savedRowCount++;
    });

    setDraftRows([createEmptyRow(), createEmptyRow()]);
    setActiveSubTab('HISTORY');
    alert(`✅ Đã lưu thành công ${savedRowCount} phiếu vật tư vào Sổ Nhật Ký Nhập Kho!`);
  };

  // Keyboard shortcut: Ctrl + Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveAllDraftRows();
    }
  };

  // Apply parsed matrix rows from Excel clipboard
  const applyParsedMatrixRows = (parsed: ParsedInboundMatrixRow[]) => {
    const newDrafts: DraftMatrixRow[] = parsed.map((p, idx) => {
      const sizeQtyMap: Record<string, number | ''> = {};
      sizes.forEach((s) => {
        sizeQtyMap[s] = p.sizeQuantities[s] || '';
      });

      return {
        id: `paste-mat-${Date.now()}-${idx}`,
        receiptDate: p.receiptDate || defaultDate,
        voucherCode: p.voucherCode || '',
        poNumber: p.poNumber || currentCustomerPOs[0]?.poNumber || '',
        originalName: p.originalName,
        vnName: p.vnName,
        unit: p.unit || 'PRS',
        sizeQuantities: sizeQtyMap,
        isCompReceipt: false,
        note: p.note || '',
      };
    });

    setDraftRows((prev) => {
      const nonEmpties = prev.filter(
        (r) => r.originalName.trim() || getRowTotal(r) > 0
      );
      return [...nonEmpties, ...newDrafts];
    });
  };

  // Container paste handler
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    const clipText = e.clipboardData.getData('text');
    if (!clipText || !clipText.includes('\t')) return;

    e.preventDefault();
    const parsed = parseInboundMatrixClipboard(clipText, defaultDate, sizes, 'PRS');
    if (parsed.length > 0) {
      applyParsedMatrixRows(parsed);
      alert(`📋 Đã tự động dán và chuyển đổi ${parsed.length} dòng vật tư từ Excel!`);
    }
  };

  // =========================================================================
  // GROUP SAVED RECEIPTS INTO HORIZONTAL MATRIX
  // =========================================================================
  const savedMatrixGroups = useMemo((): SavedMatrixGroup[] => {
    const map = new Map<string, SavedMatrixGroup>();

    currentCustomerReceipts.forEach((r) => {
      const po = currentCustomerPOs.find((p) => p.id === r.poId);
      const poNum = po?.poNumber || 'PO-CHUNG';
      const key =
        r.batchId ||
        (r.voucherCode
          ? `${r.receiptDate}_${r.voucherCode}_${r.originalName}`
          : `${r.receiptDate}_${r.poId}_${r.originalName}`);

      let group = map.get(key);
      if (!group) {
        group = {
          groupKey: key,
          receiptDate: r.receiptDate,
          voucherCode: r.voucherCode || '',
          poId: r.poId,
          poNumber: poNum,
          originalName: r.originalName,
          vnName: r.vnName,
          unit: r.unit,
          isCompensationReceipt: !!r.isCompensationReceipt,
          note: r.note || '',
          sizeQuantities: {},
          totalQty: 0,
          receiptIds: [],
        };
        map.set(key, group);
      }

      const qty = r.qtyActual || r.qtyDoc || 0;
      group.sizeQuantities[r.size] = (group.sizeQuantities[r.size] || 0) + qty;
      group.totalQty += qty;
      group.receiptIds.push(r.id);
    });

    return Array.from(map.values());
  }, [currentCustomerReceipts, currentCustomerPOs]);

  // Filtered saved groups
  const filteredSavedGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return savedMatrixGroups.filter(
      (g) =>
        g.poNumber.toLowerCase().includes(q) ||
        g.voucherCode.toLowerCase().includes(q) ||
        g.originalName.toLowerCase().includes(q) ||
        g.vnName.toLowerCase().includes(q) ||
        g.receiptDate.includes(q)
    );
  }, [savedMatrixGroups, searchQuery]);

  // Saved matrix totals
  const savedSizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredSavedGroups.reduce(
        (sum, g) => sum + (g.sizeQuantities[s] || 0),
        0
      );
    });
    return totals;
  }, [filteredSavedGroups, sizes]);

  const savedGrandTotal = useMemo(() => {
    return filteredSavedGroups.reduce((sum, g) => sum + g.totalQty, 0);
  }, [filteredSavedGroups]);

  // Delete saved group
  const handleDeleteSavedGroup = (group: SavedMatrixGroup) => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa toàn bộ đợt nhập của "${group.originalName}" (${group.totalQty} ${group.unit}) không?`
      )
    ) {
      group.receiptIds.forEach((id) => deleteReceipt(id));
      alert('Đã xóa phiếu vật tư thành công!');
    }
  };

  // Save Edit Modal
  const handleSaveEditGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;

    sizes.forEach((s) => {
      const existingId = `rec-${editingGroup.groupKey}-${s}`;
      const existingRec = currentCustomerReceipts.find(
        (r) => r.id === existingId || (editingGroup.receiptIds.includes(r.id) && r.size === s)
      );
      const newQty = editingGroup.sizeQuantities[s] || 0;

      if (existingRec) {
        if (newQty > 0) {
          updateReceipt({
            ...existingRec,
            receiptDate: editingGroup.receiptDate,
            voucherCode: editingGroup.voucherCode || undefined,
            originalName: editingGroup.originalName,
            vnName: editingGroup.vnName,
            unit: editingGroup.unit,
            qtyDoc: newQty,
            qtyActual: newQty,
            discrepancy: 0,
            note: editingGroup.note,
          });
        } else {
          deleteReceipt(existingRec.id);
        }
      } else if (newQty > 0) {
        addReceipt({
          id: `rec-${editingGroup.groupKey}-${s}-${Date.now()}`,
          receiptDate: editingGroup.receiptDate,
          voucherCode: editingGroup.voucherCode || undefined,
          batchId: editingGroup.groupKey,
          poId: editingGroup.poId,
          customerId: currentCustomer?.id || '',
          originalName: editingGroup.originalName,
          vnName: editingGroup.vnName,
          size: s,
          unit: editingGroup.unit,
          qtyDoc: newQty,
          qtyActual: newQty,
          discrepancy: 0,
          isCompensationReceipt: editingGroup.isCompensationReceipt,
          note: editingGroup.note,
        });
      }
    });

    setEditingGroup(null);
    alert('Đã cập nhật phiếu vật tư thành công!');
  };

  // Prepare Print rows
  const printRows: PrintTableRow[] = useMemo(() => {
    if (printDataSource === 'DRAFT') {
      return validDraftRows.map((r, idx) => {
        const sq: Record<string, number> = {};
        sizes.forEach((s) => {
          sq[s] = typeof r.sizeQuantities[s] === 'number' ? (r.sizeQuantities[s] as number) : 0;
        });
        return {
          stt: idx + 1,
          date: r.receiptDate,
          voucherCode: r.voucherCode,
          poNumber: r.poNumber,
          code: r.originalName,
          description: r.vnName,
          unit: r.unit,
          sizeQuantities: sq,
          totalQty: getRowTotal(r),
          note: r.note,
        };
      });
    }

    return filteredSavedGroups.map((g, idx) => ({
      stt: idx + 1,
      date: g.receiptDate,
      voucherCode: g.voucherCode,
      poNumber: g.poNumber,
      code: g.originalName,
      description: g.vnName,
      unit: g.unit,
      sizeQuantities: g.sizeQuantities,
      totalQty: g.totalQty,
      note: g.note,
    }));
  }, [printDataSource, validDraftRows, filteredSavedGroups, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* THANH CHUYỂN TAB: 1. BẢNG NHẬP LIỆU vs 2. SỔ NHẬT KÝ ĐÃ LƯU (TÁCH BIỆT ĐỂ GIAO DIỆN GỌN GÀNG, ĐỠ RỐI MẮT) */}
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
            <span>1. Bảng Nhập Phiếu Mới</span>
            {validDraftRows.length > 0 && (
              <span className="bg-sky-100 text-sky-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {validDraftRows.length} dòng
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('HISTORY')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded transition-all ${
              activeSubTab === 'HISTORY'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            <span>2. Sổ Nhật Ký Nhập Kho Đã Lưu</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredSavedGroups.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {activeSubTab === 'ENTRY' ? (
            <button
              type="button"
              onClick={() => setActiveSubTab('HISTORY')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 transition"
              title="Chuyển sang xem Sổ nhật ký các phiếu đã lưu"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem Sổ Nhật Ký ({filteredSavedGroups.length} phiếu) ➔</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSubTab('ENTRY')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-md border border-sky-200 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nhập Thêm Phiếu Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC 1: BẢNG NHẬP DỮ LIỆU CHUẨN ERP PHẲNG (CHỈ HIỂN THỊ KHI Ở TAB NHẬP) */}
      {/* ========================================================================= */}
      {activeSubTab === 'ENTRY' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          {/* Top Toolbar (Chuẩn ERP Hình 2) */}
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Bảng Nhập Phiếu Vật Tư (Dải Size Ngang)
              </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Nhập trực tiếp vào ô lưới, Enter để lưu
            </span>
          </div>

          {/* Action buttons (Giống Hình 2) */}
          <div className="flex items-center flex-wrap gap-1.5">
            {/* NÚT IN HTML (THEO YÊU CẦU NGƯỜI DÙNG) */}
            <button
              type="button"
              onClick={() => {
                setPrintDataSource('DRAFT');
                setShowPrintModal(true);
              }}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              title="In bản HTML bảng đang nhập"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In HTML</span>
            </button>

            {/* Dán từ Excel */}
            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              title="Dán từ Excel (Ctrl+V)"
            >
              <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dán Excel</span>
            </button>

            {/* +1 Dòng */}
            <button
              type="button"
              onClick={() => handleAddRows(1)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>+1 Dòng</span>
            </button>

            {/* +5 Dòng */}
            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs"
            >
              <Plus className="w-3 h-3 text-sky-600" />
              <span>+5 Dòng</span>
            </button>

            {/* Xóa trắng */}
            <button
              type="button"
              onClick={handleClearDraftRows}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
              title="Xóa trắng các dòng"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* LƯU DỮ LIỆU */}
            <button
              type="button"
              onClick={handleSaveAllDraftRows}
              disabled={validDraftRows.length === 0}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>LƯU DỮ LIỆU (ENTER) {validDraftRows.length > 0 && `(${validDraftRows.length})`}</span>
            </button>
          </div>
        </div>

        {/* Flat ERP Table Grid (Không viền to, không bo tròn cồng kềnh - Chuẩn Hình 2) */}
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[95px]">Ngày Nhập</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Số Phiếu KH</th>
                <th className="p-2 border-r border-slate-300 min-w-[100px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT Code) *</th>
                <th className="p-2 border-r border-slate-300 min-w-[145px]">Diễn Giải (VN)</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">ĐVT</th>

                {/* Horizontal Size Headers */}
                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[80px] text-right bg-slate-100 text-slate-900 font-bold">
                  TỔNG CỘNG
                </th>
                <th className="p-2 border-r border-slate-300 text-center w-12">Bù?</th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Ghi Chú</th>
                <th className="p-2 text-center w-8">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {draftRows.map((row, idx) => {
                const totalQty = getRowTotal(row);

                return (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    {/* STT */}
                    <td className="p-1 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Ngày */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.receiptDate}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'receiptDate', e.target.value)
                        }
                        placeholder="DD/MM/YYYY"
                        className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </td>

                    {/* Số phiếu xuất của khách */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.voucherCode}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'voucherCode', e.target.value)
                        }
                        placeholder="Số phiếu KH"
                        className="w-full h-8 px-2 text-xs font-mono font-bold uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </td>

                    {/* Mã PO */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        list={`po-suggestions-${row.id}`}
                        value={row.poNumber}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'poNumber', e.target.value)
                        }
                        placeholder="Mã PO"
                        className="w-full h-8 px-2 text-xs font-mono font-bold text-sky-700 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                      <datalist id={`po-suggestions-${row.id}`}>
                        {currentCustomerPOs.map((p) => (
                          <option key={p.id} value={p.poNumber}>
                            {p.poNumber} - {p.style}
                          </option>
                        ))}
                      </datalist>
                    </td>

                    {/* Mã hàng TT Code */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.originalName}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'originalName', e.target.value)
                        }
                        placeholder="Mã hàng (AS-...)"
                        className="w-full h-8 px-2 text-xs font-bold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </td>

                    {/* Diễn giải VN */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.vnName}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'vnName', e.target.value)
                        }
                        placeholder="Diễn giải vật tư..."
                        className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </td>

                    {/* ĐVT */}
                    <td className="p-0 border-r border-slate-200">
                      <select
                        value={row.unit}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'unit', e.target.value)
                        }
                        className="w-full h-8 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value="PRS">PRS</option>
                        <option value="đôi">đôi</option>
                        <option value="bộ">bộ</option>
                        <option value="chiếc">chiếc</option>
                        <option value="cái">cái</option>
                        <option value="mét">mét</option>
                        <option value="kg">kg</option>
                      </select>
                    </td>

                    {/* Ô NHẬP FLAT SPREADSHEET CELL CHO TỪNG SIZE (GÕ VÀO LƯỚI BẢNG NHƯ HÌNH 2) */}
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

                    {/* TỔNG CỘNG DÒNG */}
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-slate-50 text-slate-800">
                      {totalQty > 0 ? totalQty.toLocaleString('vi-VN') : '-'}
                    </td>

                    {/* Bù? */}
                    <td className="p-1 border-r border-slate-200 text-center">
                      <input
                        type="checkbox"
                        checked={row.isCompReceipt}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'isCompReceipt', e.target.checked)
                        }
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Ghi chú */}
                    <td className="p-0 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) =>
                          handleUpdateDraftField(row.id, 'note', e.target.value)
                        }
                        placeholder="Ghi chú..."
                        className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                      />
                    </td>

                    {/* Xóa dòng */}
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

              {/* HÀNG TỔNG CỘNG CHÂN BẢNG (TOTAL ROW - CHUẨN HÌNH 2) */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                    {draftSizeTotals[s] > 0 ? draftSizeTotals[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-indigo-900">
                  {draftGrandTotal > 0 ? draftGrandTotal.toLocaleString('vi-VN') : '0'}
                </td>
                <td colSpan={3} className="p-2 text-slate-500 text-[11px] italic">
                  {validDraftRows.length} dòng sẵn sàng lưu
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer pagination bar (Giống Hình 2) */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 <strong>Tab</strong> để nhảy ô • <strong>Ctrl + Enter</strong> để lưu nhanh.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Hiển thị {draftRows.length} dòng nhập • Tổng SL: <strong>{draftGrandTotal.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* KHU VỰC 2: SỔ NHẬT KÝ ĐÃ LƯU CHUẨN ERP (CHỈ HIỂN THỊ KHI Ở TAB LỊCH SỬ)   */}
      {/* ========================================================================= */}
      {activeSubTab === 'HISTORY' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Sổ Nhật Ký Nhập Kho Đã Lưu ({filteredSavedGroups.length} phiếu)
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Dữ liệu an toàn chỉ đọc, sửa/xóa ở cột thao tác
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Nút Chuyển nhanh sang Nhập Phiếu Mới */}
              <button
                type="button"
                onClick={() => setActiveSubTab('ENTRY')}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs"
                title="Mở bảng nhập phiếu vật tư mới"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nhập Phiếu Mới</span>
              </button>

              {/* Search Box */}
              <div className="relative w-44 sm:w-52">
                <input
                  type="text"
                  placeholder="Tìm phiếu, PO, mã..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>

            {/* NÚT IN HTML BẢNG ĐÃ LƯU */}
            <button
              type="button"
              onClick={() => {
                setPrintDataSource('SAVED');
                setShowPrintModal(true);
              }}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              title="In bản HTML sổ nhật ký đã lưu"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In HTML</span>
            </button>

            {/* Nút Xuất Excel */}
            <button
              type="button"
              onClick={() =>
                exportInboundReceiptsToExcel(
                  currentCustomerReceipts,
                  currentCustomer?.name || 'Chung',
                  currentCustomerPOs,
                  sizes
                )
              }
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              title="Xuất file Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Khẩu</span>
            </button>
          </div>
        </div>

        {/* Saved Table (Chuẩn ERP Hình 2) */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 whitespace-nowrap min-w-[85px]">Ngày Nhập</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Số Phiếu KH</th>
                <th className="p-2 border-r border-slate-300 min-w-[100px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (TT Code)</th>
                <th className="p-2 border-r border-slate-300 min-w-[145px]">Diễn Giải (VN)</th>
                <th className="p-2 border-r border-slate-300 text-center w-14">ĐVT</th>

                {/* Horizontal Size Headers */}
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
                <th className="p-2 border-r border-slate-300 min-w-[100px]">Ghi Chú</th>
                <th className="p-2 text-center w-16">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredSavedGroups.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 3} className="p-6 text-center text-slate-400 text-xs italic">
                    Chưa có phiếu nhập kho nào.
                  </td>
                </tr>
              ) : (
                filteredSavedGroups.map((group, idx) => (
                  <tr key={group.groupKey} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                      {group.receiptDate}
                    </td>

                    <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {group.voucherCode || '-'}
                    </td>

                    <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 whitespace-nowrap">
                      {group.poNumber}
                      {group.isCompensationReceipt && (
                        <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-purple-100 text-purple-800 font-bold border border-purple-200">
                          Bù
                        </span>
                      )}
                    </td>

                    <td className="p-2 border-r border-slate-200 font-bold text-slate-900">
                      {group.originalName}
                    </td>

                    <td className="p-2 border-r border-slate-200 text-slate-600">
                      {group.vnName}
                    </td>

                    <td className="p-2 border-r border-slate-200 text-center font-medium">
                      {group.unit}
                    </td>

                    {/* Numbers under each size */}
                    {sizes.map((s) => {
                      const qty = group.sizeQuantities[s];
                      return (
                        <td
                          key={s}
                          className={`p-2 border-r border-slate-200 text-center font-mono ${
                            qty ? 'font-bold text-slate-900 bg-slate-50/50' : 'text-slate-300'
                          }`}
                        >
                          {qty ? qty.toLocaleString('vi-VN') : '-'}
                        </td>
                      );
                    })}

                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-slate-50 text-indigo-900">
                      {group.totalQty.toLocaleString('vi-VN')}
                    </td>

                    <td className="p-2 border-r border-slate-200 text-slate-500 text-[11px] truncate max-w-[140px]">
                      {group.note || '-'}
                    </td>

                    {/* Sửa / Xóa */}
                    <td className="p-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingGroup(group)}
                          className="p-1 text-slate-400 hover:text-sky-600 rounded transition"
                          title="Sửa"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSavedGroup(group)}
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

              {/* SUMMARY ROW CHUẨN HÌNH 2 */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG TOÀN BỘ:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-slate-900">
                    {savedSizeTotals[s] > 0 ? savedSizeTotals[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-indigo-900">
                  {savedGrandTotal.toLocaleString('vi-VN')}
                </td>
                <td colSpan={2} className="p-2 text-slate-500 text-[11px] italic">
                  Tổng {filteredSavedGroups.length} phiếu
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer pagination bar (Giống Hình 2) */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1 text-[11px]">
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&lt;&lt;</button>
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&lt;</button>
            <span className="px-2">Trang <strong>1</strong> trên 1</span>
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&gt;</button>
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&gt;&gt;</button>
          </div>
          <div className="text-[11px] text-slate-600">
            Hiển thị 1 - {filteredSavedGroups.length} trên {filteredSavedGroups.length} kết quả
          </div>
        </div>
      </div>
      )}

      {/* MODAL 1: DÁN TỪ EXCEL */}
      <ExcelPasteModal<ParsedInboundMatrixRow>
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        title="Dán Dữ Liệu Vật Tư Từ File Excel (Dải Size Ngang)"
        description="Copy bảng từ Excel (Ctrl + C), dán vào đây (Ctrl + V). Hệ thống tự động phân tích các cột size."
        columnsSample={[
          'Ngày',
          'Số Phiếu',
          'Mã PO',
          'Mã Hàng (TT)',
          'Diễn Giải (VN)',
          'ĐVT',
          ...sizes.map((s) => `Size ${s}`),
          'Tổng',
        ]}
        onParse={(text) => parseInboundMatrixClipboard(text, defaultDate, sizes, 'PRS')}
        renderPreviewRow={(item, idx) => (
          <tr key={idx} className="hover:bg-slate-50 text-xs">
            <td className="p-2 border-b text-slate-400">{idx + 1}</td>
            <td className="p-2 border-b">{item.receiptDate}</td>
            <td className="p-2 border-b font-mono font-bold text-slate-800">{item.voucherCode || '-'}</td>
            <td className="p-2 border-b font-bold text-sky-700">{item.poNumber || 'Chưa có'}</td>
            <td className="p-2 border-b font-bold text-slate-900">{item.originalName}</td>
            <td className="p-2 border-b italic text-slate-600">{item.vnName}</td>
            <td className="p-2 border-b text-center">{item.unit}</td>
            {sizes.map((s) => (
              <td key={s} className="p-2 border-b text-center font-mono font-bold text-slate-800">
                {item.sizeQuantities[s] || '-'}
              </td>
            ))}
            <td className="p-2 border-b text-right font-bold text-indigo-700">{item.totalQty}</td>
          </tr>
        )}
        onApply={(items) => applyParsedMatrixRows(items)}
      />

      {/* MODAL 2: IN HTML CHUẨN A4 */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        documentTitle="PHIẾU THEO DÕI NHẬP KHO VẬT TƯ (DẢI SIZE NGANG)"
        documentNumber={printRows[0]?.voucherCode}
        dateStr={defaultDate}
        customerName={currentCustomer?.name || 'Chung'}
        poNumber={printRows[0]?.poNumber}
        sizes={sizes}
        rows={printRows}
      />

      {/* MODAL 3: SỬA NHẬP KHO */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase text-slate-800">
                  Chỉnh Sửa Phiếu Vật Tư (Dải Size Ngang)
                </h3>
              </div>
              <button
                onClick={() => setEditingGroup(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditGroup} className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày Nhập *</label>
                  <input
                    type="text"
                    required
                    value={editingGroup.receiptDate}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, receiptDate: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số Phiếu KH</label>
                  <input
                    type="text"
                    value={editingGroup.voucherCode}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, voucherCode: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã PO</label>
                  <select
                    value={editingGroup.poId}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, poId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500 bg-white font-mono font-bold"
                  >
                    {currentCustomerPOs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} ({p.style})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã Hàng (TT) *</label>
                  <input
                    type="text"
                    required
                    value={editingGroup.originalName}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, originalName: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Diễn Giải (VN) *</label>
                  <input
                    type="text"
                    required
                    value={editingGroup.vnName}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, vnName: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đơn Vị Tính</label>
                  <input
                    type="text"
                    value={editingGroup.unit}
                    onChange={(e) =>
                      setEditingGroup({ ...editingGroup, unit: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Grid sizes */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between text-[11px]">
                  <span>Số lượng theo từng Size:</span>
                  <span className="text-indigo-900 font-mono font-bold">
                    Tổng:{' '}
                    {sizes
                      .reduce((sum, s) => sum + (editingGroup.sizeQuantities[s] || 0), 0)
                      .toLocaleString('vi-VN')}{' '}
                    {editingGroup.unit}
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white p-1.5 rounded border border-slate-200 text-center">
                      <label className="block text-[10px] font-mono font-bold text-slate-700 mb-0.5">
                        {s}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingGroup.sizeQuantities[s] || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                          setEditingGroup({
                            ...editingGroup,
                            sizeQuantities: {
                              ...editingGroup.sizeQuantities,
                              [s]: val,
                            },
                          });
                        }}
                        placeholder="0"
                        className="w-full text-xs text-center font-mono font-bold p-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi Chú</label>
                <input
                  type="text"
                  value={editingGroup.note || ''}
                  onChange={(e) =>
                    setEditingGroup({ ...editingGroup, note: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold shadow-xs transition"
                >
                  Lưu Cập Nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
