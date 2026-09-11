import React, { useState, useRef, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ProductionDelivery } from '../../types';
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
  Calendar,
  FileSpreadsheet,
  History,
} from 'lucide-react';
import { exportOutboundDeliveriesToExcel } from '../../utils/excelExport';
import {
  parseOutboundExcelClipboard,
  ParsedOutboundRow,
} from '../../utils/excelClipboard';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';

interface DraftOutboundRow {
  id: string;
  deliveryDate: string;
  poNumber: string;
  originalName: string;
  vnName: string;
  size: string;
  unit: string;
  qtyBatch1: number | '';
  note: string;
}

export const OutboundTab: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerDeliveries,
    addDelivery,
    updateDelivery,
    deleteDelivery,
    addPurchaseOrder,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const defaultSize = activeSizeRun?.sizes[0] || '8';
  const sizes = useMemo(() => activeSizeRun?.sizes || ['4', '5', '6', '7', '8', '9', '10', '11', '12'], [activeSizeRun]);

  const createEmptyRow = (): DraftOutboundRow => ({
    id: `draft-out-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    deliveryDate: defaultDate,
    poNumber: currentCustomerPOs[0]?.poNumber || '',
    originalName: currentCustomerPOs[0] ? `${currentCustomerPOs[0].style} Finished` : 'Finished Shoes',
    vnName: 'Giày thành phẩm đợt 1',
    size: defaultSize,
    unit: 'đôi',
    qtyBatch1: '',
    note: 'Xuất giao đợt 1 trả đối tác',
  });

  const [draftRows, setDraftRows] = useState<DraftOutboundRow[]>([
    createEmptyRow(),
    createEmptyRow(),
  ]);

  // Sub-tab view mode: 'ENTRY' vs 'HISTORY'
  const [activeSubTab, setActiveSubTab] = useState<'ENTRY' | 'HISTORY'>('ENTRY');

  // Modals
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printDataSource, setPrintDataSource] = useState<'DRAFT' | 'SAVED'>('SAVED');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingDelivery, setEditingDelivery] = useState<ProductionDelivery | null>(null);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const handleAddRows = (count: number = 1) => {
    const newRows: DraftOutboundRow[] = [];
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow());
    }
    setDraftRows((prev) => [...prev, ...newRows]);
  };

  const handleUpdateDraftCell = (
    id: string,
    field: keyof DraftOutboundRow,
    value: any
  ) => {
    setDraftRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'poNumber') {
          const po = currentCustomerPOs.find((p) => p.poNumber.toUpperCase() === String(value).toUpperCase());
          if (po) {
            updated.originalName = `${po.style} Finished`;
            updated.vnName = `${po.style} - Giao đợt 1`;
          }
        }
        return updated;
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
    if (window.confirm('Bạn có muốn xóa trắng các dòng xuất giao đang nhập dở?')) {
      setDraftRows([createEmptyRow(), createEmptyRow()]);
    }
  };

  const validDraftRows = draftRows.filter(
    (r) =>
      r.poNumber.trim() &&
      typeof r.qtyBatch1 === 'number' &&
      r.qtyBatch1 > 0
  );

  const draftGrandTotal = useMemo(() => {
    return draftRows.reduce(
      (sum, r) => sum + (typeof r.qtyBatch1 === 'number' ? r.qtyBatch1 : 0),
      0
    );
  }, [draftRows]);

  const handleSaveAllDraftRows = () => {
    if (!currentCustomer) {
      alert('Chưa chọn Khách hàng.');
      return;
    }

    if (validDraftRows.length === 0) {
      alert('Chưa có dòng nào hợp lệ để lưu! Vui lòng nhập Mã PO và Số lượng xuất > 0.');
      return;
    }

    let savedCount = 0;

    validDraftRows.forEach((row, idx) => {
      const cleanPoNum = row.poNumber.trim().toUpperCase();
      let po = currentCustomerPOs.find(
        (p) => p.poNumber.toUpperCase() === cleanPoNum
      );

      let finalPoId = po?.id;
      if (!po) {
        const newPo = {
          id: `po-${Date.now()}-${idx}`,
          customerId: currentCustomer.id,
          poNumber: cleanPoNum,
          style: row.vnName.trim() || 'Style tiêu chuẩn',
          orderDate: row.deliveryDate.trim() || defaultDate,
          targetQty: typeof row.qtyBatch1 === 'number' ? row.qtyBatch1 : 10,
          unit: row.unit || 'đôi',
        };
        addPurchaseOrder(newPo);
        finalPoId = newPo.id;
      }

      const numQty = typeof row.qtyBatch1 === 'number' ? row.qtyBatch1 : 0;

      const newDelivery: ProductionDelivery = {
        id: `del-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        deliveryDate: row.deliveryDate.trim() || defaultDate,
        poId: finalPoId!,
        customerId: currentCustomer.id,
        originalName: row.originalName.trim() || 'Finished Shoes',
        vnName: row.vnName.trim() || 'Thành phẩm đợt 1',
        size: row.size.trim() || defaultSize,
        unit: row.unit || 'đôi',
        qtyBatch1: numQty,
        note: row.note.trim() || 'Xuất giao đợt 1 trả đối tác',
      };

      addDelivery(newDelivery);
      savedCount++;
    });

    setDraftRows([createEmptyRow(), createEmptyRow()]);
    setActiveSubTab('HISTORY');
    alert(`✅ Đã lưu thành công ${savedCount} đợt xuất giao thành phẩm vào Sổ Nhật Ký Xuất Kho!`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveAllDraftRows();
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    const clipText = e.clipboardData.getData('text');
    if (!clipText || !clipText.includes('\t')) return;

    e.preventDefault();
    const parsed = parseOutboundExcelClipboard(clipText, defaultDate, defaultSize);
    if (parsed.length > 0) {
      applyParsedRows(parsed);
      alert(`📋 Đã dán và tự động điền ${parsed.length} dòng xuất giao từ Excel!`);
    }
  };

  const applyParsedRows = (parsed: ParsedOutboundRow[]) => {
    const newDrafts: DraftOutboundRow[] = parsed.map((p, idx) => ({
      id: `paste-out-${Date.now()}-${idx}`,
      deliveryDate: p.deliveryDate || defaultDate,
      poNumber: p.poNumber || currentCustomerPOs[0]?.poNumber || '',
      originalName: p.originalName || 'Finished Shoes',
      vnName: p.vnName || 'Thành phẩm đợt 1',
      size: p.size || defaultSize,
      unit: p.unit || 'đôi',
      qtyBatch1: p.qtyBatch1,
      note: p.note || 'Xuất giao đợt 1 trả đối tác',
    }));

    setDraftRows((prev) => {
      const nonEmpties = prev.filter(
        (r) => typeof r.qtyBatch1 === 'number' && r.qtyBatch1 > 0
      );
      return [...nonEmpties, ...newDrafts];
    });
  };

  const handleSaveEditModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;
    updateDelivery(editingDelivery);
    setEditingDelivery(null);
    alert('Đã cập nhật đợt xuất giao thành công!');
  };

  const handleDeleteSavedDelivery = (del: ProductionDelivery) => {
    if (
      window.confirm(
        `Bạn có chắc chắn muốn xóa đợt xuất giao ngày ${del.deliveryDate} (${del.qtyBatch1} ${del.unit}) không?`
      )
    ) {
      deleteDelivery(del.id);
    }
  };

  const filteredList = currentCustomerDeliveries.filter((d) => {
    const po = currentCustomerPOs.find((p) => p.id === d.poId);
    const poStr = po?.poNumber || '';
    const q = searchQuery.toLowerCase();
    return (
      poStr.toLowerCase().includes(q) ||
      d.originalName.toLowerCase().includes(q) ||
      d.vnName.toLowerCase().includes(q) ||
      d.size.toLowerCase().includes(q) ||
      d.deliveryDate.includes(q)
    );
  });

  const savedGrandTotal = useMemo(() => {
    return filteredList.reduce((sum, d) => sum + d.qtyBatch1, 0);
  }, [filteredList]);

  // Prepare Print rows
  const printRows: PrintTableRow[] = useMemo(() => {
    const sourceList = printDataSource === 'DRAFT' ? validDraftRows : filteredList;
    return sourceList.map((item, idx) => {
      const date = 'deliveryDate' in item ? item.deliveryDate : (item as DraftOutboundRow).deliveryDate;
      const poNumber = 'poId' in item ? (currentCustomerPOs.find(p => p.id === item.poId)?.poNumber || '') : (item as DraftOutboundRow).poNumber;
      const originalName = item.originalName;
      const vnName = item.vnName;
      const unit = item.unit;
      const qty = 'qtyBatch1' in item ? (typeof item.qtyBatch1 === 'number' ? item.qtyBatch1 : 0) : 0;
      const size = item.size;

      return {
        stt: idx + 1,
        date,
        poNumber,
        code: originalName,
        description: vnName,
        unit,
        sizeQuantities: { [size]: qty },
        totalQty: qty,
        note: item.note,
      };
    });
  }, [printDataSource, validDraftRows, filteredList, currentCustomerPOs]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* THANH CHUYỂN TAB: 1. BẢNG NHẬP LIỆU vs 2. SỔ NHẬT KÝ ĐÃ LƯU */}
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
            <span>1. Bảng Nhập Xuất Giao Đợt 1</span>
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
            <span>2. Sổ Nhật Ký Xuất Giao Đã Lưu</span>
            <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {filteredList.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {activeSubTab === 'ENTRY' ? (
            <button
              type="button"
              onClick={() => setActiveSubTab('HISTORY')}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-700 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200 transition"
              title="Chuyển sang xem Sổ nhật ký xuất giao đã lưu"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem Sổ Nhật Ký ({filteredList.length} đợt) ➔</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveSubTab('ENTRY')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-md border border-sky-200 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Nhập Xuất Giao Mới</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* KHU VỰC 1: BẢNG NHẬP XUẤT GIAO CHUẨN ERP PHẲNG (CHỈ HIỂN THỊ Ở TAB NHẬP)   */}
      {/* ========================================================================= */}
      {activeSubTab === 'ENTRY' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          {/* Toolbar */}
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Bảng Nhập Xuất Giao Thành Phẩm Đợt 1
              </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Nhập trực tiếp vào ô lưới, Enter để lưu
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            {/* In HTML */}
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
              <Plus className="w-3 h-3 text-indigo-600" />
              <span>+1 Dòng</span>
            </button>

            {/* +5 Dòng */}
            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2 py-1.5 rounded transition shadow-2xs"
            >
              <Plus className="w-3 h-3 text-indigo-600" />
              <span>+5 Dòng</span>
            </button>

            {/* Xóa trắng */}
            <button
              type="button"
              onClick={handleClearDraftRows}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition"
              title="Xóa trắng bảng"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Lưu dữ liệu */}
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

        {/* Flat ERP Table (Chuẩn Hình 2) */}
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[95px]">Ngày Giao *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã PO *</th>
                <th className="p-2 border-r border-slate-300 min-w-[145px]">Tên Gốc Sản Phẩm</th>
                <th className="p-2 border-r border-slate-300 min-w-[145px]">Tên Dịch (VN)</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">Size</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">ĐVT</th>
                <th className="p-2 border-r border-slate-300 text-right min-w-[100px] bg-slate-100">SL Giao Đợt 1 *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Ghi Chú</th>
                <th className="p-2 text-center w-8">Xóa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {draftRows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-1 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>

                  {/* Ngày */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.deliveryDate}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'deliveryDate', e.target.value)
                      }
                      placeholder="DD/MM/YYYY"
                      className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </td>

                  {/* Mã PO */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="text"
                      list={`po-out-suggestions-${row.id}`}
                      value={row.poNumber}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'poNumber', e.target.value)
                      }
                      placeholder="Mã PO"
                      className="w-full h-8 px-2 text-xs font-mono font-bold text-indigo-700 uppercase bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                    <datalist id={`po-out-suggestions-${row.id}`}>
                      {currentCustomerPOs.map((p) => (
                        <option key={p.id} value={p.poNumber}>
                          {p.poNumber} ({p.style}) - Yêu cầu: {p.targetQty}
                        </option>
                      ))}
                    </datalist>
                  </td>

                  {/* Tên gốc */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.originalName}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'originalName', e.target.value)
                      }
                      placeholder="VD: Sneaker Pro Finished"
                      className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </td>

                  {/* Tên dịch */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.vnName}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'vnName', e.target.value)
                      }
                      placeholder="VD: Giày thành phẩm đợt 1"
                      className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </td>

                  {/* Size */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="text"
                      list={`size-out-suggestions-${row.id}`}
                      value={row.size}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'size', e.target.value)
                      }
                      placeholder="Size"
                      className="w-full h-8 px-1 text-xs text-center font-mono font-bold bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                    <datalist id={`size-out-suggestions-${row.id}`}>
                      {sizes.map((s) => (
                        <option key={s} value={s}>
                          Size {s}
                        </option>
                      ))}
                    </datalist>
                  </td>

                  {/* ĐVT */}
                  <td className="p-0 border-r border-slate-200">
                    <select
                      value={row.unit}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'unit', e.target.value)
                      }
                      className="w-full h-8 px-1 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    >
                      <option value="đôi">đôi</option>
                      <option value="bộ">bộ</option>
                      <option value="chiếc">chiếc</option>
                      <option value="cái">cái</option>
                    </select>
                  </td>

                  {/* SL Giao Đợt 1 */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="number"
                      min="0"
                      value={row.qtyBatch1}
                      onChange={(e) =>
                        handleUpdateDraftCell(
                          row.id,
                          'qtyBatch1',
                          e.target.value === '' ? '' : parseFloat(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="w-full h-8 px-2 text-xs text-right font-mono font-bold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                    />
                  </td>

                  {/* Ghi chú */}
                  <td className="p-0 border-r border-slate-200">
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) =>
                        handleUpdateDraftCell(row.id, 'note', e.target.value)
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
              ))}

              {/* TOTAL ROW CHÂN BẢNG (CHUẨN HÌNH 2) */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG:
                </td>
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

        {/* Footer */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="text-[11px]">
            <span>💡 <strong>Tab</strong> để nhảy ô • <strong>Ctrl + Enter</strong> để lưu toàn bộ.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Hiển thị {draftRows.length} dòng • Tổng SL: <strong>{draftGrandTotal.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* KHU VỰC 2: SỔ NHẬT KÝ XUẤT GIAO ĐÃ LƯU CHUẨN ERP (CHỈ HIỂN THỊ Ở LỊCH SỬ) */}
      {/* ========================================================================= */}
      {activeSubTab === 'HISTORY' && (
        <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider">
                Sổ Nhật Ký Xuất Giao Đợt 1 Đã Lưu ({filteredList.length} lượt)
              </h3>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                | Dữ liệu an toàn cố định
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Nút quay lại nhập */}
              <button
                type="button"
                onClick={() => setActiveSubTab('ENTRY')}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs"
                title="Quay lại bảng nhập xuất giao mới"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Nhập Xuất Giao Mới</span>
              </button>

              <div className="relative w-44 sm:w-52">
                <input
                  type="text"
                  placeholder="Tìm PO, tên sản phẩm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* In HTML */}
            <button
              type="button"
              onClick={() => {
                setPrintDataSource('SAVED');
                setShowPrintModal(true);
              }}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
              title="In bản HTML sổ xuất giao"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In HTML</span>
            </button>

            {/* Xuất Excel */}
            <button
              type="button"
              onClick={() =>
                exportOutboundDeliveriesToExcel(
                  filteredList,
                  currentCustomer?.name || 'Chung',
                  currentCustomerPOs
                )
              }
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
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
                <th className="p-2 border-r border-slate-300 whitespace-nowrap min-w-[85px]">Ngày Giao</th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[140px]">Tên Gốc Sản Phẩm</th>
                <th className="p-2 border-r border-slate-300 min-w-[140px]">Tên Dịch (VN)</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">Size</th>
                <th className="p-2 border-r border-slate-300 text-center w-16">ĐVT</th>
                <th className="p-2 border-r border-slate-300 text-right min-w-[100px] bg-slate-100 font-bold">SL Giao Đợt 1</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Ghi Chú</th>
                <th className="p-2 text-center w-16">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400 text-xs italic">
                    Chưa có lịch sử xuất giao đợt 1 nào.
                  </td>
                </tr>
              ) : (
                filteredList.map((del, idx) => {
                  const po = currentCustomerPOs.find((p) => p.id === del.poId);

                  return (
                    <tr key={del.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                        {del.deliveryDate}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap font-bold text-indigo-700 font-mono">
                        {po?.poNumber || 'PO-CHUNG'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-900 font-medium">
                        {del.originalName}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-600">
                        {del.vnName}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-sky-700">
                        {del.size}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center text-slate-600">
                        {del.unit}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900 bg-slate-50">
                        {del.qtyBatch1.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-500 max-w-[180px] truncate text-[11px]">
                        {del.note || '-'}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingDelivery(del)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded transition"
                            title="Sửa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSavedDelivery(del)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* TOTAL ROW CHUẨN HÌNH 2 */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG TOÀN BỘ:
                </td>
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-indigo-900">
                  {savedGrandTotal.toLocaleString('vi-VN')}
                </td>
                <td colSpan={2} className="p-2 text-slate-500 text-[11px] italic">
                  Tổng {filteredList.length} đợt giao
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1 text-[11px]">
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&lt;&lt;</button>
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&lt;</button>
            <span className="px-2">Trang <strong>1</strong> trên 1</span>
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&gt;</button>
            <button className="px-2 py-0.5 border border-slate-300 rounded text-slate-400 hover:bg-slate-100">&gt;&gt;</button>
          </div>
          <div className="text-[11px] text-slate-600">
            Hiển thị 1 - {filteredList.length} trên {filteredList.length} kết quả
          </div>
        </div>
      </div>
      )}

      {/* MODAL 1: DÁN TỪ EXCEL */}
      <ExcelPasteModal<ParsedOutboundRow>
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        title="Dán Dữ Liệu Xuất Giao Đợt 1 Từ Bảng Tính Excel"
        description="Copy các dòng xuất hàng từ Excel (Ctrl + C), dán vào đây (Ctrl + V)."
        columnsSample={[
          'Ngày giao',
          'Mã PO',
          'Tên gốc SP',
          'Tên dịch',
          'Size',
          'ĐVT',
          'SL Giao Đợt 1',
          'Ghi chú',
        ]}
        onParse={(text) => parseOutboundExcelClipboard(text, defaultDate, defaultSize)}
        renderPreviewRow={(item, idx) => (
          <tr key={idx} className="hover:bg-slate-50 text-xs">
            <td className="p-2 border-b text-slate-400">{idx + 1}</td>
            <td className="p-2 border-b">{item.deliveryDate}</td>
            <td className="p-2 border-b font-bold text-indigo-700">{item.poNumber || 'Chưa có'}</td>
            <td className="p-2 border-b">{item.originalName}</td>
            <td className="p-2 border-b italic">{item.vnName}</td>
            <td className="p-2 border-b text-center font-bold text-sky-700">{item.size}</td>
            <td className="p-2 border-b text-center">{item.unit}</td>
            <td className="p-2 border-b text-right font-bold text-slate-900">{item.qtyBatch1}</td>
            <td className="p-2 border-b text-slate-500 truncate max-w-xs">{item.note || '-'}</td>
          </tr>
        )}
        onApply={(items) => applyParsedRows(items)}
      />

      {/* MODAL 2: IN HTML */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        documentTitle="PHIẾU THEO DÕI XUẤT KHO & GIAO HÀNG ĐỢT 1"
        dateStr={defaultDate}
        customerName={currentCustomer?.name || 'Chung'}
        sizes={sizes}
        rows={printRows}
      />

      {/* MODAL 3: SỬA DÒNG XUẤT GIAO */}
      {editingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold uppercase text-slate-800">
                  Chỉnh Sửa Đợt Xuất Giao Đợt 1
                </h3>
              </div>
              <button
                onClick={() => setEditingDelivery(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="p-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ngày Giao Hàng (DD/MM/YYYY) *
                </label>
                <input
                  type="text"
                  required
                  value={editingDelivery.deliveryDate}
                  onChange={(e) =>
                    setEditingDelivery({ ...editingDelivery, deliveryDate: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã PO</label>
                  <select
                    value={editingDelivery.poId}
                    onChange={(e) =>
                      setEditingDelivery({ ...editingDelivery, poId: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {currentCustomerPOs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.poNumber} ({p.style})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Size</label>
                  <input
                    type="text"
                    value={editingDelivery.size}
                    onChange={(e) =>
                      setEditingDelivery({ ...editingDelivery, size: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500 font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên Gốc Sản Phẩm</label>
                  <input
                    type="text"
                    required
                    value={editingDelivery.originalName}
                    onChange={(e) =>
                      setEditingDelivery({ ...editingDelivery, originalName: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tên Dịch (VN)</label>
                  <input
                    type="text"
                    required
                    value={editingDelivery.vnName}
                    onChange={(e) =>
                      setEditingDelivery({ ...editingDelivery, vnName: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Số Lượng Giao Đợt 1
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editingDelivery.qtyBatch1}
                    onChange={(e) =>
                      setEditingDelivery({
                        ...editingDelivery,
                        qtyBatch1: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đơn Vị Tính</label>
                  <input
                    type="text"
                    value={editingDelivery.unit}
                    onChange={(e) =>
                      setEditingDelivery({ ...editingDelivery, unit: e.target.value })
                    }
                    className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi Chú</label>
                <input
                  type="text"
                  value={editingDelivery.note || ''}
                  onChange={(e) =>
                    setEditingDelivery({ ...editingDelivery, note: e.target.value })
                  }
                  className="w-full border border-slate-300 rounded p-1.5 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
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
