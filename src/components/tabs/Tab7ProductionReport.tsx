import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ProductionReportRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  Search,
  Trash2,
  Edit,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';
import { SearchablePoSelect } from '../common/SearchablePoSelect';
import { handleCellArrowNavigation } from '../../utils/tableNavigation';

export interface Tab7ReportItem {
  id: string;
  isNew?: boolean;
  isEditing: boolean;
  reportDate: string;
  poNumber: string;
  itemCode: string;
  itemType: 'Thành Phẩm' | 'Bán thành phẩm';
  detailName?: string;
  lineId: string;
  unit: string;
  completedQuantities: Record<string, number | ''>;
  damagedQuantities?: Record<string, number | ''>;
  compensationFromStock?: Record<string, number>;
  compensationFromCustomer?: Record<string, number>;
  status: string;
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

export const Tab7ProductionReport: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerPlanOrders,
    currentCustomerProductionReports,
    currentCustomerRealtimeStock,
    addProductionReport,
    updateProductionReport,
    deleteProductionReport,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Lấy danh sách tên vật tư theo từ PO đó thôi
  const getPoDetails = (poNumber: string) => {
    if (!poNumber) return [];
    const cleanPo = poNumber.trim().toUpperCase();
    const fromPlan = currentCustomerPlanOrders
      .filter((p) => p.poNumber.trim().toUpperCase() === cleanPo)
      .map((p) => p.description?.trim() || p.itemCode?.trim())
      .filter(Boolean);
    const fromStock = currentCustomerRealtimeStock
      .filter((s) => s.poNumber.trim().toUpperCase() === cleanPo)
      .map((s) => s.description?.trim() || s.itemCode?.trim())
      .filter(Boolean);
    return Array.from(new Set([...fromPlan, ...fromStock]));
  };

