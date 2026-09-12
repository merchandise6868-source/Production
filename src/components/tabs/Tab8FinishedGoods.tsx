import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { FinishedGoodsDeliveryRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  PackageCheck,
  Truck,
  Printer,
  Download,
  Plus,
  Search,
  Trash2,
  Edit,
  X,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';

interface DraftDeliveryForm {
  poNumber: string;
  itemCode: string;
  deliveryDate: string;
  deliveryVoucher: string;
  receiver: string;
  unit: string;
  sizeQuantities: Record<string, number | ''>;
  note: string;
}

export const Tab8FinishedGoods: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerFinishedGoodsStock,
    currentCustomerFinishedGoodsDeliveries,
    addFinishedGoodsDelivery,
    updateFinishedGoodsDelivery,
    deleteFinishedGoodsDelivery,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [activeSubTab, setActiveSubTab] = useState<'STOCK' | 'DELIVERY' | 'HISTORY'>('STOCK');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForPrint, setSelectedForPrint] = useState<FinishedGoodsDeliveryRow | null>(null);
  const [showStockPrintModal, setShowStockPrintModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<FinishedGoodsDeliveryRow | null>(null);

  // Form Lập phiếu xuất kho thành phẩm mới
  const [draftForm, setDraftForm] = useState<DraftDeliveryForm>(() => {
    const firstStock = currentCustomerFinishedGoodsStock[0];
    const initialSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      initialSizes[s] = '';
    });

    return {
      poNumber: firstStock?.poNumber || '',
      itemCode: firstStock?.itemCode || '',
      deliveryDate: defaultDate,
      deliveryVoucher: `XKTP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`,
      receiver: currentCustomer?.name || 'Khách hàng',
      unit: firstStock?.unit || 'PRS',
      sizeQuantities: initialSizes,
      note: 'Xuất giao thành phẩm cho khách hàng',
    };
  });

  // Khi chọn PO / Mã hàng trong form xuất, tự động cập nhật thông tin
  const handleSelectStockItem = (key: string) => {
    const item = currentCustomerFinishedGoodsStock.find((s) => s.key === key);
    if (!item) return;

    setDraftForm((prev) => ({
      ...prev,
      poNumber: item.poNumber,
      itemCode: item.itemCode,
      unit: item.unit,
    }));
  };

  // Helper lấy tồn kho thành phẩm khả dụng hiện tại cho một PO, mã hàng & size
  const getAvailableFinishedStock = (po: string, code: string, s: string): number => {
    const key = `${po.trim().toUpperCase()}__${code.trim().toUpperCase()}`;
    const stockItem = currentCustomerFinishedGoodsStock.find((st) => st.key === key);
    if (!stockItem) return 0;
    return stockItem.stockSizes[s] || 0;
  };

  // Tính tổng số lượng xuất đang nhập trong form
  const draftTotalQty = useMemo(() => {
    return sizes.reduce((sum, s) => {
      const v = draftForm.sizeQuantities[s];
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
  }, [draftForm.sizeQuantities, sizes]);

  // Lưu phiếu xuất kho thành phẩm mới (Hỗ trợ nhấn Enter)
  const handleSaveDelivery = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCustomer) return;

    if (!draftForm.poNumber.trim() || !draftForm.itemCode.trim()) {
      alert('Vui lòng chọn hoặc nhập đầy đủ Mã PO và Mã Hàng!', 'Thiếu thông tin', 'warning');
      return;
    }

    if (!draftForm.deliveryVoucher.trim()) {
      alert('Vui lòng nhập Số phiếu xuất kho thành phẩm!', 'Thiếu thông tin', 'warning');
      return;
    }

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    let hasOverStock = false;
    let overStockMsg = '';

    sizes.forEach((s) => {
      const val = typeof draftForm.sizeQuantities[s] === 'number' ? Number(draftForm.sizeQuantities[s]) : 0;
      if (val > 0) {
        cleanedSizes[s] = val;
        total += val;

        const avail = getAvailableFinishedStock(draftForm.poNumber, draftForm.itemCode, s);
        if (val > avail) {
          hasOverStock = true;
          overStockMsg += `• Size ${s}: Cần xuất ${val} nhưng tồn kho chỉ còn ${avail} đôi!\n`;
        }
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất thành phẩm cho ít nhất một Size!', 'Chưa nhập số lượng', 'warning');
      return;
    }

    if (hasOverStock) {
      alert(
        `⚠️ CẢNH BÁO XUẤT VƯỢT TỒN KHO THÀNH PHẨM:\n${overStockMsg}\nVui lòng điều chỉnh lại số lượng xuất không vượt quá tồn kho khả dụng.`,
        'Vượt Tồn Kho Thành Phẩm',
        'danger'
      );
      return;
    }

    const newDelivery: FinishedGoodsDeliveryRow = {
      id: `fg-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer.id,
      deliveryDate: draftForm.deliveryDate.trim() || defaultDate,
      poNumber: draftForm.poNumber.trim().toUpperCase(),
      itemCode: draftForm.itemCode.trim().toUpperCase(),
      deliveryVoucher: draftForm.deliveryVoucher.trim().toUpperCase(),
      receiver: draftForm.receiver.trim() || currentCustomer.name,
      unit: draftForm.unit || 'PRS',
      sizeQuantities: cleanedSizes,
      totalQty: total,
      note: draftForm.note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    addFinishedGoodsDelivery(newDelivery);
    toast(`✅ Đã lập phiếu xuất kho ${newDelivery.deliveryVoucher} cho ${total} đôi thành phẩm PO ${newDelivery.poNumber}!`);

    // Reset form
    const resetSizes: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      resetSizes[s] = '';
    });

    setDraftForm({
      poNumber: draftForm.poNumber,
      itemCode: draftForm.itemCode,
      deliveryDate: defaultDate,
      deliveryVoucher: `XKTP-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`,
      receiver: currentCustomer.name,
      unit: draftForm.unit,
      sizeQuantities: resetSizes,
      note: 'Xuất giao thành phẩm cho khách hàng',
    });

    setActiveSubTab('HISTORY');
  };

  // Cập nhật phiếu xuất đang sửa
  const handleSaveEditDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = Number(editingDelivery.sizeQuantities[s]);
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất một size.');
      return;
    }

    const updated: FinishedGoodsDeliveryRow = {
      ...editingDelivery,
      poNumber: editingDelivery.poNumber.trim().toUpperCase(),
      itemCode: editingDelivery.itemCode.trim().toUpperCase(),
      deliveryVoucher: editingDelivery.deliveryVoucher.trim().toUpperCase(),
      sizeQuantities: cleanedSizes,
      totalQty: total,
    };

    updateFinishedGoodsDelivery(updated);
    toast(`✅ Đã cập nhật phiếu xuất ${updated.deliveryVoucher}!`);
    setEditingDelivery(null);
  };

  // Danh sách tồn kho thành phẩm đã lọc
  const filteredStock = useMemo(() => {
    return currentCustomerFinishedGoodsStock.filter((item) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.poNumber.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q)
      );
    });
  }, [currentCustomerFinishedGoodsStock, searchQuery]);

  // Danh sách phiếu xuất thành phẩm đã lọc
  const filteredDeliveries = useMemo(() => {
    return currentCustomerFinishedGoodsDeliveries.filter((d) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.poNumber.toLowerCase().includes(q) ||
        d.itemCode.toLowerCase().includes(q) ||
        d.deliveryVoucher.toLowerCase().includes(q) ||
        d.receiver.toLowerCase().includes(q)
      );
    });
  }, [currentCustomerFinishedGoodsDeliveries, searchQuery]);

  // Xuất Excel Tồn Kho Thành Phẩm
  const handleExportStockExcel = () => {
    if (filteredStock.length === 0) {
      alert('Không có dữ liệu tồn kho thành phẩm để xuất Excel.');
      return;
    }

    const headers = [
      'STT',
      'Mã PO',
      'Mã Hàng (Style)',
      'ĐVT',
      'Chỉ Số',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng Cộng',
    ];

    const dataRows: any[] = [];
    filteredStock.forEach((item, idx) => {
      // Dòng 1: Đã nhập kho từ chuyền
      dataRows.push([
        idx + 1,
        item.poNumber,
        item.itemCode,
        item.unit,
        '1. Nhập kho từ chuyền (Tab 7)',
        ...sizes.map((s) => item.inboundSizes[s] || 0),
        item.totalInbound,
      ]);

      // Dòng 2: Đã xuất giao KH
      dataRows.push([
        '',
        '',
        '',
        '',
        '2. Đã xuất giao KH',
        ...sizes.map((s) => item.deliveredSizes[s] || 0),
        item.totalDelivered,
      ]);

      // Dòng 3: Tồn kho hiện tại
      dataRows.push([
        '',
        '',
        '',
        '',
        '3. TỒN KHO THÀNH PHẨM',
        ...sizes.map((s) => item.stockSizes[s] || 0),
        item.totalStock,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TonKhoThanhPham');
    XLSX.writeFile(wb, `TonKhoThanhPham_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Xuất Excel Sổ Xuất Kho Thành Phẩm
  const handleExportDeliveriesExcel = () => {
    if (filteredDeliveries.length === 0) {
      alert('Không có dữ liệu phiếu xuất thành phẩm để xuất Excel.');
      return;
    }

    const headers = [
      'STT',
      'Ngày Xuất Giao',
      'Số Phiếu Xuất (Delivery Note)',
      'Mã PO',
      'Mã Hàng',
      'Người Nhận / Khách Hàng',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Xuất',
      'Ghi Chú',
    ];

    const dataRows = filteredDeliveries.map((del, idx) => [
      idx + 1,
      del.deliveryDate,
      del.deliveryVoucher,
      del.poNumber,
      del.itemCode,
      del.receiver,
      del.unit,
      ...sizes.map((s) => del.sizeQuantities[s] || 0),
      del.totalQty,
      del.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoXuatKhoThanhPham');
    XLSX.writeFile(wb, `SoXuatKhoThanhPham_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Dữ liệu in cho 1 phiếu xuất được chọn
  const printDeliveryRows: PrintTableRow[] = useMemo(() => {
    if (!selectedForPrint) return [];
    return [
      {
        stt: 1,
        date: selectedForPrint.deliveryDate,
        voucherCode: selectedForPrint.deliveryVoucher,
        poNumber: selectedForPrint.poNumber,
        code: selectedForPrint.itemCode,
        description: `Xuất giao thành phẩm cho ${selectedForPrint.receiver}`,
        unit: selectedForPrint.unit,
        sizeQuantities: selectedForPrint.sizeQuantities,
        totalQty: selectedForPrint.totalQty,
        note: selectedForPrint.note || 'Xuất giao hàng thành phẩm đạt tiêu chuẩn',
      },
    ];
  }, [selectedForPrint]);

  // Dữ liệu in báo cáo tồn kho thành phẩm
  const printStockRows: PrintTableRow[] = useMemo(() => {
    return filteredStock.map((item, idx) => ({
      stt: idx + 1,
      date: defaultDate,
      voucherCode: 'TKTP-LONGAN',
      poNumber: item.poNumber,
      code: item.itemCode,
      description: `Tồn kho thành phẩm (${item.totalInbound} nhập - ${item.totalDelivered} xuất)`,
      unit: item.unit,
      sizeQuantities: item.stockSizes,
      totalQty: item.totalStock,
      note: item.totalStock > 0 ? 'Còn hàng trong kho' : 'Đã xuất hết',
    }));
  }, [filteredStock, defaultDate]);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 8: KHO &amp; XUẤT THÀNH PHẨM (FINISHED GOODS)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Tồn kho tự động đọc từ Báo cáo nghiệm thu Tab 7 &amp; Lập phiếu xuất giao hàng khách hàng
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab('DELIVERY')}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>+ LẬP PHIẾU XUẤT GIAO TP</span>
            </button>

            {activeSubTab === 'STOCK' ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowStockPrintModal(true)}
                  disabled={filteredStock.length === 0}
                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>In Báo Cáo Tồn TP</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportStockExcel}
                  disabled={filteredStock.length === 0}
                  className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xuất Excel Tồn TP</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleExportDeliveriesExcel}
                disabled={filteredDeliveries.length === 0}
                className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Excel Sổ Xuất TP</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-Tab Navigation & Search Toolbar */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveSubTab('STOCK')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'STOCK'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>1. Bảng Tồn Kho Thành Phẩm ({filteredStock.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('DELIVERY')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'DELIVERY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>2. Lập Phiếu Xuất Giao Hàng</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('HISTORY')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'HISTORY'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>3. Sổ Nhật Ký Xuất Kho TP ({filteredDeliveries.length})</span>
            </button>
          </div>

          <div className="relative w-64">
            <input
              type="text"
              placeholder="Tìm kiếm PO, mã hàng, số phiếu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>
        </div>

        {/* SUB-TAB 1: BẢNG TỒN KHO THÀNH PHẨM (Tự động đọc từ Tab 7) */}
        {activeSubTab === 'STOCK' && (
          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (Style)</th>
                  <th className="p-2 border-r border-slate-300 min-w-[50px] text-center">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 min-w-[160px]">Chỉ Số Thành Phẩm</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-emerald-50 text-emerald-950"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[90px] text-right bg-emerald-100 text-emerald-950 font-bold">
                    TỔNG CỘNG
                  </th>
                  <th className="p-2 border-r border-slate-300 min-w-[95px] text-center">Trạng Thái</th>
                  <th className="p-2 text-center w-28">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={5 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                      Chưa có dữ liệu thành phẩm nào được ghi nhận hoàn thành từ Tab 7 (Báo Cáo Sản Xuất Xong).
                    </td>
                  </tr>
                ) : (
                  filteredStock.map((item, idx) => (
                    <React.Fragment key={item.key}>
                      {/* Dòng 1: Nhập kho TP từ các Chuyền */}
                      <tr className="bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                        <td
                          rowSpan={3}
                          className="p-2 border-r border-slate-300 text-center text-slate-500 font-mono font-bold bg-white text-xs align-middle"
                        >
                          {idx + 1}
                        </td>
                        <td
                          rowSpan={3}
                          className="p-2 border-r border-slate-300 font-mono font-bold text-sky-700 bg-white align-middle whitespace-nowrap"
                        >
                          {item.poNumber}
                        </td>
                        <td
                          rowSpan={3}
                          className="p-2 border-r border-slate-300 font-mono font-bold text-slate-900 bg-white align-middle"
                        >
                          {item.itemCode}
                        </td>
                        <td
                          rowSpan={3}
                          className="p-2 border-r border-slate-300 text-center text-slate-600 bg-white align-middle"
                        >
                          {item.unit}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-medium text-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                          <span>1. Nhập kho TP (từ Chuyền 1,2,3)</span>
                        </td>

                        {sizes.map((s) => (
                          <td key={s} className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">
                            {item.inboundSizes[s] > 0 ? item.inboundSizes[s].toLocaleString('vi-VN') : '-'}
                          </td>
                        ))}

                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-sky-700">
                          {item.totalInbound.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-[10px] font-semibold text-slate-500">
                          Từ Tab 7
                        </td>
                        <td
                          rowSpan={3}
                          className="p-2 text-center align-middle bg-white border-l border-slate-200 whitespace-nowrap"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectStockItem(item.key);
                              setActiveSubTab('DELIVERY');
                            }}
                            disabled={item.totalStock <= 0}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded shadow-2xs transition cursor-pointer"
                            title="Lập phiếu xuất giao thành phẩm cho PO này"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Xuất Giao</span>
                          </button>
                        </td>
                      </tr>

                      {/* Dòng 2: Đã xuất giao cho khách */}
                      <tr className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="p-2 border-r border-slate-200 font-medium text-amber-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>2. Đã xuất giao Khách hàng</span>
                        </td>

                        {sizes.map((s) => (
                          <td key={s} className="p-2 border-r border-slate-200 text-center font-mono text-amber-700">
                            {item.deliveredSizes[s] > 0 ? item.deliveredSizes[s].toLocaleString('vi-VN') : '-'}
                          </td>
                        ))}

                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-amber-700">
                          {item.totalDelivered.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-[10px] font-semibold text-amber-700">
                          Đã giao
                        </td>
                      </tr>

                      {/* Dòng 3: TỒN KHO THÀNH PHẨM HIỆN TẠI */}
                      <tr className="bg-emerald-50/60 font-bold border-b-2 border-slate-300">
                        <td className="p-2 border-r border-slate-200 text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>3. TỒN KHO TP HIỆN TẠI</span>
                        </td>

                        {sizes.map((s) => {
                          const st = item.stockSizes[s] || 0;
                          return (
                            <td
                              key={s}
                              className={`p-2 border-r border-slate-200 text-center font-mono text-xs ${
                                st > 0
                                  ? 'text-emerald-900 bg-emerald-100/60 font-bold'
                                  : 'text-slate-400 font-normal'
                              }`}
                            >
                              {st > 0 ? st.toLocaleString('vi-VN') : '0'}
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-100">
                          {item.totalStock.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center">
                          {item.totalStock > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Khả dụng
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                              Hết tồn
                            </span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SUB-TAB 2: LẬP PHIẾU XUẤT GIAO THÀNH PHẨM (Form nhập nhanh, Enter để lưu) */}
        {activeSubTab === 'DELIVERY' && (
          <div className="p-4 bg-white">
            <form onSubmit={handleSaveDelivery} className="max-w-4xl mx-auto space-y-4">
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                      LẬP PHIẾU XUẤT KHO THÀNH PHẨM GỬI KHÁCH HÀNG
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Chọn đơn hàng có tồn kho thành phẩm, nhập số lượng xuất theo size và nhấn Enter để lưu ngay.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-500 block">Tổng SL xuất đợt này</span>
                  <span className="text-sm font-bold font-mono text-emerald-800">
                    {draftTotalQty.toLocaleString('vi-VN')} {draftForm.unit}
                  </span>
                </div>
              </div>

              {/* Thông tin chung của phiếu xuất */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chọn Mã PO / Mã Hàng <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={`${draftForm.poNumber}__${draftForm.itemCode}`}
                    onChange={(e) => handleSelectStockItem(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded p-2 bg-white focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-slate-800"
                  >
                    {currentCustomerFinishedGoodsStock.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.poNumber} - {st.itemCode} (Tồn: {st.totalStock})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày xuất giao <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={draftForm.deliveryDate}
                    onChange={(e) => setDraftForm({ ...draftForm, deliveryDate: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveDelivery();
                      }
                    }}
                    placeholder="VD: 12/09/2026"
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-emerald-500 font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số phiếu xuất (Voucher) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={draftForm.deliveryVoucher}
                    onChange={(e) => setDraftForm({ ...draftForm, deliveryVoucher: e.target.value.toUpperCase() })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveDelivery();
                      }
                    }}
                    placeholder="VD: XKTP-0926-001"
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-emerald-500 font-mono font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Người / Đơn vị nhận hàng
                  </label>
                  <input
                    type="text"
                    value={draftForm.receiver}
                    onChange={(e) => setDraftForm({ ...draftForm, receiver: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveDelivery();
                      }
                    }}
                    placeholder="Tên đối tác / Kho nhận"
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Ma trận size xuất kho */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span>Nhập số lượng xuất theo Size</span>
                    <span className="text-[11px] font-normal text-slate-500">(nhấn Enter để lưu ngay)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fullStock: Record<string, number | ''> = {};
                      sizes.forEach((s) => {
                        const avail = getAvailableFinishedStock(draftForm.poNumber, draftForm.itemCode, s);
                        fullStock[s] = avail > 0 ? avail : '';
                      });
                      setDraftForm((prev) => ({ ...prev, sizeQuantities: fullStock }));
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                  >
                    Điền xuất hết toàn bộ tồn kho
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2.5">
                  {sizes.map((s) => {
                    const avail = getAvailableFinishedStock(draftForm.poNumber, draftForm.itemCode, s);
                    const currentVal = draftForm.sizeQuantities[s];
                    const isOver = typeof currentVal === 'number' && currentVal > avail;

                    return (
                      <div
                        key={s}
                        className={`border rounded-lg p-2 text-center transition ${
                          isOver
                            ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400'
                            : avail > 0
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-slate-700">Size {s}</div>
                        <div className="text-[10px] text-slate-500 mb-1 font-mono">
                          Tồn: <strong className={avail > 0 ? 'text-emerald-700' : 'text-slate-400'}>{avail}</strong>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={avail}
                          value={currentVal ?? ''}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveDelivery();
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                            setDraftForm((prev) => ({
                              ...prev,
                              sizeQuantities: {
                                ...prev.sizeQuantities,
                                [s]: val,
                              },
                            }));
                          }}
                          className={`w-full text-center text-xs font-mono font-bold border rounded py-1.5 focus:outline-none focus:ring-1 ${
                            isOver
                              ? 'border-rose-500 text-rose-700 bg-white focus:ring-rose-500'
                              : 'border-slate-300 text-slate-900 bg-white focus:ring-emerald-500 focus:border-emerald-500'
                          }`}
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ghi chú & Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="w-full sm:w-1/2">
                  <input
                    type="text"
                    value={draftForm.note}
                    onChange={(e) => setDraftForm({ ...draftForm, note: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveDelivery();
                      }
                    }}
                    placeholder="Ghi chú đợt xuất giao thành phẩm..."
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('STOCK')}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                  >
                    QUAY LẠI TỒN KHO
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>LƯU &amp; XUẤT KHO THÀNH PHẨM (Enter)</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* SUB-TAB 3: SỔ NHẬT KÝ CÁC ĐỢT XUẤT KHO THÀNH PHẨM (Có nút Sửa & Xóa trên mọi dòng) */}
        {activeSubTab === 'HISTORY' && (
          <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[85px]">Ngày Xuất</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Số Phiếu XK</th>
                  <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[115px]">Mã Hàng</th>
                  <th className="p-2 border-r border-slate-300 min-w-[120px]">Người Nhận</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-amber-50 text-amber-950"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-amber-100 text-amber-950 font-bold">
                    TỔNG XUẤT
                  </th>
                  <th className="p-2 border-r border-slate-300 min-w-[140px]">Ghi Chú</th>
                  <th className="p-2 text-center w-28">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                      Chưa có phiếu xuất kho thành phẩm nào được lập.
                    </td>
                  </tr>
                ) : (
                  filteredDeliveries.map((del, idx) => (
                    <tr key={del.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono text-slate-700">
                        {del.deliveryDate}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-slate-900">
                        {del.deliveryVoucher}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-sky-700">
                        {del.poNumber}
                      </td>
                      <td className="p-2 border-r border-slate-200 whitespace-nowrap font-mono font-bold text-slate-800">
                        {del.itemCode}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-700">
                        {del.receiver}
                      </td>

                      {sizes.map((s) => {
                        const q = del.sizeQuantities[s] || 0;
                        return (
                          <td
                            key={s}
                            className={`p-2 border-r border-slate-200 text-center font-mono ${
                              q > 0 ? 'text-amber-800 font-bold bg-amber-50/50' : 'text-slate-300'
                            }`}
                          >
                            {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                          </td>
                        );
                      })}

                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-amber-50 text-amber-950">
                        {del.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-600 text-[11px] truncate max-w-[150px]">
                        {del.note || '-'}
                      </td>

                      {/* Nút Sửa, Xóa và In Phiếu Giao Hàng trên mọi dòng */}
                      <td className="p-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedForPrint(del)}
                            className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold px-2 py-1 rounded transition shadow-2xs cursor-pointer"
                            title="In phiếu xuất kho thành phẩm giao khách hàng"
                          >
                            <Printer className="w-3 h-3 text-indigo-600" />
                            <span>In Phiếu</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingDelivery({ ...del, sizeQuantities: { ...del.sizeQuantities } })}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Chỉnh sửa phiếu xuất"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              confirm(`Bạn có chắc chắn muốn xóa phiếu xuất ${del.deliveryVoucher} (${del.totalQty} đôi)?
Số lượng này sẽ tự động được hoàn trả lại vào Tồn Kho Thành Phẩm!`, () => {
                                deleteFinishedGoodsDelivery(del.id);
                                toast(`Đã xóa phiếu xuất ${del.deliveryVoucher}`);
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa phiếu xuất"
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
        )}
      </div>

      {/* MODAL IN PHIẾU XUẤT KHO THÀNH PHẨM (DELIVERY NOTE) */}
      <PrintHtmlModal
        isOpen={Boolean(selectedForPrint)}
        onClose={() => setSelectedForPrint(null)}
        documentTitle="PHIẾU XUẤT KHO THÀNH PHẨM GIAO KHÁCH HÀNG"
        documentNumber={selectedForPrint?.deliveryVoucher}
        dateStr={selectedForPrint?.deliveryDate}
        customerName={selectedForPrint?.receiver || currentCustomer?.name || 'Khách hàng'}
        poNumber={selectedForPrint?.poNumber}
        sizes={sizes}
        rows={printDeliveryRows}
      />

      {/* MODAL IN BÁO CÁO TỒN KHO THÀNH PHẨM */}
      <PrintHtmlModal
        isOpen={showStockPrintModal}
        onClose={() => setShowStockPrintModal(false)}
        documentTitle="BÁO CÁO TỒN KHO THÀNH PHẨM TỔNG HỢP"
        documentNumber="BCTK-TP-01"
        dateStr={defaultDate}
        customerName={currentCustomer?.name || 'Chung'}
        sizes={sizes}
        rows={printStockRows}
      />

      {/* MODAL CHỈNH SỬA PHIẾU XUẤT THÀNH PHẨM (Hỗ trợ nhấn Enter để lưu) */}
      {editingDelivery && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    CHỈNH SỬA PHIẾU XUẤT KHO THÀNH PHẨM
                  </h4>
                  <p className="text-xs text-slate-500">
                    Số phiếu: <strong className="text-slate-800 font-mono">{editingDelivery.deliveryVoucher}</strong> • Mã PO:{' '}
                    <strong className="text-sky-700 font-mono">{editingDelivery.poNumber}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDelivery(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDelivery} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ngày xuất <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingDelivery.deliveryDate}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, deliveryDate: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số phiếu xuất <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editingDelivery.deliveryVoucher}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, deliveryVoucher: e.target.value.toUpperCase() })}
                    className="w-full text-xs border border-slate-300 rounded p-2 uppercase focus:ring-1 focus:ring-sky-500 font-mono font-bold bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Người / Đơn vị nhận
                  </label>
                  <input
                    type="text"
                    value={editingDelivery.receiver}
                    onChange={(e) => setEditingDelivery({ ...editingDelivery, receiver: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 bg-white"
                  />
                </div>
              </div>

              {/* Ma trận size sửa */}
              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 uppercase">
                    Số lượng xuất theo Size (Nhấn Enter để lưu)
                  </span>
                  <span className="text-xs font-bold text-amber-700 font-mono">
                    Tổng xuất: {sizes.reduce((sum, s) => sum + (Number(editingDelivery.sizeQuantities[s]) || 0), 0)}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-9 gap-2">
                  {sizes.map((s) => (
                    <div key={s} className="bg-slate-50 border border-slate-200 rounded p-1.5 text-center">
                      <div className="text-[11px] font-bold text-slate-700 mb-1">Sz {s}</div>
                      <input
                        type="number"
                        min="0"
                        value={editingDelivery.sizeQuantities[s] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                          setEditingDelivery({
                            ...editingDelivery,
                            sizeQuantities: {
                              ...editingDelivery.sizeQuantities,
                              [s]: typeof val === 'number' ? val : 0,
                            },
                          });
                        }}
                        className="w-full text-center text-xs font-mono font-bold border border-slate-300 rounded py-1 focus:ring-1 focus:ring-sky-500 bg-white"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={editingDelivery.note || ''}
                  onChange={(e) => setEditingDelivery({ ...editingDelivery, note: e.target.value })}
                  className="w-full text-xs border border-slate-300 rounded p-2 focus:ring-1 focus:ring-sky-500 bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition cursor-pointer"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded shadow-xs transition cursor-pointer"
                >
                  LƯU THAY ĐỔI (Enter)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
