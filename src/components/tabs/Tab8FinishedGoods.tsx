import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { FinishedGoodsDeliveryRow, FinishedGoodsStockItem } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  PackageCheck,
  Printer,
  Download,
  Search,
  Trash2,
  Edit,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';

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

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForPrint, setSelectedForPrint] = useState<FinishedGoodsDeliveryRow | null>(null);
  const [showStockPrintModal, setShowStockPrintModal] = useState(false);

  // State quản lý trạng thái mở khóa sửa (in-place unlock) theo từng SKU
  const [editingKeys, setEditingKeys] = useState<Record<string, boolean>>({});

  // Local state lưu trữ số lượng xuất đang nhập trực tiếp trên dòng 2 của bảng (theo item.key)
  const [deliveredInputs, setDeliveredInputs] = useState<Record<string, Record<string, number | ''>>>({});

  // Helper lấy giá trị đang nhập (hoặc từ dữ liệu đã lưu nếu chưa gõ)
  const getItemDeliveredSizes = (item: FinishedGoodsStockItem): Record<string, number | ''> => {
    if (deliveredInputs[item.key]) {
      return deliveredInputs[item.key];
    }
    const init: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      const savedVal = item.deliveredSizes[s];
      init[s] = savedVal > 0 ? savedVal : '';
    });
    return init;
  };

  const isRowEditing = (item: FinishedGoodsStockItem): boolean => {
    if (typeof editingKeys[item.key] === 'boolean') {
      return editingKeys[item.key];
    }
    // Nếu chưa có số lượng xuất nào thì mặc định mở khóa để nhập
    return item.totalDelivered === 0;
  };

  const handleStartEdit = (key: string) => {
    setEditingKeys((prev) => ({ ...prev, [key]: true }));
  };

  const handleUpdateItemSize = (itemKey: string, size: string, val: string, currentItem: FinishedGoodsStockItem) => {
    const current = deliveredInputs[itemKey] || getItemDeliveredSizes(currentItem);
    const num = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setDeliveredInputs((prev) => ({
      ...prev,
      [itemKey]: {
        ...current,
        [size]: num,
      },
    }));
  };

  // Paste ma trận số lượng từ Excel vào dòng 2 bắt đầu từ size được click
  const handleSizePaste = (
    e: React.ClipboardEvent,
    itemKey: string,
    startSize: string,
    currentItem: FinishedGoodsStockItem
  ) => {
    const clip = e.clipboardData.getData('text');
    if (!clip || (!clip.includes('\t') && !clip.includes(' '))) return;

    const parts = clip.trim().split(/[\t\s]+/).filter(Boolean);
    if (parts.length > 1) {
      e.preventDefault();
      const current = deliveredInputs[itemKey] || getItemDeliveredSizes(currentItem);
      const nextSq = { ...current };
      const startIdx = sizes.indexOf(startSize);

      parts.forEach((p, offset) => {
        const targetIdx = startIdx + offset;
        if (targetIdx < sizes.length) {
          const targetSize = sizes[targetIdx];
          const num = parseInt(p.replace(/,/g, ''), 10);
          nextSq[targetSize] = isNaN(num) ? '' : Math.max(0, num);
        }
      });

      setDeliveredInputs((prev) => ({
        ...prev,
        [itemKey]: nextSq,
      }));
      toast(`📋 Đã dán ${parts.length} số lượng xuất bắt đầu từ Size ${startSize}!`);
    }
  };

  // Lưu số lượng xuất trực tiếp cho 1 PO/SKU và KHÓA DÒNG TẠI CHỖ (Không mở popup form)
  const handleSaveOutbound = (item: FinishedGoodsStockItem) => {
    if (!currentCustomer) return;

    const currentSq = deliveredInputs[item.key] || getItemDeliveredSizes(item);
    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    let hasOverStock = false;
    let overStockMsg = '';

    sizes.forEach((s) => {
      const val = typeof currentSq[s] === 'number' ? Number(currentSq[s]) : 0;
      if (val > 0) {
        cleanedSizes[s] = val;
        total += val;

        const inbound = item.inboundSizes[s] || 0;
        if (val > inbound) {
          hasOverStock = true;
          overStockMsg += `• Size ${s}: Xuất ${val} nhưng nhập kho chỉ có ${inbound} đôi!\n`;
        }
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất một Size!', 'Chưa nhập số lượng', 'warning');
      return;
    }

    if (hasOverStock) {
      alert(
        `⚠️ CẢNH BÁO XUẤT VƯỢT TỒN KHO THÀNH PHẨM:\n${overStockMsg}\nVui lòng điều chỉnh lại số lượng xuất không vượt quá nhập kho.`,
        'Vượt Tồn Kho Thành Phẩm',
        'danger'
      );
      return;
    }

    const existingDelivery = currentCustomerFinishedGoodsDeliveries.find(
      (d) =>
        d.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
        d.itemCode.toUpperCase() === item.itemCode.toUpperCase()
    );

    if (existingDelivery) {
      const updated: FinishedGoodsDeliveryRow = {
        ...existingDelivery,
        sizeQuantities: cleanedSizes,
        totalQty: total,
      };
      updateFinishedGoodsDelivery(updated);
    } else {
      const newDelivery: FinishedGoodsDeliveryRow = {
        id: `fg-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        customerId: currentCustomer.id,
        deliveryDate: defaultDate,
        poNumber: item.poNumber,
        itemCode: item.itemCode,
        deliveryVoucher: `XKTP-${item.poNumber}`,
        receiver: currentCustomer.name || 'Khách hàng',
        unit: item.unit || 'PRS',
        sizeQuantities: cleanedSizes,
        totalQty: total,
        note: 'Xuất giao thành phẩm cho khách hàng',
        createdAt: new Date().toISOString(),
      };
      addFinishedGoodsDelivery(newDelivery);
    }

    // KHÓA DÒNG TẠI CHỖ
    setEditingKeys((prev) => ({ ...prev, [item.key]: false }));
    toast(`🔒 Đã lưu & khóa số lượng xuất PO ${item.poNumber} (${total.toLocaleString('vi-VN')} đôi)! Nhấn Sửa ✏️ để mở khóa sửa lại.`);
  };

  // Xóa / Hủy số lượng đã xuất cho 1 PO/SKU
  const handleDeleteOutbound = (item: FinishedGoodsStockItem) => {
    const existingDeliveries = currentCustomerFinishedGoodsDeliveries.filter(
      (d) =>
        d.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
        d.itemCode.toUpperCase() === item.itemCode.toUpperCase()
    );

    if (existingDeliveries.length === 0 && (!deliveredInputs[item.key] || item.totalDelivered === 0)) {
      alert('Chưa có số lượng xuất nào được lưu cho đơn hàng này.');
      return;
    }

    confirm(
      `Bạn có chắc chắn muốn xóa/hủy toàn bộ số lượng xuất của PO ${item.poNumber}?\nTồn kho thành phẩm sẽ được hoàn trả 100%!`,
      () => {
        existingDeliveries.forEach((d) => deleteFinishedGoodsDelivery(d.id));
        const emptySq: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          emptySq[s] = '';
        });
        setDeliveredInputs((prev) => ({
          ...prev,
          [item.key]: emptySq,
        }));
        setEditingKeys((prev) => ({ ...prev, [item.key]: true }));
        toast(`Đã xóa số lượng xuất của PO ${item.poNumber}. Tồn kho thành phẩm đã được phục hồi!`);
      }
    );
  };

  // In phiếu xuất cho PO này
  const handlePrintDelivery = (item: FinishedGoodsStockItem) => {
    const existing = currentCustomerFinishedGoodsDeliveries.find(
      (d) =>
        d.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
        d.itemCode.toUpperCase() === item.itemCode.toUpperCase()
    );

    const currentSq = deliveredInputs[item.key] || getItemDeliveredSizes(item);
    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = typeof currentSq[s] === 'number' ? Number(currentSq[s]) : 0;
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Chưa có số lượng xuất nào để in phiếu.');
      return;
    }

    const delObj: FinishedGoodsDeliveryRow = existing || {
      id: `fg-del-print-${Date.now()}`,
      customerId: currentCustomer?.id || '',
      deliveryDate: defaultDate,
      poNumber: item.poNumber,
      itemCode: item.itemCode,
      deliveryVoucher: `XKTP-${item.poNumber}`,
      receiver: currentCustomer?.name || 'Khách hàng',
      unit: item.unit,
      sizeQuantities: cleanedSizes,
      totalQty: total,
      note: 'Xuất giao thành phẩm cho khách hàng',
      createdAt: new Date().toISOString(),
    };

    setSelectedForPrint(delObj);
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
      const deliveredSizes = getItemDeliveredSizes(item);
      const deliveredTotal = sizes.reduce((sum, s) => {
        const v = deliveredSizes[s];
        return sum + (typeof v === 'number' ? v : 0);
      }, 0);

      const stockTotal = item.totalInbound - deliveredTotal;

      dataRows.push([
        idx + 1,
        item.poNumber,
        item.itemCode,
        item.unit,
        '1. Nhập kho từ chuyền (Tab 7)',
        ...sizes.map((s) => item.inboundSizes[s] || 0),
        item.totalInbound,
      ]);

      dataRows.push([
        '',
        '',
        '',
        '',
        '2. Đã xuất giao KH',
        ...sizes.map((s) => (typeof deliveredSizes[s] === 'number' ? deliveredSizes[s] : 0)),
        deliveredTotal,
      ]);

      dataRows.push([
        '',
        '',
        '',
        '',
        '3. TỒN KHO THÀNH PHẨM HIỆN TẠI',
        ...sizes.map((s) => {
          const inQ = item.inboundSizes[s] || 0;
          const outQ = typeof deliveredSizes[s] === 'number' ? Number(deliveredSizes[s]) : 0;
          return inQ - outQ;
        }),
        stockTotal,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TonKhoThanhPham');
    XLSX.writeFile(wb, `TonKhoThanhPham_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Dữ liệu in cho phiếu xuất được chọn
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
    return filteredStock.map((item, idx) => {
      const deliveredSizes = getItemDeliveredSizes(item);
      const stockSizes: Record<string, number> = {};
      let totalStock = 0;

      sizes.forEach((s) => {
        const inQ = item.inboundSizes[s] || 0;
        const outQ = typeof deliveredSizes[s] === 'number' ? Number(deliveredSizes[s]) : 0;
        const st = inQ - outQ;
        stockSizes[s] = st;
        totalStock += st;
      });

      return {
        stt: idx + 1,
        date: defaultDate,
        voucherCode: 'TKTP-LONGAN',
        poNumber: item.poNumber,
        code: item.itemCode,
        description: `Tồn kho thành phẩm (${item.totalInbound} nhập - ${item.totalInbound - totalStock} xuất)`,
        unit: item.unit,
        sizeQuantities: stockSizes,
        totalQty: totalStock,
        note: totalStock > 0 ? 'Còn hàng trong kho' : 'Đã xuất hết',
      };
    });
  }, [filteredStock, defaultDate, sizes, deliveredInputs]);

  return (
    <div className="space-y-4">
      {/* Khung Bảng Excel Duy Nhất */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Top Header & Toolbar */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 8: KHO &amp; XUẤT THÀNH PHẨM (FINISHED GOODS)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Nhập trực tiếp số lượng xuất tại dòng 2, nhấn Enter để lưu &amp; khóa dòng • Bấm Sửa để mở khóa trực tiếp tại ô
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <div className="relative w-40 sm:w-52">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            <button
              type="button"
              onClick={() => setShowStockPrintModal(true)}
              disabled={filteredStock.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In Báo Cáo Tồn TP</span>
            </button>

            <button
              type="button"
              onClick={handleExportStockExcel}
              disabled={filteredStock.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel Tồn TP</span>
            </button>
          </div>
        </div>

        {/* BẢNG TỒN KHO THÀNH PHẨM HIỆN CÓ (Nhập trực tiếp số xuất trên dòng 2, Enter để lưu) */}
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (Style)</th>
                <th className="p-2 border-r border-slate-300 min-w-[50px] text-center">ĐVT</th>
                <th className="p-2 border-r border-slate-300 min-w-[170px]">Chỉ Số Thành Phẩm</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[50px] text-center font-mono font-bold bg-emerald-50 text-emerald-950"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[90px] text-right bg-emerald-100 text-emerald-950 font-bold">
                  TỔNG CỘNG
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[95px] text-center">Trạng Thái</th>
                <th className="p-2 text-center w-28">Thao Tác</th>
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
                filteredStock.map((item, idx) => {
                  const isEditing = isRowEditing(item);
                  const currentDeliveredSizes = getItemDeliveredSizes(item);

                  const liveTotalDelivered = sizes.reduce((sum, s) => {
                    const v = currentDeliveredSizes[s];
                    return sum + (typeof v === 'number' ? v : 0);
                  }, 0);

                  const liveTotalStock = item.totalInbound - liveTotalDelivered;
                  const rowStt = idx + 1;

                  return (
                    <React.Fragment key={item.key}>
                      {/* Dòng 1: Nhập kho TP từ các Chuyền (Đọc tự động từ Tab 7) */}
                      <tr className="bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                        <td
                          rowSpan={3}
                          className="p-2 border-r border-slate-300 text-center text-slate-500 font-mono font-bold bg-white text-xs align-middle"
                        >
                          {rowStt}
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
                          className="p-2 text-center align-middle bg-white border-l border-slate-300 whitespace-nowrap"
                        >
                          <div className="flex flex-col items-center justify-center gap-1">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => handleSaveOutbound(item)}
                                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded shadow-2xs transition cursor-pointer"
                                title="Lưu số lượng xuất và khóa dòng (Enter)"
                              >
                                <Save className="w-3 h-3" />
                                <span>Lưu Xuất</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(item.key)}
                                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-300 text-[11px] font-bold rounded shadow-2xs transition cursor-pointer"
                                title="Mở khóa dòng này để sửa trực tiếp trên ô"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Sửa Số Xuất</span>
                              </button>
                            )}

                            <div className="flex items-center justify-center gap-1 w-full pt-0.5">
                              {/* Nút In Phiếu */}
                              <button
                                type="button"
                                onClick={() => handlePrintDelivery(item)}
                                disabled={liveTotalDelivered <= 0}
                                className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded hover:bg-indigo-50 transition cursor-pointer"
                                title="In phiếu xuất kho thành phẩm"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Nút Xóa / Hủy số lượng đã xuất */}
                              <button
                                type="button"
                                onClick={() => handleDeleteOutbound(item)}
                                disabled={liveTotalDelivered <= 0}
                                className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa/hủy xuất để hoàn trả lại tồn kho thành phẩm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Dòng 2: ĐÃ XUẤT GIAO KHÁCH HÀNG (Sửa trực tiếp tại ô, Enter lưu khóa dòng) */}
                      <tr className="bg-[#fffbeb] hover:bg-[#fef3c7] transition-colors border-y border-amber-200">
                        <td className="p-2 border-r border-slate-200 font-bold text-amber-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>2. Đã xuất giao Khách hàng</span>
                        </td>

                        {sizes.map((s) => {
                          const val = currentDeliveredSizes[s];
                          const inbound = item.inboundSizes[s] || 0;
                          const isOver = typeof val === 'number' && val > inbound;

                          return (
                            <td
                              key={s}
                              className={`p-0 border-r border-slate-200 ${
                                isOver ? 'bg-rose-100 ring-1 ring-rose-400' : ''
                              }`}
                            >
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={inbound}
                                  value={val ?? ''}
                                  onChange={(e) => handleUpdateItemSize(item.key, s, e.target.value, item)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveOutbound(item);
                                    }
                                  }}
                                  onPaste={(e) => handleSizePaste(e, item.key, s, item)}
                                  placeholder="-"
                                  className={`w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white focus:outline-none focus:ring-1 ${
                                    isOver
                                      ? 'text-rose-700 focus:ring-rose-500 border border-rose-400'
                                      : 'text-amber-900 focus:ring-amber-500 border border-amber-200 hover:border-amber-400'
                                  }`}
                                  title={`Nhập số lượng xuất Size ${s} (Tồn nhập: ${inbound}). Nhấn Enter để lưu.`}
                                />
                              ) : (
                                <div
                                  className={`p-2 font-mono font-bold text-center ${
                                    typeof val === 'number' && val > 0 ? 'text-amber-800 bg-amber-50/60' : 'text-slate-300'
                                  }`}
                                >
                                  {typeof val === 'number' && val > 0 ? val.toLocaleString('vi-VN') : '-'}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-amber-900 bg-amber-100">
                          {liveTotalDelivered > 0 ? liveTotalDelivered.toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-[10px] font-bold text-amber-800">
                          {isEditing ? (
                            <span className="text-sky-700 font-semibold">Đang sửa ô...</span>
                          ) : liveTotalDelivered > 0 ? (
                            'Đã khóa xuất'
                          ) : (
                            'Chưa xuất'
                          )}
                        </td>
                      </tr>

                      {/* Dòng 3: TỒN KHO THÀNH PHẨM HIỆN TẠI (Tự động tính = Nhập kho - Đã xuất) */}
                      <tr className="bg-emerald-50/60 font-bold border-b-2 border-slate-300">
                        <td className="p-2 border-r border-slate-200 text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>3. TỒN KHO TP HIỆN TẠI</span>
                        </td>

                        {sizes.map((s) => {
                          const inQ = item.inboundSizes[s] || 0;
                          const outQ = typeof currentDeliveredSizes[s] === 'number' ? Number(currentDeliveredSizes[s]) : 0;
                          const st = inQ - outQ;

                          return (
                            <td
                              key={s}
                              className={`p-2 border-r border-slate-200 text-center font-mono text-xs ${
                                st > 0
                                  ? 'text-emerald-900 bg-emerald-100/70 font-bold'
                                  : st < 0
                                  ? 'text-rose-700 bg-rose-100 font-bold'
                                  : 'text-slate-400 font-normal'
                              }`}
                            >
                              {st}
                            </td>
                          );
                        })}

                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-100">
                          {liveTotalStock.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center">
                          {liveTotalStock > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Khả dụng
                            </span>
                          ) : liveTotalStock < 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Xuất vượt
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                              Hết tồn
                            </span>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              💡 <strong>Quy tắc thao tác:</strong> Nhập số lượng xuất trực tiếp vào <strong>Dòng 2 (Đã xuất giao Khách hàng)</strong> rồi nhấn <strong>Enter</strong> để lưu và khóa dòng lại. Khi cần sửa, bấm nút <strong>Sửa Số Xuất ✏️</strong> để mở khóa sửa trực tiếp trên ô, không mở form mới!
            </span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong>{filteredStock.length}</strong> đơn hàng thành phẩm
          </div>
        </div>
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
    </div>
  );
};
