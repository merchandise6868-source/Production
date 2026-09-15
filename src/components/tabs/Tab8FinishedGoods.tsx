import React, { useState, useMemo, useRef } from 'react';
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
import { SearchablePoSelect } from '../common/SearchablePoSelect';
import { handleCellArrowNavigation } from '../../utils/tableNavigation';

export const Tab8FinishedGoods: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerPlanOrders,
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

  const gridContainerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForPrint, setSelectedForPrint] = useState<FinishedGoodsDeliveryRow | null>(null);
  const [showStockPrintModal, setShowStockPrintModal] = useState(false);

  // Map các đợt xuất đang mở khóa sửa (In-place editing): delivery.id -> FinishedGoodsDeliveryRow
  const [editingDeliveries, setEditingDeliveries] = useState<Record<string, FinishedGoodsDeliveryRow>>({});

  // Map các dòng soạn đợt xuất mới theo từng PO (item.key = poNumber__itemCode)
  const [draftDeliveries, setDraftDeliveries] = useState<Record<string, FinishedGoodsDeliveryRow | null>>({});

  // Dòng soạn đợt xuất mới ở thanh công cụ (cho bất kỳ PO nào)
  const [showGlobalNewBatch, setShowGlobalNewBatch] = useState(false);
  const [globalNewBatch, setGlobalNewBatch] = useState<{
    poNumber: string;
    itemCode: string;
    itemType: 'Bán TP' | 'Thành Phẩm';
    materialName: string;
    deliveryDate: string;
    deliveryVoucher: string;
    receiver: string;
    unit: string;
    sizeQuantities: Record<string, number | ''>;
    note: string;
  }>({
    poNumber: '',
    itemCode: '',
    itemType: 'Thành Phẩm',
    materialName: '',
    deliveryDate: defaultDate,
    deliveryVoucher: '',
    receiver: '',
    unit: 'PRS',
    sizeQuantities: {},
    note: '',
  });

  // Helper lấy danh sách tên vật tư có trong PO đó
  const getPoMaterials = (poNumber: string) => {
    const matching = currentCustomerPlanOrders.filter(
      (p) => p.poNumber.toUpperCase() === poNumber.toUpperCase()
    );
    const materials = matching.map((p) => p.description || p.itemCode).filter(Boolean);
    return Array.from(new Set(materials));
  };

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

    const poMats = getPoMaterials(item.poNumber);

    return {
      id: `draft-del-${Date.now()}-${item.key}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer?.id || '',
      deliveryDate: defaultDate,
      poNumber: item.poNumber,
      itemCode: item.itemCode,
      itemType: item.itemType || 'Thành Phẩm',
      materialName: item.materialName || (poMats.length > 0 ? poMats[0] : ''),
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
      let current = prev[itemKey];
      if (!current) {
        const item = currentCustomerFinishedGoodsStock.find((i) => i.key === itemKey);
        if (item) {
          current = createBlankDelivery(item, getPoDeliveries(item).length + 1);
        }
      }
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
      let current = prev[itemKey];
      if (!current) {
        const item = currentCustomerFinishedGoodsStock.find((i) => i.key === itemKey);
        if (item) {
          current = createBlankDelivery(item, getPoDeliveries(item).length + 1);
        }
      }
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

  // Mở form đợt mới toàn cục (ở thanh công cụ)
  const handleOpenGlobalNewBatch = () => {
    const firstPo = currentCustomerPlanOrders[0]?.poNumber || currentCustomerPOs[0]?.poNumber || '';
    const matchingPlan = currentCustomerPlanOrders.find((p) => p.poNumber === firstPo);
    const mats = firstPo ? getPoMaterials(firstPo) : [];
    const sq: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      sq[s] = '';
    });

    setGlobalNewBatch({
      poNumber: firstPo,
      itemCode: matchingPlan?.itemCode || '',
      itemType: 'Thành Phẩm',
      materialName: mats[0] || matchingPlan?.description || '',
      deliveryDate: defaultDate,
      deliveryVoucher: firstPo ? `HD-${firstPo}-01` : 'HD-01',
      receiver: currentCustomer?.name || 'Khách hàng',
      unit: matchingPlan?.unit || 'PRS',
      sizeQuantities: sq,
      note: 'Xuất đợt mới',
    });
    setShowGlobalNewBatch(true);
  };

  const handleGlobalPoChange = (po: string) => {
    const matchingPlan = currentCustomerPlanOrders.find((p) => p.poNumber.toUpperCase() === po.toUpperCase());
    const mats = getPoMaterials(po);
    setGlobalNewBatch((prev) => ({
      ...prev,
      poNumber: po,
      itemCode: matchingPlan?.itemCode || prev.itemCode,
      unit: matchingPlan?.unit || prev.unit,
      materialName: mats[0] || matchingPlan?.description || '',
      deliveryVoucher: po ? `HD-${po}-01` : prev.deliveryVoucher,
    }));
  };

  const handleSaveGlobalNewBatch = () => {
    if (!currentCustomer) return;
    if (!globalNewBatch.poNumber.trim()) {
      alert('Vui lòng chọn Mã PO!', 'Thiếu thông tin', 'warning');
      return;
    }
    if (!globalNewBatch.deliveryVoucher.trim()) {
      alert('Vui lòng nhập Số Hóa Đơn / Phiếu Xuất!', 'Thiếu thông tin', 'warning');
      return;
    }

    const cleanedSizes: Record<string, number> = {};
    let total = 0;
    sizes.forEach((s) => {
      const v = typeof globalNewBatch.sizeQuantities[s] === 'number' ? Number(globalNewBatch.sizeQuantities[s]) : 0;
      if (v > 0) {
        cleanedSizes[s] = v;
        total += v;
      }
    });

    if (total <= 0) {
      alert('Vui lòng nhập số lượng xuất cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    const finalDelivery: FinishedGoodsDeliveryRow = {
      id: `fg-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer.id,
      deliveryDate: globalNewBatch.deliveryDate.trim() || defaultDate,
      poNumber: globalNewBatch.poNumber.trim().toUpperCase(),
      itemCode: globalNewBatch.itemCode.trim().toUpperCase() || 'TP',
      itemType: globalNewBatch.itemType || 'Thành Phẩm',
      materialName: globalNewBatch.materialName || undefined,
      deliveryVoucher: globalNewBatch.deliveryVoucher.trim().toUpperCase(),
      receiver: globalNewBatch.receiver || currentCustomer.name || 'Khách hàng',
      unit: globalNewBatch.unit || 'PRS',
      sizeQuantities: cleanedSizes,
      totalQty: total,
      note: globalNewBatch.note || `Xuất giao đợt ${globalNewBatch.deliveryVoucher}`,
      createdAt: new Date().toISOString(),
    };

    addFinishedGoodsDelivery(finalDelivery);
    setShowGlobalNewBatch(false);
    toast(`🔒 Đã lưu đợt xuất mới ${finalDelivery.deliveryVoucher} cho PO ${finalDelivery.poNumber} (${total.toLocaleString('vi-VN')} đôi)!`);
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

    const finalDelivery: FinishedGoodsDeliveryRow = {
      id: `fg-del-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerId: currentCustomer.id,
      deliveryDate: draft.deliveryDate.trim() || defaultDate,
      poNumber: item.poNumber,
      itemCode: item.itemCode,
      itemType: draft.itemType || 'Thành Phẩm',
      materialName: draft.materialName || undefined,
      deliveryVoucher: draft.deliveryVoucher.trim().toUpperCase(),
      receiver: draft.receiver || currentCustomer.name || 'Khách hàng',
      unit: item.unit || 'PRS',
      sizeQuantities: cleanedSizes,
      totalQty: total,
      note: draft.note || `Xuất giao đợt ${draft.deliveryVoucher}`,
      createdAt: new Date().toISOString(),
    };

    if (hasOverStock) {
      confirm(
        `⚠️ CẢNH BÁO XUẤT VƯỢT TỒN KHO THÀNH PHẨM:\n${overStockMsg}\nBạn có muốn tiếp tục lưu đợt xuất này không?`,
        () => {
          addFinishedGoodsDelivery(finalDelivery);
          setDraftDeliveries((prev) => ({ ...prev, [item.key]: null }));
          toast(`🔒 Đã lưu & khóa đợt xuất ${finalDelivery.deliveryVoucher} (${total.toLocaleString('vi-VN')} đôi)!`);
        }
      );
      return;
    }

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
      let current = prev[deliveryId];
      if (!current) {
        const found = currentCustomerFinishedGoodsDeliveries.find((d) => d.id === deliveryId);
        if (found) current = { ...found, sizeQuantities: { ...found.sizeQuantities } };
      }
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
      let current = prev[deliveryId];
      if (!current) {
        const found = currentCustomerFinishedGoodsDeliveries.find((d) => d.id === deliveryId);
        if (found) current = { ...found, sizeQuantities: { ...found.sizeQuantities } };
      }
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

    const updated: FinishedGoodsDeliveryRow = {
      ...editObj,
      itemType: editObj.itemType || 'Thành Phẩm',
      materialName: editObj.materialName || undefined,
      deliveryVoucher: editObj.deliveryVoucher.trim().toUpperCase(),
      sizeQuantities: cleanedSizes,
      totalQty: total,
    };

    if (hasOverStock) {
      confirm(
        `⚠️ CẢNH BÁO XUẤT VƯỢT TỒN KHO THÀNH PHẨM:\n${overStockMsg}\nBạn có muốn tiếp tục cập nhật đợt xuất này không?`,
        () => {
          updateFinishedGoodsDelivery(updated);
          setEditingDeliveries((prev) => {
            const next = { ...prev };
            delete next[deliveryId];
            return next;
          });
          toast(`🔒 Đã cập nhật & khóa đợt xuất ${updated.deliveryVoucher}!`);
        }
      );
      return;
    }

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
      'Code Vật tư',
      'Loại',
      'Tên Vật tư',
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
        'Thành Phẩm',
        item.materialName || '-',
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
          del.itemType || 'Thành Phẩm',
          del.materialName || '-',
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
          '-',
          '-',
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
        '-',
        '-',
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
        description: `Hóa đơn / Phiếu xuất giao [${selectedForPrint.itemType || 'Thành Phẩm'}] ${selectedForPrint.materialName ? `- VT: ${selectedForPrint.materialName} ` : ''}cho ${selectedForPrint.receiver} (${selectedForPrint.note || 'Theo đơn đặt hàng'})`,
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
                placeholder="Tìm PO, Code Vật tư..."
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

            {/* Nút thêm đợt xuất mới cho bất kỳ PO nào */}
            <button
              type="button"
              onClick={handleOpenGlobalNewBatch}
              className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Đợt Mới (PO Mới)</span>
            </button>
          </div>
        </div>

        {/* KHUNG SOẠN ĐỢT XUẤT MỚI (GLOBAL DRAFT ROW DÀNH CHO BẤT KỲ PO NÀO) */}
        {showGlobalNewBatch && (
          <div className="p-3 bg-amber-50/70 border-b border-amber-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-amber-700" />
                <span>SOẠN ĐỢT XUẤT THÀNH PHẨM MỚI (TÙY CHỌN PO &amp; VẬT TƯ)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveGlobalNewBatch}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs transition flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Lưu Đợt Xuất</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGlobalNewBatch(false)}
                  className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">MÃ PO *</label>
                <SearchablePoSelect
                  value={globalNewBatch.poNumber}
                  pos={currentCustomerPOs}
                  onChange={handleGlobalPoChange}
                  onSelectPo={(po) => {
                    handleGlobalPoChange(po.poNumber);
                  }}
                  placeholder="Chọn PO..."
                  className="w-full text-xs font-mono font-bold uppercase text-sky-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">CODE VẬT TƯ</label>
                <input
                  type="text"
                  value={globalNewBatch.itemCode}
                  onChange={(e) => setGlobalNewBatch((p) => ({ ...p, itemCode: e.target.value }))}
                  placeholder="Code Vật tư"
                  className="w-full h-8 px-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">LOẠI *</label>
                <select
                  value={globalNewBatch.itemType}
                  onChange={(e) => setGlobalNewBatch((p) => ({ ...p, itemType: e.target.value as any }))}
                  className="w-full h-8 px-2 text-xs font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 cursor-pointer text-amber-900"
                >
                  <option value="Thành Phẩm">Thành Phẩm</option>
                  <option value="Bán TP">Bán TP</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">TÊN VẬT TƯ</label>
                <select
                  value={globalNewBatch.materialName}
                  onChange={(e) => setGlobalNewBatch((p) => ({ ...p, materialName: e.target.value }))}
                  className="w-full h-8 px-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">-- Chọn vật tư --</option>
                  {getPoMaterials(globalNewBatch.poNumber).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">NGÀY XUẤT *</label>
                <input
                  type="text"
                  value={globalNewBatch.deliveryDate}
                  onChange={(e) => setGlobalNewBatch((p) => ({ ...p, deliveryDate: e.target.value }))}
                  placeholder="DD/MM/YYYY"
                  className="w-full h-8 px-2 text-xs font-mono bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">SỐ HĐ / PHIẾU *</label>
                <input
                  type="text"
                  value={globalNewBatch.deliveryVoucher}
                  onChange={(e) => setGlobalNewBatch((p) => ({ ...p, deliveryVoucher: e.target.value }))}
                  placeholder="HĐ-..."
                  className="w-full h-8 px-2 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-amber-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">ĐVT</label>
                <input
                  type="text"
                  value={globalNewBatch.unit}
                  onChange={(e) => setGlobalNewBatch((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="PRS"
                  className="w-full h-8 px-2 text-xs text-center bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-1">SỐ LƯỢNG XUẤT THEO DẢI SIZE:</label>
              <div className="flex flex-wrap items-center gap-1.5">
                {sizes.map((s) => (
                  <div key={s} className="w-14">
                    <span className="block text-[10px] font-mono font-bold text-center text-slate-500 mb-0.5">
                      {s}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={globalNewBatch.sizeQuantities[s] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0);
                        setGlobalNewBatch((p) => ({
                          ...p,
                          sizeQuantities: { ...p.sizeQuantities, [s]: val },
                        }));
                      }}
                      placeholder="-"
                      className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 text-amber-950"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BẢNG TỒN KHO & ĐA ĐỢT XUẤT THÀNH PHẨM (PHƯƠNG ÁN 1) */}
        <div ref={gridContainerRef} className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Code Vật tư</th>
                <th className="p-2 border-r border-slate-300 min-w-[100px] bg-amber-50 text-amber-900 font-bold text-center">
                  Loại
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[130px] bg-amber-50 text-amber-900 font-bold">
                  Tên Vật tư
                </th>
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
                  <td colSpan={9 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
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
                        {/* Cột Code Vật tư */}
                        <td
                          rowSpan={totalPoRows}
                          className="p-2 border-r border-slate-300 font-mono font-bold text-slate-900 bg-white align-middle"
                        >
                          {item.itemCode}
                        </td>

                        {/* Cột Loại (Dòng 1: Thành Phẩm) */}
                        <td className="p-2 border-r border-slate-200 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Thành Phẩm
                          </span>
                        </td>

                        {/* Cột Tên Vật tư */}
                        <td
                          className="p-2 border-r border-slate-200 text-slate-700 text-xs truncate max-w-[130px]"
                          title={item.materialName || ''}
                        >
                          {item.materialName || '-'}
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

                        {/* Thao tác dòng 1: Giữ trống */}
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
                            {/* Cột Loại */}
                            <td className="p-1 border-r border-slate-200 text-center">
                              {isEditingThisDel ? (
                                <select
                                  value={activeDel.itemType || 'Thành Phẩm'}
                                  onChange={(e) => handleUpdateEditingField(del.id, 'itemType', e.target.value)}
                                  onKeyDown={(e) => {
                                    handleCellArrowNavigation(e, gridContainerRef);
                                    if (e.key === 'Enter') handleSaveEditDelivery(del.id, item);
                                  }}
                                  className="w-full h-8 px-1 text-xs border border-amber-300 rounded font-bold text-amber-900 bg-white cursor-pointer"
                                >
                                  <option value="Thành Phẩm">Thành Phẩm</option>
                                  <option value="Bán TP">Bán TP</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    del.itemType === 'Bán TP'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}
                                >
                                  {del.itemType || 'Thành Phẩm'}
                                </span>
                              )}
                            </td>

                            {/* Cột Tên Vật tư */}
                            <td className="p-1 border-r border-slate-200 text-slate-800">
                              {isEditingThisDel ? (
                                <select
                                  value={activeDel.materialName || ''}
                                  onChange={(e) => handleUpdateEditingField(del.id, 'materialName', e.target.value)}
                                  onKeyDown={(e) => {
                                    handleCellArrowNavigation(e, gridContainerRef);
                                    if (e.key === 'Enter') handleSaveEditDelivery(del.id, item);
                                  }}
                                  className="w-full h-8 px-1 text-xs border border-amber-300 rounded text-slate-800 bg-white cursor-pointer"
                                >
                                  <option value="">-- Chọn VT --</option>
                                  {getPoMaterials(item.poNumber).map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="p-1 text-slate-700 truncate max-w-[130px]" title={del.materialName || ''}>
                                  {del.materialName || '-'}
                                </div>
                              )}
                            </td>

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
                                    handleCellArrowNavigation(e, gridContainerRef);
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
                                    handleCellArrowNavigation(e, gridContainerRef);
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
                                        handleCellArrowNavigation(e, gridContainerRef);
                                        if (e.key === 'Enter') handleSaveEditDelivery(del.id, item);
                                      }}
                                      onPaste={(e) => handleSizePaste(e, false, del.id, s)}
                                      placeholder="-"
                                      className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-amber-950 border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                    />
                                  ) : (
                                    <div
                                      onClick={() => handleStartEditDelivery(del)}
                                      className={`p-2 font-mono font-bold text-center cursor-pointer hover:ring-1 hover:ring-sky-400 rounded ${
                                        val > 0 ? 'text-amber-900 bg-amber-100/50' : 'text-slate-300'
                                      }`}
                                      title="Bấm để mở khóa sửa đợt xuất này"
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
                          {/* Cột Loại */}
                          <td className="p-1 border-r border-slate-200 text-center">
                            <select
                              value={draftDelivery.itemType || 'Thành Phẩm'}
                              onChange={(e) => handleUpdateDraftField(item.key, 'itemType', e.target.value)}
                              onKeyDown={(e) => {
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveDraftDelivery(item);
                              }}
                              className="w-full h-8 px-1 text-xs border border-emerald-300 rounded font-bold text-emerald-900 bg-white cursor-pointer"
                            >
                              <option value="Thành Phẩm">Thành Phẩm</option>
                              <option value="Bán TP">Bán TP</option>
                            </select>
                          </td>

                          {/* Cột Tên Vật tư */}
                          <td className="p-1 border-r border-slate-200 text-slate-800">
                            <select
                              value={draftDelivery.materialName || ''}
                              onChange={(e) => handleUpdateDraftField(item.key, 'materialName', e.target.value)}
                              onKeyDown={(e) => {
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveDraftDelivery(item);
                              }}
                              className="w-full h-8 px-1 text-xs border border-emerald-300 rounded text-slate-800 bg-white cursor-pointer"
                            >
                              <option value="">-- Chọn VT --</option>
                              {getPoMaterials(item.poNumber).map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </td>

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
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveDraftDelivery(item);
                              }}
                              placeholder="DD/MM/YYYY"
                              className="w-full h-8 px-1 text-center font-mono text-xs bg-white border border-emerald-300 focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Số HĐ / Phiếu */}
                          <td className="p-0 border-r border-slate-200">
                            <input
                              type="text"
                              value={draftDelivery.deliveryVoucher}
                              onChange={(e) => handleUpdateDraftField(item.key, 'deliveryVoucher', e.target.value)}
                              onKeyDown={(e) => {
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveDraftDelivery(item);
                              }}
                              placeholder="Số HĐ / Phiếu..."
                              className="w-full h-8 px-2 font-mono font-bold text-xs uppercase bg-white border border-emerald-300 focus:ring-1 focus:ring-emerald-500 text-emerald-950"
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
                                    handleCellArrowNavigation(e, gridContainerRef);
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
                          <td className="p-2 border-r border-slate-200 text-center text-slate-400">-</td>
                          <td className="p-2 border-r border-slate-200 text-center text-slate-400">-</td>
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
                        <td className="p-2 border-r border-slate-200 text-center text-slate-400">-</td>
                        <td className="p-2 border-r border-slate-200 text-center text-slate-400">-</td>
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
                  <td colSpan={9} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
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