  const createBlankItem = (idx: number, isEditing: boolean = true): Tab7ReportItem => {
    const compInit: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      compInit[s] = '';
    });

    const defaultPlan = currentCustomerPlanOrders[idx] || currentCustomerPlanOrders[0];
    return {
      id: `draft-rep-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      isNew: true,
      isEditing,
      reportDate: defaultDate,
      poNumber: defaultPlan?.poNumber || '',
      itemCode: defaultPlan?.itemCode || '',
      itemType: 'Thành Phẩm',
      detailName: defaultPlan?.description || '',
      lineId: 'Chuyền 1',
      unit: defaultPlan?.unit || 'PRS',
      completedQuantities: compInit,
      damagedQuantities: {},
      compensationFromStock: {},
      status: 'Đạt chuẩn',
      note: '',
    };
  };

  // State danh sách các dòng trên bảng (mỗi bản ghi là 1 dòng đơn)
  const [reportItems, setReportItems] = useState<Tab7ReportItem[]>(() => {
    if (currentCustomerProductionReports.length > 0) {
      return currentCustomerProductionReports.map((r) => {
        const comp: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          comp[s] = typeof r.completedQuantities[s] === 'number' ? r.completedQuantities[s] : '';
        });
        return {
          id: r.id,
          isNew: false,
          isEditing: false, // Mặc định đã lưu -> khóa dòng
          reportDate: r.reportDate,
          poNumber: r.poNumber,
          itemCode: r.itemCode,
          itemType: (r.itemType as 'Thành Phẩm' | 'Bán thành phẩm') || 'Thành Phẩm',
          detailName: r.detailName || '',
          lineId: r.lineId,
          unit: r.unit || 'PRS',
          completedQuantities: comp,
          damagedQuantities: {},
          compensationFromStock: {},
          compensationFromCustomer: {},
          status: 'Đạt chuẩn',
          note: r.note && r.note.toLowerCase().includes('làm hỏng') ? '' : (r.note || ''),
        };
      });
    }
    return [createBlankItem(0, true)];
  });

  // Đồng bộ khi đổi khách hàng hoặc khi context cập nhật mà không đè lên dòng đang chỉnh sửa
  useEffect(() => {
    if (currentCustomerProductionReports.length === 0) {
      setReportItems((prev) => {
        if (prev.length === 0) return [createBlankItem(0, true)];
        return prev;
      });
      return;
    }

    setReportItems((prev) => {
      const editingMap = new Map(prev.filter((p) => p.isEditing).map((p) => [p.id, p]));
      const newItems: Tab7ReportItem[] = currentCustomerProductionReports.map((r) => {
        if (editingMap.has(r.id)) {
          return editingMap.get(r.id)!;
        }
        const comp: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          comp[s] = typeof r.completedQuantities[s] === 'number' ? r.completedQuantities[s] : '';
        });
        return {
          id: r.id,
          isNew: false,
          isEditing: false,
          reportDate: r.reportDate,
          poNumber: r.poNumber,
          itemCode: r.itemCode,
          itemType: (r.itemType as 'Thành Phẩm' | 'Bán thành phẩm') || 'Thành Phẩm',
          detailName: r.detailName || '',
          lineId: r.lineId,
          unit: r.unit || 'PRS',
          completedQuantities: comp,
          damagedQuantities: {},
          compensationFromStock: {},
          compensationFromCustomer: {},
          status: 'Đạt chuẩn',
          note: r.note && r.note.toLowerCase().includes('làm hỏng') ? '' : (r.note || ''),
        };
      });

      // Giữ lại các dòng mới đang soạn thảo chưa lưu
      const unsavedNewRows = prev.filter((p) => p.isNew && p.isEditing);
      return [...newItems, ...unsavedNewRows];
    });
  }, [currentCustomerProductionReports, currentCustomer?.id]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedForPrint, setSelectedForPrint] = useState<ProductionReportRow | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Thêm 1 dòng mới đại diện cho 1 PO mới
  const handleAddNewRow = () => {
    setReportItems((prev) => {
      const next = [...prev, createBlankItem(prev.length, true)];
      toast(`➕ Đã thêm dòng mới cho PO tiếp theo (STT ${next.length})!`);
      return next;
    });
  };

  const handleUpdateItemField = (id: string, field: keyof Tab7ReportItem, value: any) => {
    setReportItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'poNumber') {
          const cleanVal = String(value).trim().toUpperCase();
          const matches = currentCustomerPlanOrders.filter(
            (p) => p.poNumber.trim().toUpperCase() === cleanVal
          );
          if (matches.length > 0) {
            const first = matches[0];
            updated.itemCode = first.itemCode;
            updated.unit = first.unit || 'PRS';
            updated.detailName = first.description || first.itemCode;
          }
        }
        if (field === 'detailName') {
          const match = currentCustomerPlanOrders.find(
            (p) =>
              p.poNumber.trim().toUpperCase() === updated.poNumber.trim().toUpperCase() &&
              (p.description?.trim() === String(value).trim() || p.itemCode?.trim() === String(value).trim())
          );
          if (match && match.itemCode) {
            updated.itemCode = match.itemCode;
            if (match.unit) updated.unit = match.unit;
          }
        }
        if (field === 'itemCode') {
          const match = currentCustomerPlanOrders.find(
            (p) =>
              p.poNumber.trim().toUpperCase() === updated.poNumber.trim().toUpperCase() &&
              p.itemCode.trim().toUpperCase() === String(value).trim().toUpperCase()
          );
          if (match && match.description) {
            updated.detailName = match.description;
            if (match.unit) updated.unit = match.unit;
          }
        }
        return updated;
      })
    );
  };

  const handleUpdateItemSizeQty = (
    id: string,
    size: string,
    val: string
  ) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setReportItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          completedQuantities: {
            ...item.completedQuantities,
            [size]: num,
          },
        };
      })
    );
  };

  // Mở khóa cho sửa trực tiếp ngay trên ô của dòng đó (KHÔNG mở modal mới!)
  const handleUnlockRow = (id: string) => {
    setReportItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isEditing: true } : item))
    );
  };

  // Nhập Enter hoặc bấm Lưu: Lưu và KHÓA DÒNG NGAY TẠI CHỖ ĐÓ (Không thêm ô thêm dòng, giữ nguyên vị trí)
  const handleSaveRow = (id: string) => {
    const item = reportItems.find((r) => r.id === id);
    if (!item) return;

    if (!item.poNumber.trim() || !item.itemCode.trim()) {
      alert('Vui lòng nhập đầy đủ Mã PO và Code Vật tư!', 'Thiếu thông tin', 'warning');
      return;
    }

    const cTotal = sizes.reduce(
      (sum, s) => sum + (typeof item.completedQuantities[s] === 'number' ? Number(item.completedQuantities[s]) : 0),
      0
    );

    if (cTotal <= 0) {
      alert('Vui lòng nhập số lượng đạt chuẩn cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    const completedQ: Record<string, number> = {};
    sizes.forEach((s) => {
      completedQ[s] = typeof item.completedQuantities[s] === 'number' ? Number(item.completedQuantities[s]) : 0;
    });

    const reportData: ProductionReportRow = {
      id: item.isNew ? `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : item.id,
      customerId: currentCustomer?.id || '',
      reportDate: item.reportDate.trim() || defaultDate,
      poNumber: item.poNumber.trim().toUpperCase(),
      itemCode: item.itemCode.trim().toUpperCase(),
      itemType: item.itemType || 'Thành Phẩm',
      detailName: item.detailName?.trim() || undefined,
      lineId: item.lineId,
      unit: item.unit || 'PRS',
      completedQuantities: completedQ,
      damagedQuantities: {},
      compensationFromStock: {},
      compensationFromCustomer: {},
      status: 'Đạt chuẩn',
      note: item.note.trim() || undefined,
    };

    if (item.isNew) {
      addProductionReport(reportData);
    } else {
      updateProductionReport(reportData);
    }

    // KHÓA DÒNG NGAY TẠI VỊ TRÍ ĐÓ (Giữ nguyên dòng, không nhảy, không sinh thêm ô mới)
    setReportItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              id: reportData.id,
              isNew: false,
              isEditing: false, // Khóa dòng!
              status: 'Đạt chuẩn',
            }
          : r
      )
    );

    toast(`🔒 Đã lưu & khóa dòng PO ${reportData.poNumber} [${reportData.itemType}] thành công! Nhấn Sửa ✏️ để mở khóa chỉnh lại.`);
  };

  // Xóa dòng
  const handleDeleteRow = (item: Tab7ReportItem) => {
    confirm(`Bạn có chắc muốn xóa báo cáo nghiệm thu PO ${item.poNumber || 'này'}?`, () => {
      if (!item.isNew) {
        deleteProductionReport(item.id);
      }
      setReportItems((prev) => {
        const next = prev.filter((r) => r.id !== item.id);
        if (next.length === 0) {
          return [createBlankItem(0, true)];
        }
        return next;
      });
      toast(`Đã xóa dòng PO ${item.poNumber || ''}`);
    });
  };

  // Dán từ Excel vào hàng số lượng nghiệm thu đạt chuẩn
  const handleCellPaste = (
    e: React.ClipboardEvent,
    targetItemIdx: number,
    startSize: string
  ) => {
    const clip = e.clipboardData.getData('text');
    if (!clip || (!clip.includes('\t') && !clip.includes('\n') && !clip.includes(' '))) return;

    const rawLines = clip.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length === 0) return;

    e.preventDefault();
    const startSizeIdx = sizes.indexOf(startSize);

    setReportItems((prev) => {
      let currentRows = [...prev];

      rawLines.forEach((line, lineOffset) => {
        const poIdx = targetItemIdx + lineOffset;
        if (poIdx >= currentRows.length) {
          currentRows.push(createBlankItem(currentRows.length, true));
        }

        const item = { ...currentRows[poIdx], isEditing: true };
        const parts = line.trim().split(/[\t\s]+/).filter(Boolean);
        const compDict = { ...item.completedQuantities };

        parts.forEach((p, offset) => {
          const targetIdx = startSizeIdx + offset;
          if (targetIdx < sizes.length) {
            const sz = sizes[targetIdx];
            const num = parseFloat(p.replace(/,/g, ''));
            compDict[sz] = isNaN(num) ? '' : Math.max(0, num);
          }
        });

        item.completedQuantities = compDict;
        currentRows[poIdx] = item;
      });

      toast(`📋 Đã dán ${rawLines.length} dòng số lượng từ Excel thành công!`);
      return currentRows;
    });
  };

  // Lọc tìm kiếm
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return reportItems;
    const q = searchQuery.toLowerCase();
    return reportItems.filter(
      (i) =>
        i.poNumber.toLowerCase().includes(q) ||
        i.itemCode.toLowerCase().includes(q) ||
        (i.itemType && i.itemType.toLowerCase().includes(q)) ||
        (i.detailName && i.detailName.toLowerCase().includes(q)) ||
        i.lineId.toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q)
    );
  }, [reportItems, searchQuery]);

  // Xuất Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày BC',
      'Mã PO',
      'Code Vật tư',
      'Loại',
      'Tên Chi Tiết',
      'Chuyền SX',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Đạt',
      'Ghi Chú',
    ];

    const dataRows: any[] = [];
    filteredItems.forEach((rep, idx) => {
      const cTotal = sizes.reduce(
        (sum, s) => sum + (typeof rep.completedQuantities[s] === 'number' ? Number(rep.completedQuantities[s]) : 0),
        0
      );
      dataRows.push([
        idx + 1,
        rep.reportDate,
        rep.poNumber,
        rep.itemCode,
        rep.itemType || 'Thành Phẩm',
        rep.detailName || '',
        rep.lineId,
        rep.unit,
        ...sizes.map((s) => (typeof rep.completedQuantities[s] === 'number' ? rep.completedQuantities[s] : 0)),
        cTotal,
        rep.note || '',
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'NghiemThuSX_Tab7');
    XLSX.writeFile(wb, `Tab7_NghiemThuSX_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // In chuẩn bị
  const printRows: PrintTableRow[] = useMemo(() => {
    const list = selectedForPrint
      ? [selectedForPrint]
      : filteredItems.map((r) => {
          const compNum: Record<string, number> = {};
          sizes.forEach((s) => {
            compNum[s] = typeof r.completedQuantities[s] === 'number' ? Number(r.completedQuantities[s]) : 0;
          });
          return {
            id: r.id,
            customerId: currentCustomer?.id || '',
            reportDate: r.reportDate,
            poNumber: r.poNumber,
            itemCode: r.itemCode,
            itemType: r.itemType,
            detailName: r.detailName,
            lineId: r.lineId,
            unit: r.unit,
            completedQuantities: compNum,
            damagedQuantities: {},
            compensationFromStock: {},
            compensationFromCustomer: {},
            status: 'Đạt chuẩn',
            note: r.note,
          };
        });

    return list.map((r, idx) => {
      const cTotal = sizes.reduce((sum, s) => sum + (r.completedQuantities[s] || 0), 0);
      return {
        stt: idx + 1,
        date: r.reportDate,
        voucherCode: r.lineId,
        poNumber: r.poNumber,
        code: r.itemCode,
        description: `Báo cáo nghiệm thu [${r.itemType || 'Thành Phẩm'}] - ${r.lineId}`,
        unit: r.unit,
        sizeQuantities: r.completedQuantities,
        totalQty: cTotal,
        note: r.note || '',
      };
    });
  }, [selectedForPrint, filteredItems, sizes, currentCustomer]);

  return (
    <div className="space-y-4">
      {/* Khung Bảng Excel Duy Nhất (Không có form popup, khóa và mở khóa sửa trực tiếp trên ô) */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        {/* Thanh công cụ tiêu đề */}
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 7: GHI NHẬN SẢN XUẤT XONG (NGHIỆM THU CHUYỀN)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Chọn Loại (Thành Phẩm / Bán thành phẩm), nhập số lượng nghiệm thu đạt chuẩn, Enter lưu và khóa dòng tại chỗ • Bấm Sửa để mở khóa trực tiếp trên ô
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <div className="relative w-40 sm:w-48">
              <input
                type="text"
                placeholder="Tìm PO, Code Vật tư, chuyền..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-emerald-500 focus:outline-none bg-white"
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

            {/* Nút thêm dòng cho PO mới */}
            <button
              type="button"
              onClick={handleAddNewRow}
              className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-bold px-3 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-sky-600" />
              <span>+ Thêm Dòng (PO Mới)</span>
            </button>
          </div>
        </div>

        {/* Bảng Dữ Liệu Trực Tiếp (1 dòng/bản ghi, Enter khóa dòng, Sửa mở khóa tại ô) */}
        <div ref={gridContainerRef} className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-9">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[90px]">Ngày BC *</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã PO *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Code Vật tư *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px] bg-purple-50 text-purple-900 font-bold text-center">
                  Loại *
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[130px] bg-amber-50 text-amber-900 font-bold">
                  Tên Chi Tiết
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[110px] bg-sky-50 text-sky-900 font-bold">
                  Chuyền SX *
                </th>
                <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>

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
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Ghi Chú</th>
                <th className="p-2 text-center w-24">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredItems.map((item, idx) => {
                const compTotal = sizes.reduce(
                  (sum, s) =>
                    sum + (typeof item.completedQuantities[s] === 'number' ? Number(item.completedQuantities[s]) : 0),
                  0
                );

                const isLocked = !item.isEditing;
                const rowStt = idx + 1;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isLocked ? 'bg-white hover:bg-slate-50' : 'bg-[#f0fdf4]'
                    } border-b border-slate-300`}
                  >
                    {/* Cột STT */}
                    <td className="p-2 border-r border-slate-300 text-center font-mono font-bold text-slate-700 bg-white align-middle">
                      {rowStt}
                    </td>

                    {/* Ngày báo cáo */}
                    <td className="p-0 border-r border-slate-300 align-middle bg-white">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 font-mono text-slate-700 whitespace-nowrap cursor-pointer hover:bg-emerald-50/60 transition-colors"
                          title="Click để sửa"
                        >
                          {item.reportDate}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={item.reportDate}
                          onChange={(e) => handleUpdateItemField(item.id, 'reportDate', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="DD/MM/YYYY"
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                      )}
                    </td>

                    {/* Mã PO */}
                    <td className="p-1 border-r border-slate-300 align-middle bg-white">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-1 font-mono font-bold text-sky-700 whitespace-nowrap cursor-pointer hover:bg-emerald-50/60 transition-colors"
                          title="Click để sửa"
                        >
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
                          placeholder="Chọn PO..."
                          className="w-full text-xs font-mono font-bold uppercase text-sky-800"
                        />
                      )}
                    </td>

                    {/* Code Vật tư */}
                    <td className="p-0 border-r border-slate-300 align-middle bg-white">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 font-mono font-bold text-slate-800 whitespace-nowrap cursor-pointer hover:bg-emerald-50/60 transition-colors"
                          title="Click để sửa"
                        >
                          {item.itemCode}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={item.itemCode}
                          onChange={(e) => handleUpdateItemField(item.id, 'itemCode', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Code Vật tư"
                          className="w-full h-8 px-2 text-xs font-mono font-bold text-slate-900 uppercase bg-transparent border-0 focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                    </td>

                    {/* Cột Loại *: Dropdown Thành Phẩm / Bán thành phẩm */}
                    <td className="p-1 border-r border-slate-300 align-middle text-center bg-white min-w-[120px]">
                      {isLocked ? (
                        <span
                          onClick={() => handleUnlockRow(item.id)}
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${
                            item.itemType === 'Bán thành phẩm'
                              ? 'bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                          }`}
                          title="Click để sửa"
                        >
                          {item.itemType || 'Thành Phẩm'}
                        </span>
                      ) : (
                        <select
                          value={item.itemType || 'Thành Phẩm'}
                          onChange={(e) => handleUpdateItemField(item.id, 'itemType', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          className="w-full h-8 px-1 text-xs font-bold border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 bg-white cursor-pointer text-slate-800"
                        >
                          <option value="Thành Phẩm">Thành Phẩm</option>
                          <option value="Bán thành phẩm">Bán thành phẩm</option>
                        </select>
                      )}
                    </td>

                    {/* Tên Chi Tiết (Dropdown danh sách vật tư theo từ PO đó) */}
                    <td className="p-0 border-r border-slate-300 align-middle bg-white min-w-[120px]">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 text-slate-800 text-xs truncate max-w-[140px] cursor-pointer hover:bg-emerald-50/60 transition-colors font-medium"
                          title={item.detailName || 'Click để sửa tên chi tiết'}
                        >
                          {item.detailName || '-'}
                        </div>
                      ) : (
                        <div className="p-1">
                          <select
                            data-row-idx={idx}
                            data-col-key="detailName"
                            value={item.detailName || ''}
                            onChange={(e) => handleUpdateItemField(item.id, 'detailName', e.target.value)}
                            onKeyDown={(e) => {
                              handleCellArrowNavigation(e, gridContainerRef);
                              if (e.key === 'Enter') handleSaveRow(item.id);
                            }}
                            className="w-full h-8 px-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 bg-white cursor-pointer text-slate-800 font-medium"
                          >
                            <option value="">-- Chọn tên vật tư trong PO --</option>
                            {getPoDetails(item.poNumber).map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                            {item.detailName && !getPoDetails(item.poNumber).includes(item.detailName) && (
                              <option value={item.detailName}>{item.detailName}</option>
                            )}
                          </select>
                        </div>
                      )}
                    </td>

                    {/* Chuyền sản xuất */}
                    <td className="p-0 border-r border-slate-300 bg-sky-50/40 align-middle">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 font-bold text-sky-900 whitespace-nowrap cursor-pointer hover:bg-emerald-50/60 transition-colors"
                          title="Click để sửa"
                        >
                          {item.lineId}
                        </div>
                      ) : (
                        <select
                          value={item.lineId}
                          onChange={(e) => handleUpdateItemField(item.id, 'lineId', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          className="w-full h-8 px-2 text-xs font-bold text-sky-900 bg-transparent border-0 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
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
                    <td className="p-0 border-r border-slate-300 text-center align-middle bg-white">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 text-slate-600 text-center cursor-pointer hover:bg-emerald-50/60 transition-colors"
                          title="Click để sửa"
                        >
                          {item.unit}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleUpdateItemField(item.id, 'unit', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          className="w-full h-8 px-1 text-xs text-center bg-transparent border-0 focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                    </td>

                    {/* Size columns cho Thành phẩm đạt */}
                    {sizes.map((s) => {
                      const val = item.completedQuantities[s];
                      return (
                        <td key={s} className="p-0 border-r border-slate-200 text-center">
                          {isLocked ? (
                            <div
                              onClick={() => handleUnlockRow(item.id)}
                              className={`p-2 font-mono font-bold cursor-pointer hover:bg-emerald-50/60 transition-colors ${
                                 typeof val === 'number' && val > 0 ? 'text-emerald-900 bg-emerald-50/40' : 'text-slate-300'
                              }`}
                              title="Click để sửa"
                            >
                              {typeof val === 'number' && val > 0 ? val.toLocaleString('vi-VN') : '-'}
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={val ?? ''}
                              onChange={(e) => handleUpdateItemSizeQty(item.id, s, e.target.value)}
                              onKeyDown={(e) => {
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveRow(item.id);
                              }}
                              onPaste={(e) => handleCellPaste(e, idx, s)}
                              placeholder="-"
                              className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-emerald-950 border border-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          )}
                        </td>
                      );
                    })}

                    {/* Tổng SL Đạt */}
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-emerald-50 text-emerald-950">
                      {compTotal > 0 ? compTotal.toLocaleString('vi-VN') : '-'}
                    </td>

                    {/* Ghi chú */}
                    <td className="p-0 border-r border-slate-300 align-middle bg-white">
                      {isLocked ? (
                        <div
                          onClick={() => handleUnlockRow(item.id)}
                          className="p-2 text-slate-600 text-[11px] truncate max-w-[130px] cursor-pointer hover:bg-emerald-50/60 transition-colors"
                          title="Click để sửa"
                        >
                          {item.note || '-'}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={item.note}
                          onChange={(e) => handleUpdateItemField(item.id, 'note', e.target.value)}
                          onKeyDown={(e) => {
                            handleCellArrowNavigation(e, gridContainerRef);
                            if (e.key === 'Enter') handleSaveRow(item.id);
                          }}
                          placeholder="Ghi chú (Enter lưu)..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                    </td>

                    {/* Thao tác (Khóa dòng có Sửa/Xóa/In, Đang sửa có Lưu) */}
                    <td className="p-1.5 text-center whitespace-nowrap align-middle bg-white">
                      {isLocked ? (
                        <div className="flex items-center justify-center gap-1">
                          {/* Nút Sửa: Mở khóa sửa trực tiếp ngay trên ô của dòng đó! */}
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
                            title="Xóa báo cáo này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút In */}
                          <button
                            type="button"
                            onClick={() => {
                              const cNum: Record<string, number> = {};
                              sizes.forEach((s) => {
                                cNum[s] = typeof item.completedQuantities[s] === 'number' ? Number(item.completedQuantities[s]) : 0;
                              });
                              setSelectedForPrint({
                                id: item.id,
                                customerId: currentCustomer?.id || '',
                                reportDate: item.reportDate,
                                poNumber: item.poNumber,
                                itemCode: item.itemCode,
                                itemType: item.itemType,
                                detailName: item.detailName,
                                lineId: item.lineId,
                                unit: item.unit,
                                completedQuantities: cNum,
                                damagedQuantities: {},
                                compensationFromStock: {},
                                compensationFromCustomer: {},
                                status: item.status as any,
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
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-1"
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
                  TỔNG CỘNG ĐÃ NGHIỆM THU:
                </td>
                {sizes.map((s) => {
                  const sComp = filteredItems.reduce(
                    (sum, r) =>
                      sum + (typeof r.completedQuantities[s] === 'number' ? Number(r.completedQuantities[s]) : 0),
                    0
                  );
                  return (
                    <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-950">
                      {sComp > 0 ? sComp.toLocaleString('vi-VN') : '-'}
                    </td>
                  );
                })}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-950 bg-emerald-200">
                  {filteredItems
                    .reduce(
                      (sum, r) =>
                        sum +
                        sizes.reduce(
                          (sub, s) =>
                            sub + (typeof r.completedQuantities[s] === 'number' ? Number(r.completedQuantities[s]) : 0),
                          0
                        ),
                      0
                    )
                    .toLocaleString('vi-VN')}
                </td>
                <td colSpan={2} className="p-2 text-slate-600 text-[11px] italic">
                  Tổng {filteredItems.length} đợt nghiệm thu chuyền
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
            Tổng cộng: <strong className="text-emerald-700">{filteredItems.length}</strong> dòng PO nghiệm thu
          </div>
        </div>
      </div>

      {/* MODAL IN PHIẾU NGHIỆM THU */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => {
          setShowPrintModal(false);
          setSelectedForPrint(null);
        }}
        documentTitle={
          selectedForPrint
            ? `BÁO CÁO NGHIỆM THU CHUYỀN ${selectedForPrint.lineId}`
            : 'BẢNG TỔNG HỢP BÁO CÁO NGHIỆM THU SẢN XUẤT'
        }
        documentNumber={selectedForPrint ? `BB-NT-${selectedForPrint.poNumber}` : 'TH-NGHIEM-THU'}
        dateStr={selectedForPrint?.reportDate || defaultDate}
        customerName={currentCustomer?.name || 'Khách hàng'}
        poNumber={selectedForPrint?.poNumber}
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
