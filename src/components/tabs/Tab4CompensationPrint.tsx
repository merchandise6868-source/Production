import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CompensationRequestItem } from '../../types';
import {
  Printer,
  Download,
  Search,
  FileCheck2,
  AlertTriangle,
  Building2,
  Calendar,
  Send,
  Eye,
  Plus,
  Trash2,
  Edit,
  X,
  PackageCheck,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  Save,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';
import { SearchablePoSelect } from '../common/SearchablePoSelect';

export const Tab4CompensationPrint: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerCompensationItems,
    updateCompensationRequestStatus,
    updateCompensationRequestDate,
    updateCompensationRequest,
    addCompensationRequest,
    deleteCompensationRequest,
    receiveCompensationItem,
    resetCompensationReceive,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'TAB3' | 'TAB7' | 'DAMAGED'>('ALL');
  const [selectedItemForPrint, setSelectedItemForPrint] = useState<CompensationRequestItem | null>(null);
  const [showPrintAllModal, setShowPrintAllModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CompensationRequestItem | null>(null);

  // Receiving Modal State
  const [receivingItem, setReceivingItem] = useState<CompensationRequestItem | null>(null);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number | ''>>({});
  const [receiveDate, setReceiveDate] = useState(() => new Date().toLocaleDateString('vi-VN'));

  const handleOpenReceiveModal = (item: CompensationRequestItem) => {
    setReceivingItem(item);
    const initial: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      const needed = item.sizeQuantities[s] || 0;
      const already = item.receivedQuantities?.[s] || 0;
      const rem = Math.max(0, needed - already);
      initial[s] = rem > 0 ? rem : (needed > 0 ? needed : '');
    });
    setReceiveQuantities(initial);
    setReceiveDate(new Date().toLocaleDateString('vi-VN'));
  };

  const handleQuickReceive100 = (item: CompensationRequestItem) => {
    confirm(`Xác nhận nhận đủ 100% vật tư giao bù cho PO ${item.poNumber} (${item.itemCode})?
Số lượng này sẽ tự động được cộng vào Số Thực Nhận (Tab 2) và Kho Vật Tư!`, () => {
      receiveCompensationItem(item, item.sizeQuantities);
      setLocalReceivedMap((prev) => ({
        ...prev,
        [item.id]: { ...item.sizeQuantities },
      }));
      toast(`✅ Đã nhận đủ bù ${item.totalQty} đôi cho PO ${item.poNumber}. Đã cập nhật vào Thực Nhận (Tab 2) và Kho Vật Tư!`);
    });
  };

  const handleSaveReceiveModal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!receivingItem) return;

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = Number(receiveQuantities[s]);
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng nhận bù cho ít nhất một size.', 'Thiếu số lượng', 'warning');
      return;
    }

    receiveCompensationItem(receivingItem, cleanedSizes, receiveDate);
    toast(`✅ Đã lưu ${total} đôi vật tư nhận bù cho PO ${receivingItem.poNumber}!`);
    setReceivingItem(null);
  };

  // Local state lưu trữ số lượng nhận bù đang nhập trực tiếp trên bảng
  const [localReceivedMap, setLocalReceivedMap] = useState<Record<string, Record<string, number | ''>>>({});

  const getLocalReceivedQty = (itemId: string, size: string): number | '' => {
    if (localReceivedMap[itemId] && localReceivedMap[itemId][size] !== undefined) {
      return localReceivedMap[itemId][size];
    }
    const item = currentCustomerCompensationItems.find((c) => c.id === itemId);
    const already = item?.receivedQuantities?.[size];
    return already !== undefined && already > 0 ? already : '';
  };

  const handleUpdateLocalQty = (itemId: string, size: string, valStr: string) => {
    const num = valStr === '' ? '' : Math.max(0, parseFloat(valStr) || 0);
    setLocalReceivedMap((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [size]: num,
      },
    }));
  };

  const handleSaveAllReceives = () => {
    let savedCount = 0;
    filteredItems.forEach((item) => {
      const itemDraft = localReceivedMap[item.id];
      if (!itemDraft) return;

      const cleaned: Record<string, number> = {};
      let hasAny = false;
      sizes.forEach((s) => {
        const v = itemDraft[s] !== undefined ? itemDraft[s] : (item.receivedQuantities?.[s] || 0);
        if (typeof v === 'number' && v > 0) {
          cleaned[s] = v;
          hasAny = true;
        }
      });

      if (hasAny) {
        receiveCompensationItem(item, cleaned);
        savedCount++;
      }
    });

    if (savedCount > 0) {
      toast(`✅ Đã lưu số lượng nhận bù cho ${savedCount} đơn hàng vào Số Thực Nhận (Tab 2) và Kho Vật Tư!`);
    } else {
      toast('Đã lưu dữ liệu.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      handleSaveAllReceives();
    }
  };

  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    if (
      target.tagName === 'INPUT' &&
      !target.hasAttribute('data-size') &&
      !target.closest('td')?.querySelector('input[data-size]')
    ) {
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

    // Trường hợp: Đang chọn vào 1 ô Size cụ thể -> Dán ma trận số lượng size từ ô đó sang phải và xuống dưới
    if (sizeInput) {
      if (!isMultiCell && !clipText.includes('\t') && !clipText.includes('\n')) {
        return;
      }

      e.preventDefault();

      const startCompIdxStr = sizeInput.getAttribute('data-comp-idx');
      const startCompIdx = startCompIdxStr !== null ? parseInt(startCompIdxStr, 10) : 0;
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

      const updatedMap = { ...localReceivedMap };

      dataMatrix.forEach((rowCells, rOffset) => {
        const targetCompIdx = startCompIdx + rOffset;
        if (targetCompIdx >= filteredItems.length) return;

        const item = filteredItems[targetCompIdx];
        const currentSq: Record<string, number | ''> = { ...(updatedMap[item.id] || {}) };

        rowCells.forEach((cellRaw, cOffset) => {
          const targetSizeIdx = startSizeIdx + cOffset;
          if (targetSizeIdx >= sizes.length) return;

          const s = sizes[targetSizeIdx];
          const val = cellRaw.trim();

          if (!val || val === '-' || val === '0') {
            currentSq[s] = '';
          } else {
            const num = parseFloat(val.replace(/,/g, ''));
            currentSq[s] = isNaN(num) ? '' : Math.max(0, num);
          }
        });

        updatedMap[item.id] = currentSq;
      });

      setLocalReceivedMap(updatedMap);
      toast(`📋 Đã dán thành công ${dataMatrix.length} dòng số lượng nhận bù bắt đầu từ Size ${startSize}!`);
      return;
    }
  };

  // New manual compensation form state
  const [newSource, setNewSource] = useState<'DAMAGED_GOODS' | 'DISCREPANCY_TAB3' | 'DAMAGE_OUT_OF_STOCK_TAB7'>('DAMAGED_GOODS');
  const [newPoNumber, setNewPoNumber] = useState('');
  const [newItemCode, setNewItemCode] = useState('');
  const [newVoucherCode, setNewVoucherCode] = useState('');
  const [newLineId, setNewLineId] = useState('Chuyền 1');
  const [newReason, setNewReason] = useState('Hàng hư hỏng trong quá trình sản xuất');
  const [newRequestDate, setNewRequestDate] = useState(() => new Date().toLocaleDateString('vi-VN'));
  const [newSizeQuantities, setNewSizeQuantities] = useState<Record<string, number | ''>>({});

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoNumber.trim()) {
      alert('Vui lòng nhập Mã PO.');
      return;
    }
    if (!newItemCode.trim()) {
      alert('Vui lòng nhập Mã hàng.');
      return;
    }

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = Number(newSizeQuantities[s]);
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng bù cho ít nhất một size.');
      return;
    }

    const sourceLabelMap: Record<string, string> = {
      DAMAGED_GOODS: 'Hàng hư hỏng',
      DISCREPANCY_TAB3: 'Giao thiếu (Tab 3)',
      DAMAGE_OUT_OF_STOCK_TAB7: 'Hỏng hết kho (Tab 7)',
    };

    const newItem: CompensationRequestItem = {
      id: `custom-comp-${Date.now()}`,
      customerId: currentCustomer?.id || 'default',
      source: newSource,
      sourceLabel: sourceLabelMap[newSource] || 'Hàng hư hỏng',
      poNumber: newPoNumber.trim().toUpperCase(),
      itemCode: newItemCode.trim().toUpperCase(),
      voucherCode: newVoucherCode.trim() || undefined,
      lineId: newLineId.trim() || undefined,
      reason: newReason.trim() || 'Hàng hư hỏng trong quá trình sản xuất',
      sizeQuantities: cleanedSizes,
      totalQty: total,
      requestDate: newRequestDate.trim() || new Date().toLocaleDateString('vi-VN'),
      status: 'Chờ gửi KH',
    };

    addCompensationRequest(newItem);
    toast('✅ Đã tạo phiếu đề nghị cấp bù thành công!');

    // Reset
    setNewPoNumber('');
    setNewItemCode('');
    setNewVoucherCode('');
    setNewSizeQuantities({});
    setShowCreateModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editingItem.poNumber.trim()) {
      alert('Vui lòng nhập Mã PO.', 'Thiếu thông tin', 'warning');
      return;
    }
    if (!editingItem.itemCode.trim()) {
      alert('Vui lòng nhập Mã hàng.', 'Thiếu thông tin', 'warning');
      return;
    }

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = Number(editingItem.sizeQuantities[s]);
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng bù cho ít nhất một size.', 'Thiếu số lượng', 'warning');
      return;
    }

    const updatedItem: CompensationRequestItem = {
      ...editingItem,
      poNumber: editingItem.poNumber.trim().toUpperCase(),
      itemCode: editingItem.itemCode.trim().toUpperCase(),
      voucherCode: editingItem.voucherCode?.trim() || undefined,
      lineId: editingItem.lineId?.trim() || undefined,
      reason: editingItem.reason.trim() || 'Hàng hư hỏng trong quá trình sản xuất',
      sizeQuantities: cleanedSizes,
      totalQty: total,
      requestDate: editingItem.requestDate.trim() || new Date().toLocaleDateString('vi-VN'),
    };

    updateCompensationRequest(updatedItem);
    toast(`✅ Đã cập nhật phiếu bù PO ${updatedItem.poNumber}!`);
    setEditingItem(null);
  };

  // Filtered compensation items
  const filteredItems = useMemo(() => {
    return currentCustomerCompensationItems.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.voucherCode && item.voucherCode.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (sourceFilter === 'TAB3') return item.source === 'DISCREPANCY_TAB3';
      if (sourceFilter === 'TAB7') return item.source === 'DAMAGE_OUT_OF_STOCK_TAB7';
      if (sourceFilter === 'DAMAGED') return item.source === 'DAMAGED_GOODS';
      return true;
    });
  }, [currentCustomerCompensationItems, searchQuery, sourceFilter]);

  // Column totals
  const totalCompBySize = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredItems.reduce((sum, item) => {
        return sum + (item.sizeQuantities[s] || 0);
      }, 0);
    });
    return totals;
  }, [filteredItems, sizes]);

  const grandTotalComp = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.totalQty, 0);
  }, [filteredItems]);

  // Export Excel
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }
    const headers = [
      'STT',
      'Nguồn Phát Sinh',
      'Ngày Đề Nghị',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Số Phiếu / Chuyền',
      'Lý Do Cấp Bù',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Cần Bù',
      'Trạng Thái',
    ];

    const dataRows = filteredItems.map((item, idx) => [
      idx + 1,
      item.sourceLabel,
      item.requestDate,
      item.poNumber,
      item.itemCode,
      item.voucherCode || item.lineId || '-',
      item.reason,
      ...sizes.map((s) => item.sizeQuantities[s] || 0),
      item.totalQty,
      item.status,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PhieuBu_Tab4');
    XLSX.writeFile(wb, `Tab4_PhieuBu_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Prepare Print rows for All items
  const printAllRows: PrintTableRow[] = useMemo(() => {
    return filteredItems.map((item, idx) => ({
      stt: idx + 1,
      date: item.requestDate,
      voucherCode: item.voucherCode || item.lineId || 'BU-NLGC',
      poNumber: item.poNumber,
      code: item.itemCode,
      description: `Đề nghị bù: ${item.reason}`,
      unit: 'PRS',
      sizeQuantities: item.sizeQuantities,
      totalQty: item.totalQty,
      note: `Nguồn: ${item.sourceLabel} • ${item.status}`,
    }));
  }, [filteredItems]);

  // Prepare Print rows for Single selected item
  const printSingleRows: PrintTableRow[] = useMemo(() => {
    if (!selectedItemForPrint) return [];
    return [
      {
        stt: 1,
        date: selectedItemForPrint.requestDate,
        voucherCode: selectedItemForPrint.voucherCode || selectedItemForPrint.lineId || 'BU-NLGC',
        poNumber: selectedItemForPrint.poNumber,
        code: selectedItemForPrint.itemCode,
        description: `Đề nghị bù: ${selectedItemForPrint.reason}`,
        unit: 'PRS',
        sizeQuantities: selectedItemForPrint.sizeQuantities,
        totalQty: selectedItemForPrint.totalQty,
        note: `Nguồn: ${selectedItemForPrint.sourceLabel}`,
      },
    ];
  }, [selectedItemForPrint]);

  return (
    <div
      className="space-y-4"
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* Top Banner */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 4: NHẬN VẬT TƯ GIAO BÙ (ĐỢT 2 & BỔ SUNG)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Ghi số nhận bù trực tiếp, nhấn Enter để lưu &amp; tự động cập nhật vào Số Thực Nhận (Tab 2) và Kho Vật Tư
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleSaveAllReceives}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition cursor-pointer"
              title="Lưu tất cả số lượng nhận bù trên bảng (hoặc nhấn Enter)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>LƯU NHẬN BÙ (ENTER)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ TẠO PHIẾU BÙ MỚI</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintAllModal(true)}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition cursor-pointer"
              title="Tùy chọn in toàn bộ phiếu nếu cần đối tác ký nhận"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>In Phiếu Bù ({filteredItems.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Source Segmented */}
            <div className="inline-flex rounded-md shadow-2xs bg-white border border-slate-300 p-0.5">
              <button
                type="button"
                onClick={() => setSourceFilter('ALL')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả nguồn ({currentCustomerCompensationItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('TAB3')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'TAB3' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Giao thiếu (Tab 3)
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('TAB7')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'TAB7' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Hỏng hết kho (Tab 7)
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('DAMAGED')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'DAMAGED' ? 'bg-purple-600 text-white' : 'text-purple-700 hover:bg-purple-50'
                }`}
              >
                Hàng hư hỏng
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong>{filteredItems.length}</strong> yêu cầu • Tổng SL nguyên liệu cần bù:{' '}
            <strong className="text-rose-700 font-mono font-bold text-xs">{grandTotalComp.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[90px]">Nguồn Phát Sinh</th>
                <th className="p-2 border-r border-slate-300 min-w-[85px]">Ngày Đề Nghị</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (TT)</th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Số Phiếu / Chuyền</th>
                <th className="p-2 border-r border-slate-300 min-w-[150px]">Lý Do Cấp Bù</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-rose-50 text-rose-900"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-rose-100 text-rose-950 font-bold">
                  TỔNG CẦN BÙ
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-emerald-100 text-emerald-950 font-bold">
                  ĐÃ NHẬN BÙ
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[95px] text-center">Trạng Thái</th>
                <th className="p-2 text-center min-w-[170px]">Thao Tác / Nhận Bù</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 4} className="p-8 text-center text-slate-400 text-xs italic">
                    Hiện tại không có đơn hàng nào bị giao thiếu hoặc hỏng hết kho cần yêu cầu cấp bù!
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const recSizes = item.receivedQuantities || {};
                  const totalRec = sizes.reduce((sum, s) => {
                    const v = getLocalReceivedQty(item.id, s);
                    return sum + (typeof v === 'number' ? v : (Number(recSizes[s]) || 0));
                  }, 0);
                  const isDone = item.status === 'Đã nhận bù' || item.isFullyReceived || (totalRec >= item.totalQty && item.totalQty > 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      <td className="p-2 border-r border-slate-200 whitespace-nowrap">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.source === 'DISCREPANCY_TAB3'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : item.source === 'DAMAGE_OUT_OF_STOCK_TAB7'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {item.sourceLabel}
                        </span>
                      </td>

                      <td className="p-1 border-r border-slate-200 whitespace-nowrap">
                        <input
                          type="text"
                          defaultValue={item.requestDate}
                          key={`${item.id}-${item.requestDate}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            if (val && val !== item.requestDate) {
                              updateCompensationRequestDate(item.id, val);
                              toast(`✅ Đã lưu ngày đề nghị: ${val}`);
                            }
                          }}
                          className="w-24 px-1.5 py-1 text-xs font-mono font-medium text-slate-800 bg-transparent hover:bg-white hover:border-slate-300 focus:bg-white border border-transparent focus:border-indigo-500 rounded focus:outline-none transition cursor-pointer"
                          title="Nhập ngày đề nghị, nhấn Enter để lưu ngay"
                        />
                      </td>

                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 whitespace-nowrap">
                        {item.poNumber}
                      </td>

                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {item.itemCode}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-600">
                        {item.voucherCode || item.lineId || '-'}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-slate-700 font-medium truncate max-w-[140px]" title={item.reason}>
                        {item.reason}
                      </td>

                      {/* Missing size quantities: Editable inputs with Needed badge */}
                      {sizes.map((s) => {
                        const needed = item.sizeQuantities[s] || 0;
                        const currentVal = getLocalReceivedQty(item.id, s);
                        const isReceived = typeof currentVal === 'number' && currentVal > 0;

                        return (
                          <td
                            key={s}
                            className={`p-1 border-r border-slate-200 text-center ${
                              needed > 0 ? 'bg-rose-50/30' : 'bg-slate-50/20'
                            }`}
                          >
                            <div className="flex flex-col items-center gap-0.5 min-w-[46px]">
                              <span
                                className={`text-[10px] font-mono leading-tight ${
                                  needed > 0 ? 'text-rose-600 font-bold' : 'text-slate-300'
                                }`}
                                title={`Cần bù: ${needed}`}
                              >
                                {needed > 0 ? needed : '-'}
                              </span>
                              <input
                                type="number"
                                min="0"
                                data-comp-idx={idx}
                                data-comp-id={item.id}
                                data-size={s}
                                value={currentVal}
                                placeholder={needed > 0 ? String(needed) : '-'}
                                onChange={(e) => handleUpdateLocalQty(item.id, s, e.target.value)}
                                className={`w-full h-7 px-0.5 text-center font-mono font-bold text-xs rounded border transition focus:outline-none focus:ring-1 ${
                                  isReceived
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-400 focus:ring-emerald-500'
                                    : 'bg-white text-slate-900 border-slate-300 focus:ring-indigo-500'
                                }`}
                              />
                            </div>
                          </td>
                        );
                      })}

                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-rose-50 text-rose-900">
                        {item.totalQty.toLocaleString('vi-VN')}
                      </td>

                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-emerald-50 text-emerald-900">
                        {totalRec > 0 ? totalRec.toLocaleString('vi-VN') : (isDone ? item.totalQty.toLocaleString('vi-VN') : '0')}
                      </td>

                      {/* Status */}
                      <td className="p-1.5 border-r border-slate-200 text-center whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã nhận bù
                          </span>
                        ) : item.status === 'Đã gửi yêu cầu' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                            Đã gửi KH
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Chờ nhận bù
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="p-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Nút thao tác nhận bù trực tiếp, không in phiếu rườm rà */}
                          {!isDone ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleQuickReceive100(item)}
                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-2 py-1 rounded shadow-2xs transition cursor-pointer"
                                title="Nhận đủ 100% số lượng bù và tự động nạp vào Thực Nhận (Tab 2) & Kho Vật Tư"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Nhận Đủ</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(item)}
                                className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold px-2 py-1 rounded shadow-2xs transition cursor-pointer"
                                title="Ghi số lượng nhận bù chi tiết theo từng size"
                              >
                                <PackageCheck className="w-3 h-3" />
                                <span>Ghi Số Bù</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(item)}
                                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-bold px-2 py-1 rounded shadow-2xs transition cursor-pointer"
                                title="Sửa số lượng đã nhận bù"
                              >
                                <Edit className="w-3 h-3 text-sky-600" />
                                <span>Sửa Số Bù</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  confirm(`Xác nhận hủy trạng thái nhận bù cho PO ${item.poNumber}?`, () => {
                                    resetCompensationReceive(item.id);
                                    setLocalReceivedMap((prev) => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    });
                                    toast(`Đã hủy nhận bù cho PO ${item.poNumber}`);
                                  });
                                }}
                                className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition cursor-pointer"
                                title="Hủy trạng thái nhận bù"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {/* Chỉnh sửa chi tiết phiếu bù */}
                          <button
                            type="button"
                            onClick={() => setEditingItem({ ...item, sizeQuantities: { ...item.sizeQuantities } })}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Chỉnh sửa chi tiết phiếu bù"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Xóa phiếu bù */}
                          <button
                            type="button"
                            onClick={() => {
                              confirm(`Bạn có chắc chắn muốn xóa phiếu bù PO ${item.poNumber} (${item.itemCode})?`, () => {
                                deleteCompensationRequest(item.id);
                                toast(`Đã xóa phiếu bù ${item.poNumber}`);
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa phiếu bù"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Tùy chọn In Phiếu */}
                          <button
                            type="button"
                            onClick={() => setSelectedItemForPrint(item)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                            title="Tùy chọn: In phiếu bù gửi đối tác (nếu cần)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG NGUYÊN LIỆU ĐỀ NGHỊ CẤP BÙ:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-rose-900">
                    {totalCompBySize[s] > 0 ? totalCompBySize[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-rose-900">
                  {grandTotalComp > 0 ? grandTotalComp.toLocaleString('vi-VN') : '0'}
                </td>
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-900">
                  {/* Total received */}
                  {filteredItems.reduce((sum, it) => {
                    const rec = it.receivedQuantities || {};
                    const tot = Object.values(rec).reduce((a, v) => a + (Number(v) || 0), 0);
                    return sum + (tot > 0 ? tot : (it.status === 'Đã nhận bù' ? it.totalQty : 0));
                  }, 0).toLocaleString('vi-VN')}
                </td>
                <td colSpan={2} className="p-2 text-slate-500 text-[11px] italic">
                  💡 Nhận bù sẽ tự động cộng vào Số Thực Nhận (Tab 2) &amp; Tồn kho
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: In TẤT CẢ phiếu bù */}
      <PrintHtmlModal
        isOpen={showPrintAllModal}
        onClose={() => setShowPrintAllModal(false)}
        title="PHIẾU ĐỀ NGHỊ CẤP BÙ NGUYÊN LIỆU GIA CÔNG (TỔNG HỢP)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="04-BU/NLGC"
        sizes={sizes}
        rows={printAllRows}
      />

      {/* MODAL 2: In RIÊNG 1 phiếu bù được chọn */}
      {selectedItemForPrint && (
        <PrintHtmlModal
          isOpen={true}
          onClose={() => setSelectedItemForPrint(null)}
          title={`PHIẾU ĐỀ NGHỊ CẤP BÙ NGUYÊN LIỆU - PO: ${selectedItemForPrint.poNumber}`}
          customerName={currentCustomer?.name || 'Chung'}
          documentCode={`04-BU-${selectedItemForPrint.poNumber}`}
          sizes={sizes}
          rows={printSingleRows}
        />
      )}

      {/* MODAL 3: Tạo phiếu bù mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>TẠO PHIẾU BÙ NGUYÊN LIỆU MỚI</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nguồn phát sinh <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={newSource}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setNewSource(val);
                      if (val === 'DAMAGED_GOODS') setNewReason('Hàng hư hỏng trong quá trình sản xuất');
                      else if (val === 'DISCREPANCY_TAB3') setNewReason('Giao thiếu theo kiểm kê Tab 3');
                      else if (val === 'DAMAGE_OUT_OF_STOCK_TAB7') setNewReason('Hỏng hết tồn kho sản xuất (Tab 7)');
                    }}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-800"
                  >
                    <option value="DAMAGED_GOODS">Hàng hư hỏng</option>
                    <option value="DISCREPANCY_TAB3">Giao thiếu (Tab 3)</option>
                    <option value="DAMAGE_OUT_OF_STOCK_TAB7">Hỏng hết kho (Tab 7)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày đề nghị
                  </label>
                  <input
                    type="text"
                    value={newRequestDate}
                    onChange={(e) => setNewRequestDate(e.target.value)}
                    placeholder="VD: 12/09/2026"
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã PO <span className="text-rose-600">*</span>
                  </label>
                  <SearchablePoSelect
                    value={newPoNumber}
                    pos={currentCustomerPOs}
                    onChange={(val) => setNewPoNumber(val)}
                    onSelectPo={(po) => {
                      setNewPoNumber(po.poNumber);
                      if (!newItemCode && po.style) {
                        setNewItemCode(po.style);
                      }
                    }}
                    placeholder="Chọn hoặc nhập PO..."
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-indigo-500 font-mono font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã hàng (TT Code) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newItemCode}
                    onChange={(e) => setNewItemCode(e.target.value)}
                    placeholder="VD: TT-001"
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số phiếu bù / Chuyền
                  </label>
                  <input
                    type="text"
                    value={newVoucherCode}
                    onChange={(e) => setNewVoucherCode(e.target.value)}
                    placeholder="VD: BU-NL-01 hoặc Chuyền 1"
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lý do đề nghị cấp bù
                  </label>
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="Lý do..."
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Nhập số lượng theo từng size */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Số lượng bù theo Size
                  </span>
                  <span className="text-xs font-bold text-rose-600 font-mono">
                    Tổng: {sizes.reduce((sum, s) => sum + (Number(newSizeQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-slate-300 rounded p-1.5 text-center">
                      <div className="text-[11px] font-bold text-slate-600 mb-1">Sz {s}</div>
                      <input
                        type="number"
                        min="0"
                        value={newSizeQuantities[s] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setNewSizeQuantities((prev) => ({ ...prev, [s]: val }));
                        }}
                        className="w-full text-center text-xs font-mono font-bold border border-slate-200 rounded py-1 focus:ring-1 focus:ring-indigo-500"
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
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs transition cursor-pointer"
                >
                  LƯU PHIẾU BÙ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Chỉnh sửa phiếu bù */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800 text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-4 h-4 text-sky-400" />
                <span>CHỈNH SỬA PHIẾU BÙ NGUYÊN LIỆU - PO: {editingItem.poNumber}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nguồn phát sinh
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingItem.sourceLabel}
                    className="w-full text-xs border border-slate-200 rounded p-2 bg-slate-100 font-semibold text-slate-600 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày đề nghị <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.requestDate}
                    onChange={(e) => setEditingItem({ ...editingItem, requestDate: e.target.value })}
                    placeholder="VD: 12/09/2026"
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã PO <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.poNumber}
                    onChange={(e) => setEditingItem({ ...editingItem, poNumber: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã hàng (TT Code) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.itemCode}
                    onChange={(e) => setEditingItem({ ...editingItem, itemCode: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số phiếu bù / Chuyền
                  </label>
                  <input
                    type="text"
                    value={editingItem.voucherCode || editingItem.lineId || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, voucherCode: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={editingItem.status}
                    onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white focus:ring-1 focus:ring-sky-500 font-semibold text-slate-800"
                  >
                    <option value="Chờ gửi KH">Chờ gửi KH</option>
                    <option value="Đã gửi yêu cầu">Đã gửi KH</option>
                    <option value="Đã nhận bù">Đã nhận bù</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lý do đề nghị cấp bù
                  </label>
                  <input
                    type="text"
                    value={editingItem.reason}
                    onChange={(e) => setEditingItem({ ...editingItem, reason: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Nhập số lượng theo từng size */}
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Số lượng bù theo Size
                  </span>
                  <span className="text-xs font-bold text-rose-600 font-mono">
                    Tổng: {sizes.reduce((sum, s) => sum + (Number(editingItem.sizeQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-white border border-slate-300 rounded p-1.5 text-center">
                      <div className="text-[11px] font-bold text-slate-600 mb-1">Sz {s}</div>
                      <input
                        type="number"
                        min="0"
                        value={editingItem.sizeQuantities[s] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setEditingItem({
                            ...editingItem,
                            sizeQuantities: {
                              ...editingItem.sizeQuantities,
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
                  onClick={() => setEditingItem(null)}
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

      {/* MODAL GHI NHẬN SỐ LƯỢNG VẬT TƯ GIAO BÙ */}
      {receivingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    GHI NHẬN SỐ LƯỢNG VẬT TƯ GIAO BÙ
                  </h4>
                  <p className="text-xs text-slate-500">
                    PO: <strong className="text-sky-700 font-mono">{receivingItem.poNumber}</strong> • Mã hàng:{' '}
                    <strong className="text-slate-800 font-mono">{receivingItem.itemCode}</strong> • Nguồn:{' '}
                    <span className="font-semibold text-rose-600">{receivingItem.sourceLabel}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceivingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReceiveModal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày nhận bù <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveReceiveModal();
                      }
                    }}
                    placeholder="VD: 12/09/2026"
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-emerald-500 font-mono bg-white"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const full: Record<string, number | ''> = {};
                      sizes.forEach((s) => {
                        full[s] = receivingItem.sizeQuantities[s] || '';
                      });
                      setReceiveQuantities(full);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold px-3 py-2 rounded transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Điền Nhận Đủ 100% Theo Phiếu</span>
                  </button>
                </div>
              </div>

              {/* Ma trận size nhận bù */}
              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Số lượng nhận bù theo Size (Nhấn Enter để lưu ngay)
                  </span>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    Tổng nhận: {sizes.reduce((sum, s) => sum + (Number(receiveQuantities[s]) || 0), 0)} / Cần bù: {receivingItem.totalQty}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => {
                    const needed = receivingItem.sizeQuantities[s] || 0;
                    return (
                      <div
                        key={s}
                        className={`border rounded p-1.5 text-center ${
                          needed > 0 ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-slate-700 mb-0.5">Sz {s}</div>
                        <div className="text-[10px] text-slate-400 mb-1 font-mono">
                          Cần: <span className="text-rose-600 font-bold">{needed}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={receiveQuantities[s] ?? ''}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveReceiveModal();
                            }
                          }}
                          onPaste={(e) => {
                            const clip = e.clipboardData.getData('text');
                            if (!clip || (!clip.includes('\t') && !clip.includes(' '))) return;
                            const parts = clip.trim().split(/[\t\s]+/).filter(Boolean);
                            if (parts.length > 1) {
                              e.preventDefault();
                              const startIdx = sizes.indexOf(s);
                              setReceiveQuantities((prev) => {
                                const nextSq = { ...prev };
                                parts.forEach((p, offset) => {
                                  const targetIdx = startIdx + offset;
                                  if (targetIdx < sizes.length) {
                                    const targetSize = sizes[targetIdx];
                                    const num = parseInt(p.replace(/,/g, ''), 10);
                                    nextSq[targetSize] = isNaN(num) ? '' : Math.max(0, num);
                                  }
                                });
                                return nextSq;
                              });
                              toast(`📋 Đã dán ${parts.length} số lượng size bắt đầu từ Size ${s}!`);
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                            setReceiveQuantities((prev) => ({
                              ...prev,
                              [s]: val,
                            }));
                          }}
                          className="w-full text-center text-xs font-mono font-bold border border-slate-300 rounded py-1 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[11px] text-slate-500 italic">
                  💡 Nhấn Enter để lưu nhanh. Số nhận bù sẽ tự động nạp vào Số Thực Nhận (Tab 2) và Kho Vật Tư.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReceivingItem(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                  >
                    HỦY
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>LƯU &amp; NẠP VÀO KHO (Enter)</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
