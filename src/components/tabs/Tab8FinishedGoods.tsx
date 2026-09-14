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
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
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

  // Map các đợt xuất đang mở khóa sửa (In-place editing): delivery.id -> FinishedGoodsDeliveryRow
  const [editingDeliveries, setEditingDeliveries] = useState<Record<string, FinishedGoodsDeliveryRow>>({});

  // Map các dòng soạn đợt xuất mới theo từng PO (item.key = poNumber__itemCode)
  const [draftDeliveries, setDraftDeliveries] = useState<Record<string, FinishedGoodsDeliveryRow | null>>({});

  // Helper lấy danh sách các đợt xuất đã lưu của 1 PO cụ thể
  const getPoDeliveries = (item: FinishedGoodsStockItem): FinishedGoodsDeliveryRow[] => {
    return currentCustomerFinishedGoodsDeliveries.filter(
      (d) =>
        d.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
        d.itemCode.toUpperCase() === item.itemCode.toUpperCase()
    );
  };

  // Helper tạo đợt xuất mới trống cho 1 PO
  const createBlankDelivery = (item: FinishedGoodsStockItem, batchNum: number): FinishedGoodsDeliveryRow => {
    const emptySq: Record<string, number> = {};
    sizes.forEach((s) => {
      emptySq[s] = 0;
    });

    return {
      id: `draft-del-${Date.now()}-${item.key}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer?.id || '',
      deliveryDate: defaultDate,
      poNumber: item.poNumber,
      itemCode: item.itemCode,
      deliveryVoucher: `HD-${item.poNumber}-${String(batchNum).padStart(2, '0')}`,
      receiver: currentCustomer?.name || 'Khách hàng',
      unit: item.unit || 'PRS',
      sizeQuantities: emptySq,
      totalQty: 0,
      note: `Xuất đợt ${batchNum}`,
      createdAt: new Date().toISOString(),
    };
  };

  // Helper lấy thông tin dòng soạn đợt mới (hoặc tạo mặc định nếu chưa có đợt xuất nào)
  const getDraftForPo = (item: FinishedGoodsStockItem): FinishedGoodsDeliveryRow | null => {
    if (draftDeliveries[item.key] !== undefined) {
      return draftDeliveries[item.key];
    }
    const existing = getPoDeliveries(item);
    if (existing.length === 0) {
      return createBlankDelivery(item, 1);
    }
    return null;
  };

  // Mở thêm 1 đợt xuất mới cho PO
  const handleOpenAddDelivery = (item: FinishedGoodsStockItem) => {
    const existing = getPoDeliveries(item);
    const nextBatch = existing.length + 1;
    const newDraft = createBlankDelivery(item, nextBatch);
    setDraftDeliveries((prev) => ({ ...prev, [item.key]: newDraft }));
    toast(`➕ Mở đợt xuất mới (Đợt ${nextBatch}) cho PO ${item.poNumber}!`);
  };

  // Cập nhật giá trị ô trên dòng soạn đợt mới
  const handleUpdateDraftField = (itemKey: string, field: keyof FinishedGoodsDeliveryRow, value: any) => {
    setDraftDeliveries((prev) => {
      const current = prev[itemKey];
      if (!current) return prev;
      return {
        ...prev,
        [itemKey]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleUpdateDraftSize = (itemKey: string, size: string, val: string) => {
    setDraftDeliveries((prev) => {
      const current = prev[itemKey];
      if (!current) return prev;
      const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
      const nextSq = { ...current.sizeQuantities, [size]: num };
      const total = Object.values(nextSq).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return {
        ...prev,
        [itemKey]: {
          ...current,
          sizeQuantities: nextSq,
          totalQty: total,
        },
      };
    });
  };

  // Hủy dòng soạn đợt mới
  const handleCancelDraft = (itemKey: string) => {
    setDraftDeliveries((prev) => ({ ...prev, [itemKey]: null }));
  };

  // Lưu đợt xuất mới và khóa dòng tại chỗ
  const handleSaveDraftDelivery = (item: FinishedGoodsStockItem) => {
    if (!currentCustomer) return;
    const draft = getDraftForPo(item);
    if (!draft) return;

    if (!draft.deliveryVoucher.trim()) {
      alert('Vui lòng nhập Số Hóa Đơn / Phiếu Xuất!', 'Thiếu thông tin', 'warning');
      return;
    }

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = draft.sizeQuantities[s] || 0;
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    // Kiểm tra xuất vượt tồn kho thành phẩm
    const existingDeliveries = getPoDeliveries(item);
    let hasOverStock = false;
    let overStockMsg = '';

    sizes.forEach((s) => {
      const alreadyDelivered = existingDeliveries.reduce((sum, d) => sum + (d.sizeQuantities[s] || 0), 0);
      const currentInbound = item.inboundSizes[s] || 0;
      const currentStockAvailable = currentInbound - alreadyDelivered;
      const willDeliver = cleanedSizes[s] || 0;

      if (willDeliver > currentStockAvailable) {
        hasOverStock = true;
        overStockMsg += `• Size ${s}: Nhập ${willDeliver} đôi, nhưng tồn kho chỉ còn ${currentStockAvailable} đôi (Nhập: ${currentInbound}, Đã xuất trước đó: ${alreadyDelivered})!\n`;
      }
    });

    if (hasOverStock) {
      alert(
        `⚠️ CẢNH BÁO XUẤT VƯỢT TỒN KHO THÀNH PHẨM:\n${overStockMsg}\nVui lòng điều chỉnh lại số lượng xuất.`,
        'Vượt Tồn Kho Thành Phẩm',
        'danger'
      );
      return;
    }

    const finalDelivery: FinishedGoodsDeliveryRow = {
      id: `fg-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer.id,
      deliveryDate: draft.deliveryDate.trim() || defaultDate,
      poNumber: item.poNumber,
      itemCode: item.itemCode,
      deliveryVoucher: draft.deliveryVoucher.trim().toUpperCase(),
      receiver: draft.receiver || currentCustomer.name || 'Khách hàng',
      unit: item.unit || 'PRS',
      sizeQuantities: cleanedSizes,
      totalQty: total,
      note: draft.note || `Xuất giao đợt ${draft.deliveryVoucher}`,
      createdAt: new Date().toISOString(),
    };

    addFinishedGoodsDelivery(finalDelivery);
    setDraftDeliveries((prev) => ({ ...prev, [item.key]: null }));
    toast(`🔒 Đã lưu & khóa đợt xuất ${finalDelivery.deliveryVoucher} (${total.toLocaleString('vi-VN')} đôi)!`);
  };

  // Mở khóa sửa một đợt xuất đã lưu (In-place edit)
  const handleStartEditDelivery = (delivery: FinishedGoodsDeliveryRow) => {
    setEditingDeliveries((prev) => ({
      ...prev,
      [delivery.id]: {
        ...delivery,
        sizeQuantities: { ...delivery.sizeQuantities },
      },
    }));
  };

  // Cập nhật giá trị ô khi đang sửa đợt xuất đã lưu
  const handleUpdateEditingField = (deliveryId: string, field: keyof FinishedGoodsDeliveryRow, value: any) => {
    setEditingDeliveries((prev) => {
      const current = prev[deliveryId];
      if (!current) return prev;
      return {
        ...prev,
        [deliveryId]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const handleUpdateEditingSize = (deliveryId: string, size: string, val: string) => {
    setEditingDeliveries((prev) => {
      const current = prev[deliveryId];
      if (!current) return prev;
      const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0);
      const nextSq = { ...current.sizeQuantities, [size]: num };
      const total = Object.values(nextSq).reduce((sum, v) => sum + (Number(v) || 0), 0);
      return {
        ...prev,
        [deliveryId]: {
          ...current,
          sizeQuantities: nextSq,
          totalQty: total,
        },
      };
    });
  };

  // Hủy sửa đợt xuất
  const handleCancelEditDelivery = (deliveryId: string) => {
    setEditingDeliveries((prev) => {
      const next = { ...prev };
      delete next[deliveryId];
      return next;
    });
  };

  // Lưu lại đợt xuất đang sửa
  const handleSaveEditDelivery = (deliveryId: string, item: FinishedGoodsStockItem) => {
    const editObj = editingDeliveries[deliveryId];
    if (!editObj) return;

    if (!editObj.deliveryVoucher.trim()) {
      alert('Vui lòng nhập Số Hóa Đơn / Phiếu Xuất!', 'Thiếu thông tin', 'warning');
      return;
    }

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = editObj.sizeQuantities[s] || 0;
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    const otherDeliveries = getPoDeliveries(item).filter((d) => d.id !== deliveryId);
    let hasOverStock = false;
    let overStockMsg = '';

    sizes.forEach((s) => {
      const otherDelivered = otherDeliveries.reduce((sum, d) => sum + (d.sizeQuantities[s] || 0), 0);
      const currentInbound = item.inboundSizes[s] || 0;
      const available = currentInbound - otherDelivered;
      const willDeliver = cleanedSizes[s] || 0;

      if (willDeliver > available) {
        hasOverStock = true;
        overStockMsg += `• Size ${s}: Sửa thành ${willDeliver} đôi, nhưng tồn kho chỉ còn ${available} đôi!\n`;
      }
    });

    if (hasOverStock) {
      alert(
        `⚠️ CẢNH BÁO XUẤT VƯỢT TỒN KHO THÀNH PHẨM:\n${overStockMsg}\nVui lòng điều chỉnh lại số lượng xuất.`,
        'Vượt Tồn Kho Thành Phẩm',
        'danger'
      );
      return;
    }

    const updated: FinishedGoodsDeliveryRow = {
      ...editObj,
      deliveryVoucher: editObj.deliveryVoucher.trim().toUpperCase(),
      sizeQuantities: cleanedSizes,
      totalQty: total,
    };

    updateFinishedGoodsDelivery(updated);
    setEditingDeliveries((prev) => {
      const next = { ...prev };
      delete next[deliveryId];
      return next;
    });

    toast(`🔒 Đã cập nhật & khóa đợt xuất ${updated.deliveryVoucher}!`);
  };

  // Xóa 1 đợt xuất
  const handleDeleteDelivery = (delivery: FinishedGoodsDeliveryRow) => {
    confirm(
      `Bạn có chắc chắn muốn xóa đợt xuất ${delivery.deliveryVoucher} (Ngày ${delivery.deliveryDate}, ${delivery.totalQty} đôi)?\nSố lượng xuất sẽ được tự động hoàn trả lại tồn kho thành phẩm!`,
      () => {
        deleteFinishedGoodsDelivery(delivery.id);
        setEditingDeliveries((prev) => {
          const next = { ...prev };
          delete next[delivery.id];
          return next;
        });
        toast(`Đã xóa đợt xuất ${delivery.deliveryVoucher}. Tồn kho thành phẩm đã được hoàn lại!`);
      }
    );
  };

  // Dán từ Excel vào hàng đợt xuất bắt đầu từ size được click
  const handleSizePaste = (
    e: React.ClipboardEvent,
    isDraft: boolean,
    targetKeyOrId: string,
    startSize: string
  ) => {
    const clip = e.clipboardData.getData('text');
    if (!clip || (!clip.includes('\t') && !clip.includes(' '))) return;

    const parts = clip.trim().split(/[\t\s]+/).filter(Boolean);
    if (parts.length > 1) {
      e.preventDefault();
      const startIdx = sizes.indexOf(startSize);

      if (isDraft) {
        setDraftDeliveries((prev) => {
          const current = prev[targetKeyOrId];
          if (!current) return prev;
          const nextSq = { ...current.sizeQuantities };
          parts.forEach((p, offset) => {
            const targetIdx = startIdx + offset;
            if (targetIdx < sizes.length) {
              const s = sizes[targetIdx];
              const num = parseInt(p.replace(/,/g, ''), 10);
              nextSq[s] = isNaN(num) ? 0 : Math.max(0, num);
            }
          });
          const total = Object.values(nextSq).reduce((sum, v) => sum + (Number(v) || 0), 0);
          return {
            ...prev,
            [targetKeyOrId]: {
              ...current,
              sizeQuantities: nextSq,
              totalQty: total,
            },
          };
        });
      } else {
        setEditingDeliveries((prev) => {
          const current = prev[targetKeyOrId];
          if (!current) return prev;
          const nextSq = { ...current.sizeQuantities };
          parts.forEach((p, offset) => {
            const targetIdx = startIdx + offset;
            if (targetIdx < sizes.length) {
              const s = sizes[targetIdx];
              const num = parseInt(p.replace(/,/g, ''), 10);
              nextSq[s] = isNaN(num) ? 0 : Math.max(0, num);
            }
          });
          const total = Object.values(nextSq).reduce((sum, v) => sum + (Number(v) || 0), 0);
          return {
            ...prev,
            [targetKeyOrId]: {
              ...current,
              sizeQuantities: nextSq,
              totalQty: total,
            },
          };
        });
      }

      toast(`📋 Đã dán ${parts.length} số lượng xuất bắt đầu từ Size ${startSize}!`);
    }
  };

  // In riêng 1 phiếu xuất kho / hóa đơn
  const handlePrintDelivery = (delivery: FinishedGoodsDeliveryRow) => {
    setSelectedForPrint(delivery);
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

  // Xuất Excel Tồn Kho & Lịch Sử Xuất Thành Phẩm
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
      'Chỉ Số Thành Phẩm',
      'Ngày Xuất',
      'Số HĐ / Phiếu Xuất',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL',
      'Trạng Thái',
    ];

    const dataRows: any[] = [];
    filteredStock.forEach((item, idx) => {
      const poDeliveries = getPoDeliveries(item);
      const totalDeliveredForSize: Record<string, number> = {};
      sizes.forEach((s) => {
        totalDeliveredForSize[s] = poDeliveries.reduce((sum, d) => sum + (d.sizeQuantities[s] || 0), 0);
      });
      const grandTotalDelivered = Object.values(totalDeliveredForSize).reduce((a, b) => a + b, 0);
      const grandTotalStock = item.totalInbound - grandTotalDelivered;

      // 1. Dòng Nhập kho
      dataRows.push([
        idx + 1,
        item.poNumber,
        item.itemCode,
        item.unit,
        '1. Nhập kho TP (từ Chuyền 1,2,3)',
        '-',
        'Nhập từ Tab 7',
        ...sizes.map((s) => item.inboundSizes[s] || 0),
        item.totalInbound,
        'Sản xuất xong',
      ]);

      // 2. Các dòng đợt xuất
      poDeliveries.forEach((del, dIdx) => {
        dataRows.push([
          '',
          '',
          '',
          '',
          `2.${dIdx + 1}. Xuất đợt ${dIdx + 1}`,
          del.deliveryDate,
          del.deliveryVoucher,
          ...sizes.map((s) => del.sizeQuantities[s] || 0),
          del.totalQty,
          'Đã xuất giao KH',
        ]);
      });

      // Dòng tổng đã xuất nếu có từ 2 đợt trở lên
      if (poDeliveries.length >= 2) {
        dataRows.push([
          '',
          '',
          '',
          '',
          'Tổng cộng các đợt đã xuất',
          '-',
          `${poDeliveries.length} đợt`,
          ...sizes.map((s) => totalDeliveredForSize[s] || 0),
          grandTotalDelivered,
          '-',
        ]);
      }

      // 3. Dòng Tồn kho hiện tại
      dataRows.push([
        '',
        '',
        '',
        '',
        '3. TỒN KHO THÀNH PHẨM HIỆN TẠI',
        '-',
        '-',
        ...sizes.map((s) => (item.inboundSizes[s] || 0) - (totalDeliveredForSize[s] || 0)),
        grandTotalStock,
        grandTotalStock > 0 ? 'Khả dụng' : grandTotalStock === 0 ? 'Hết tồn' : 'Xuất vượt',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TonKhoThanhPham');
    XLSX.writeFile(wb, `Tab8_TonKho_XuatThanhPham_${currentCustomer?.name || 'KhachHang'}.xlsx`);
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
        description: `Hóa đơn / Phiếu xuất giao thành phẩm cho ${selectedForPrint.receiver} (${selectedForPrint.note || 'Theo đơn đặt hàng'})`,
        unit: selectedForPrint.unit,
        sizeQuantities: selectedForPrint.sizeQuantities,
        totalQty: selectedForPrint.totalQty,
        note: selectedForPrint.note || 'Hàng đạt chuẩn chất lượng xuất xưởng',
      },
    ];
  }, [selectedForPrint]);

  // Dữ liệu in báo cáo tồn kho thành phẩm tổng hợp
  const printStockRows: PrintTableRow[] = useMemo(() => {
    return filteredStock.map((item, idx) => {
      const poDeliveries = getPoDeliveries(item);
      const stockSizes: Record<string, number> = {};
      let totalStock = 0;

      sizes.forEach((s) => {
        const inQ = item.inboundSizes[s] || 0;
        const outQ = poDeliveries.reduce((sum, d) => sum + (d.sizeQuantities[s] || 0), 0);
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
  }, [filteredStock, defaultDate, sizes, currentCustomerFinishedGoodsDeliveries]);

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
              | Hỗ trợ xuất hóa đơn nhiều đợt, nhiều ngày • Nhập số lượng và Enter lưu khóa dòng tại chỗ
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

        {/* BẢNG TỒN KHO & ĐA ĐỢT XUẤT THÀNH PHẨM (PHƯƠNG ÁN 1) */}
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (Style)</th>
                <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                <th className="p-2 border-r border-slate-300 min-w-[175px]">Chỉ Số Thành Phẩm</th>
                <th className="p-2 border-r border-slate-300 min-w-[95px] text-center">Ngày Xuất</th>
                <th className="p-2 border-r border-slate-300 min-w-[130px]">Số HĐ / Phiếu Xuất</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[80px] text-right bg-emerald-100 text-emerald-950 font-bold">
                  TỔNG SL
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[100px] text-center">Trạng Thái</th>
                <th className="p-2 text-center w-28">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredStock.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                    Chưa có dữ liệu thành phẩm nào được ghi nhận hoàn thành từ Tab 7 (Báo Cáo Sản Xuất Xong).
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, idx) => {
                  const poDeliveries = getPoDeliveries(item);
                  const draftDelivery = getDraftForPo(item);
                  const hasMultipleDeliveries = poDeliveries.length >= 2;

                  // Tính tổng đã xuất theo từng size của PO này (cộng các đợt đã lưu)
                  const totalDeliveredForSize: Record<string, number> = {};
                  sizes.forEach((s) => {
                    totalDeliveredForSize[s] = poDeliveries.reduce((sum, d) => sum + (d.sizeQuantities[s] || 0), 0);
                  });
                  const grandTotalDelivered = Object.values(totalDeliveredForSize).reduce((a, b) => a + b, 0);

                  // Tồn kho thực tế = Nhập kho - Tổng đã xuất
                  const grandTotalStock = item.totalInbound - grandTotalDelivered;

                  // Tính tổng số dòng hiển thị của PO này để đặt rowSpan cho các cột cố định
                  const totalPoRows =
                    1 + // Dòng 1: Nhập kho
                    poDeliveries.length + // Các dòng đợt xuất đã lưu
                    (draftDelivery ? 1 : 0) + // Dòng đợt xuất mới đang soạn (nếu có)
                    (hasMultipleDeliveries ? 1 : 0) + // Dòng tổng cộng đợt xuất (nếu >= 2 đợt)
                    1; // Dòng 3: Tồn kho hiện tại

                  const rowStt = idx + 1;

                  return (
                    <React.Fragment key={item.key}>
                      {/* DÒNG 1: NHẬP KHO TP (Tự động từ Tab 7) */}
                      <tr className="bg-slate-50/70 hover:bg-slate-100/80 transition-colors border-t-2 border-slate-300">
                        {/* Cột STT */}
                        <td
                          rowSpan={totalPoRows}
                          className="p-2 border-r border-slate-300 text-center text-slate-500 font-mono font-bold bg-white text-xs align-middle"
                        >
                          {rowStt}
                        </td>
                        {/* Cột Mã PO */}
                        <td
                          rowSpan={totalPoRows}
                          className="p-2 border-r border-slate-300 font-mono font-bold text-sky-700 bg-white align-middle whitespace-nowrap"
                        >
                          {item.poNumber}
                        </td>
                        {/* Cột Mã Hàng */}
                        <td
                          rowSpan={totalPoRows}
                          className="p-2 border-r border-slate-300 font-mono font-bold text-slate-900 bg-white align-middle"
                        >
                          {item.itemCode}
                        </td>
                        {/* Cột ĐVT */}
                        <td
                          rowSpan={totalPoRows}
                          className="p-2 border-r border-slate-300 text-center text-slate-600 bg-white align-middle"
                        >
                          {item.unit}
                        </td>

                        {/* Chỉ số: 1. Nhập kho TP */}
                        <td className="p-2 border-r border-slate-200 font-medium text-slate-700 flex items-center gap-1.5 whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                          <span>1. Nhập kho TP (từ Chuyền 1,2,3)</span>
                        </td>

                        {/* Ngày xuất */}
                        <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-400">
                          -
                        </td>

                        {/* Số HĐ / Phiếu */}
                        <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-slate-500 italic">
                          Nhập từ Tab 7
                        </td>

                        {/* Size columns */}
                        {sizes.map((s) => (
                          <td key={s} className="p-2 border-r border-slate-200 text-center font-mono text-slate-700">
                            {item.inboundSizes[s] > 0 ? item.inboundSizes[s].toLocaleString('vi-VN') : '-'}
                          </td>
                        ))}

                        {/* Tổng nhập */}
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-sky-700 bg-sky-50/50">
                          {item.totalInbound.toLocaleString('vi-VN')}
                        </td>

                        {/* Trạng thái */}
                        <td className="p-2 border-r border-slate-200 text-center text-[10px] font-semibold text-slate-500">
                          Sản xuất xong
                        </td>

                        {/* Thao tác dòng 1: Giữ trống hoặc thêm nút nếu cần */}
                        <td className="p-2 text-center text-slate-400">
                          -
                        </td>
                      </tr>

                      {/* NHÓM DÒNG 2: CÁC ĐỢT XUẤT ĐÃ LƯU (Đa đợt, đa ngày) */}
                      {poDeliveries.map((del, dIdx) => {
                        const isEditingThisDel = Boolean(editingDeliveries[del.id]);
                        const activeDel = editingDeliveries[del.id] || del;

                        return (
                          <tr
                            key={del.id}
                            className={`transition-colors ${
                              isEditingThisDel ? 'bg-[#fefce8]' : 'bg-[#fffbeb] hover:bg-[#fef3c7]'
                            } border-y border-amber-200/80`}
                          >
                            {/* Chỉ số */}
                            <td className="p-2 border-r border-slate-200 font-bold text-amber-900 flex items-center gap-1.5 whitespace-nowrap">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              <span>2.{dIdx + 1}. Xuất đợt {dIdx + 1}</span>
                            </td>

                            {/* Ngày xuất */}
                            <td className="p-0 border-r border-slate-200 text-center font-mono">
                              {isEditingThisDel ? (
                                <input
                                  type="text"
                                  value={activeDel.deliveryDate}
                                  onChange={(e) => handleUpdateEditingField(del.id, 'deliveryDate', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditDelivery(del.id, item);
                                  }}
                                  placeholder="DD/MM/YYYY"
                                  className="w-full h-8 px-1 text-center font-mono text-xs bg-white border-0 focus:ring-1 focus:ring-amber-500"
                                />
                              ) : (
                                <div className="p-2 text-slate-700 whitespace-nowrap">{del.deliveryDate}</div>
                              )}
                            </td>

                            {/* Số Hóa Đơn / Phiếu */}
                            <td className="p-0 border-r border-slate-200">
                              {isEditingThisDel ? (
                                <input
                                  type="text"
                                  value={activeDel.deliveryVoucher}
                                  onChange={(e) => handleUpdateEditingField(del.id, 'deliveryVoucher', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEditDelivery(del.id, item);
                                  }}
                                  placeholder="HĐ-..."
                                  className="w-full h-8 px-2 font-mono font-bold text-xs uppercase bg-white border-0 focus:ring-1 focus:ring-amber-500 text-amber-900"
                                />
                              ) : (
                                <div className="p-2 font-mono font-bold text-amber-900 truncate max-w-[130px]" title={del.deliveryVoucher}>
                                  {del.deliveryVoucher}
                                </div>
                              )}
                            </td>

                            {/* Size columns */}
                            {sizes.map((s) => {
                              const val = activeDel.sizeQuantities[s] || 0;
                              return (
                                <td key={s} className="p-0 border-r border-slate-200 text-center">
                                  {isEditingThisDel ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={val > 0 ? val : ''}
                                      onChange={(e) => handleUpdateEditingSize(del.id, s, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveEditDelivery(del.id, item);
                                      }}
                                      onPaste={(e) => handleSizePaste(e, false, del.id, s)}
                                      placeholder="-"
                                      className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-amber-950 border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  ) : (
                                    <div
                                      className={`p-2 font-mono font-bold text-center ${
                                        val > 0 ? 'text-amber-900 bg-amber-100/50' : 'text-slate-300'
                                      }`}
                                    >
                                      {val > 0 ? val.toLocaleString('vi-VN') : '-'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            {/* Tổng SL đợt này */}
                            <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-amber-950 bg-amber-100/70">
                              {activeDel.totalQty.toLocaleString('vi-VN')}
                            </td>

                            {/* Trạng thái */}
                            <td className="p-2 border-r border-slate-200 text-center">
                              {isEditingThisDel ? (
                                <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded border border-sky-300">
                                  Đang sửa...
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                  Đã khóa
                                </span>
                              )}
                            </td>

                            {/* Nút Thao tác cho đợt xuất này */}
                            <td className="p-1.5 text-center whitespace-nowrap">
                              {isEditingThisDel ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditDelivery(del.id, item)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-0.5"
                                    title="Lưu đợt xuất này và khóa dòng (Enter)"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>Lưu</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelEditDelivery(del.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                                    title="Hủy bỏ thay đổi"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  {/* Sửa đợt này */}
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditDelivery(del)}
                                    className="p-1 text-slate-500 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                                    title={`Mở khóa sửa trực tiếp đợt ${del.deliveryVoucher}`}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>

                                  {/* In phiếu cho đợt này */}
                                  <button
                                    type="button"
                                    onClick={() => handlePrintDelivery(del)}
                                    className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                                    title={`In phiếu xuất kho / hóa đơn đợt ${del.deliveryVoucher}`}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Xóa đợt này */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDelivery(del)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                                    title={`Xóa đợt ${del.deliveryVoucher} (Hoàn lại tồn kho)`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* DÒNG SOẠN ĐỢT XUẤT MỚI (DRAFT DELIVERY, NẾU CÓ) */}
                      {draftDelivery && (
                        <tr className="bg-[#f0fdf4] hover:bg-[#dcfce7]/70 transition-colors border-y-2 border-emerald-400">
                          {/* Phân loại đợt mới */}
                          <td className="p-2 border-r border-slate-200 font-bold text-emerald-800 flex items-center gap-1.5 whitespace-nowrap">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>2.{poDeliveries.length + 1}. Xuất đợt mới</span>
                          </td>

                          {/* Ngày xuất */}
                          <td className="p-0 border-r border-slate-200 text-center font-mono">
                            <input
                              type="text"
                              value={draftDelivery.deliveryDate}
                              onChange={(e) => handleUpdateDraftField(item.key, 'deliveryDate', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDraftDelivery(item);
                              }}
                              placeholder="DD/MM/YYYY"
                              className="w-full h-8 px-1 text-center font-mono text-xs bg-transparent border-0 focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Số HĐ / Phiếu */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={draftDelivery.deliveryVoucher}
                              onChange={(e) => handleUpdateDraftField(item.key, 'deliveryVoucher', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDraftDelivery(item);
                              }}
                              placeholder="Số HĐ / Phiếu..."
                              className="w-full h-8 px-2 font-mono font-bold text-xs uppercase bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 text-emerald-950"
                            />
                          </td>

                          {/* Size columns */}
                          {sizes.map((s) => {
                            const val = draftDelivery.sizeQuantities[s] || 0;
                            return (
                              <td key={s} className="p-0 border-r border-slate-200 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={val > 0 ? val : ''}
                                  onChange={(e) => handleUpdateDraftSize(item.key, s, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveDraftDelivery(item);
                                  }}
                                  onPaste={(e) => handleSizePaste(e, true, item.key, s)}
                                  placeholder="-"
                                  className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-emerald-950 border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </td>
                            );
                          })}

                          {/* Tổng xuất đợt mới */}
                          <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-950 bg-emerald-100">
                            {draftDelivery.totalQty.toLocaleString('vi-VN')}
                          </td>

                          {/* Trạng thái */}
                          <td className="p-2 border-r border-slate-200 text-center">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                              Đang soạn...
                            </span>
                          </td>

                          {/* Thao tác lưu đợt mới */}
                          <td className="p-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSaveDraftDelivery(item)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-0.5"
                                title="Lưu đợt xuất này và khóa dòng (Enter)"
                              >
                                <Save className="w-3 h-3" />
                                <span>Lưu</span>
                              </button>
                              {poDeliveries.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelDraft(item.key)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                                  title="Đóng dòng soạn đợt mới"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* DÒNG TỔNG CỘNG CÁC ĐỢT ĐÃ XUẤT (HIỂN THỊ NẾU CÓ >= 2 ĐỢT) */}
                      {hasMultipleDeliveries && (
                        <tr className="bg-amber-100/50 font-bold border-y border-amber-300/80 text-amber-950">
                          <td className="p-2 border-r border-slate-200 text-amber-900 flex items-center gap-1.5 text-[11px] tracking-wide uppercase">
                            <span>🔹 Tổng cộng đã xuất</span>
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-500">
                            -
                          </td>
                          <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-amber-900">
                            {poDeliveries.length} đợt đã xuất
                          </td>

                          {sizes.map((s) => (
                            <td key={s} className="p-2 border-r border-slate-200 text-center font-mono text-amber-950">
                              {totalDeliveredForSize[s] > 0 ? totalDeliveredForSize[s].toLocaleString('vi-VN') : '-'}
                            </td>
                          ))}

                          <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-amber-950 bg-amber-200/70">
                            {grandTotalDelivered.toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center text-[10px] text-amber-800">
                            Đã giao
                          </td>
                          <td className="p-2 text-center text-slate-400">
                            -
                          </td>
                        </tr>
                      )}

                      {/* DÒNG 3: TỒN KHO THÀNH PHẨM HIỆN TẠI (Tự động trừ lùi = Nhập kho - Tổng tất cả các đợt xuất) */}
                      <tr className="bg-[#f8fafc] font-bold border-b-2 border-slate-300">
                        <td className="p-2 border-r border-slate-200 text-slate-900 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              grandTotalStock > 0
                                ? 'bg-emerald-600'
                                : grandTotalStock === 0
                                ? 'bg-slate-400'
                                : 'bg-rose-600'
                            }`}
                          ></span>
                          <span>3. TỒN KHO TP HIỆN TẠI</span>
                        </td>

                        <td className="p-2 border-r border-slate-200 text-center font-mono text-slate-400">
                          -
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono text-slate-400">
                          -
                        </td>

                        {sizes.map((s) => {
                          const inQ = item.inboundSizes[s] || 0;
                          const outQ = totalDeliveredForSize[s] || 0;
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

                        {/* Tổng tồn kho */}
                        <td
                          className={`p-2 border-r border-slate-200 text-right font-mono font-bold text-xs ${
                            grandTotalStock > 0
                              ? 'text-emerald-950 bg-emerald-100'
                              : grandTotalStock === 0
                              ? 'text-slate-700 bg-slate-100'
                              : 'text-rose-950 bg-rose-100'
                          }`}
                        >
                          {grandTotalStock.toLocaleString('vi-VN')}
                        </td>

                        {/* Trạng thái tồn */}
                        <td className="p-2 border-r border-slate-200 text-center">
                          {grandTotalStock > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Khả dụng
                            </span>
                          ) : grandTotalStock < 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Xuất vượt
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                              Hết tồn
                            </span>
                          )}
                        </td>

                        {/* Thao tác dòng tồn: Nút "+ Thêm Đợt Xuất" */}
                        <td className="p-1.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAddDelivery(item)}
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[11px] font-bold shadow-2xs transition cursor-pointer w-full"
                            title="Thêm một đợt xuất / hóa đơn mới cho PO này"
                          >
                            <Plus className="w-3 h-3 text-amber-700" />
                            <span>+ Đợt Xuất</span>
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}

              {/* DÒNG TỔNG CỘNG TOÀN BẢNG TAB 8 */}
              {filteredStock.length > 0 && (
                <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-400">
                  <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    TỔNG CỘNG TỒN KHO THÀNH PHẨM TOÀN BỘ:
                  </td>
                  {sizes.map((s) => {
                    const sStock = filteredStock.reduce((sum, item) => {
                      const inQ = item.inboundSizes[s] || 0;
                      const outQ = getPoDeliveries(item).reduce((dSum, d) => dSum + (d.sizeQuantities[s] || 0), 0);
                      return sum + (inQ - outQ);
                    }, 0);
                    return (
                      <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-950">
                        {sStock}
                      </td>
                    );
                  })}
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-200">
                    {filteredStock
                      .reduce((sum, item) => {
                        const totalOut = getPoDeliveries(item).reduce((dSum, d) => dSum + d.totalQty, 0);
                        return sum + (item.totalInbound - totalOut);
                      }, 0)
                      .toLocaleString('vi-VN')}
                  </td>
                  <td colSpan={2} className="p-2 text-slate-600 text-[11px] italic">
                    Tổng {filteredStock.length} PO thành phẩm
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Note */}
        <div className="p-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="text-[11px] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>
              💡 <strong>Quy tắc thao tác:</strong> Mỗi PO có thể xuất làm nhiều đợt. Nhập ngày xuất, số HĐ và số lượng rồi nhấn <strong>Enter</strong> để lưu &amp; khóa dòng tại chỗ. Bấm <strong>+ Đợt Xuất</strong> để thêm đợt mới; bấm <strong>Sửa ✏️</strong> để mở khóa sửa hoặc <strong>In 🖨️</strong> để in riêng phiếu xuất/hóa đơn cho từng đợt!
            </span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong>{filteredStock.length}</strong> PO thành phẩm
          </div>
        </div>
      </div>

      {/* MODAL IN PHIẾU XUẤT KHO / HÓA ĐƠN THÀNH PHẨM (TỪNG ĐỢT) */}
      <PrintHtmlModal
        isOpen={Boolean(selectedForPrint)}
        onClose={() => setSelectedForPrint(null)}
        documentTitle={`HÓA ĐƠN / PHIẾU XUẤT THÀNH PHẨM - ${selectedForPrint?.deliveryVoucher || ''}`}
        documentNumber={selectedForPrint?.deliveryVoucher || 'XKTP-01'}
        dateStr={selectedForPrint?.deliveryDate || defaultDate}
        customerName={selectedForPrint?.receiver || currentCustomer?.name || 'Khách hàng'}
        poNumber={selectedForPrint?.poNumber}
        sizes={sizes}
        rows={printDeliveryRows}
      />

      {/* MODAL IN BÁO CÁO TỒN KHO THÀNH PHẨM TỔNG HỢP */}
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
