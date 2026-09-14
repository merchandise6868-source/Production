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
  detailName?: string;
  lineId: string;
  unit: string;
  completedQuantities: Record<string, number | ''>;
  damagedQuantities: Record<string, number | ''>;
  compensationFromStock: Record<string, number>;
  compensationFromCustomer: Record<string, number>;
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

  // Lấy danh sách tên chi tiết / vật tư có trong PO đó
  const getPoDetails = (poNumber: string) => {
    const matching = currentCustomerPlanOrders.filter(
      (p) => p.poNumber.toUpperCase() === poNumber.toUpperCase()
    );
    const details = matching.map((p) => p.description || p.itemCode).filter(Boolean);
    return Array.from(new Set(details));
  };

  const createBlankItem = (idx: number, isEditing: boolean = true): Tab7ReportItem => {
    const compInit: Record<string, number | ''> = {};
    const damInit: Record<string, number | ''> = {};
    sizes.forEach((s) => {
      compInit[s] = '';
      damInit[s] = '';
    });

    const defaultPlan = currentCustomerPlanOrders[idx] || currentCustomerPlanOrders[0];
    return {
      id: `draft-rep-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      isNew: true,
      isEditing,
      reportDate: defaultDate,
      poNumber: defaultPlan?.poNumber || '',
      itemCode: defaultPlan?.itemCode || '',
      detailName: defaultPlan?.description || '',
      lineId: 'Chuyền 1',
      unit: defaultPlan?.unit || 'PRS',
      completedQuantities: compInit,
      damagedQuantities: damInit,
      compensationFromStock: {},
      compensationFromCustomer: {},
      status: 'Đủ hàng',
      note: '',
    };
  };

  // State danh sách các dòng trên bảng (mỗi dòng đại diện cho 1 PO với 2 phân dòng: Đạt chuẩn & Làm hỏng)
  const [reportItems, setReportItems] = useState<Tab7ReportItem[]>(() => {
    if (currentCustomerProductionReports.length > 0) {
      return currentCustomerProductionReports.map((r) => {
        const comp: Record<string, number | ''> = {};
        const dam: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          comp[s] = typeof r.completedQuantities[s] === 'number' ? r.completedQuantities[s] : '';
          dam[s] = typeof r.damagedQuantities[s] === 'number' ? r.damagedQuantities[s] : '';
        });
        return {
          id: r.id,
          isNew: false,
          isEditing: false, // Mặc định đã lưu -> khóa dòng
          reportDate: r.reportDate,
          poNumber: r.poNumber,
          itemCode: r.itemCode,
          detailName: r.detailName || '',
          lineId: r.lineId,
          unit: r.unit || 'PRS',
          completedQuantities: comp,
          damagedQuantities: dam,
          compensationFromStock: r.compensationFromStock || {},
          compensationFromCustomer: r.compensationFromCustomer || {},
          status: r.status || 'Đủ hàng',
          note: r.note || '',
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
        const dam: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          comp[s] = typeof r.completedQuantities[s] === 'number' ? r.completedQuantities[s] : '';
          dam[s] = typeof r.damagedQuantities[s] === 'number' ? r.damagedQuantities[s] : '';
        });
        return {
          id: r.id,
          isNew: false,
          isEditing: false,
          reportDate: r.reportDate,
          poNumber: r.poNumber,
          itemCode: r.itemCode,
          detailName: r.detailName || '',
          lineId: r.lineId,
          unit: r.unit || 'PRS',
          completedQuantities: comp,
          damagedQuantities: dam,
          compensationFromStock: r.compensationFromStock || {},
          compensationFromCustomer: r.compensationFromCustomer || {},
          status: r.status || 'Đủ hàng',
          note: r.note || '',
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

  // Helper lấy tồn kho từ Tab 5 để đối chiếu xử lý hỏng
  const getAvailableStock = (poNumber: string, itemCode: string, size: string): number => {
    const key = `${poNumber.trim().toUpperCase()}__${itemCode.trim().toUpperCase()}`;
    const stockItem = currentCustomerRealtimeStock.find((s) => s.key === key);
    if (!stockItem) return 0;
    return stockItem.currentStockSizes[size] || 0;
  };

  // Thêm 1 dòng mới đại diện cho 1 PO mới (tự tăng STT và lặp lại dòng đạt chuẩn & làm hỏng)
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
          const match = currentCustomerPlanOrders.find(
            (p) => p.poNumber.toUpperCase() === String(value).toUpperCase()
          );
          if (match) {
            updated.itemCode = match.itemCode;
            updated.unit = match.unit;
            const details = getPoDetails(match.poNumber);
            if (details.length > 0 && !updated.detailName) {
              updated.detailName = details[0];
            }
          }
        }
        return updated;
      })
    );
  };

  const handleUpdateItemSizeQty = (
    id: string,
    type: 'completed' | 'damaged',
    size: string,
    val: string
  ) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setReportItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (type === 'completed') {
          return {
            ...item,
            completedQuantities: {
              ...item.completedQuantities,
              [size]: num,
            },
          };
        } else {
          return {
            ...item,
            damagedQuantities: {
              ...item.damagedQuantities,
              [size]: num,
            },
          };
        }
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

    const cTotal = sizes.reduce((sum, s) => sum + (typeof item.completedQuantities[s] === 'number' ? Number(item.completedQuantities[s]) : 0), 0);
    const dTotal = sizes.reduce((sum, s) => sum + (typeof item.damagedQuantities[s] === 'number' ? Number(item.damagedQuantities[s]) : 0), 0);

    if (cTotal <= 0 && dTotal <= 0) {
      alert('Vui lòng nhập số lượng đạt chuẩn hoặc số lượng làm hỏng cho ít nhất một Size!', 'Chưa có số lượng', 'warning');
      return;
    }

    // Tính toán nhánh bù kho / bù khách
    const completedQ: Record<string, number> = {};
    const damagedQ: Record<string, number> = {};
    const fromStock: Record<string, number> = {};
    const fromCustomer: Record<string, number> = {};
    let totalDamaged = 0;
    let totalFromStock = 0;
    let totalFromCustomer = 0;

    sizes.forEach((s) => {
      const c = typeof item.completedQuantities[s] === 'number' ? Number(item.completedQuantities[s]) : 0;
      const d = typeof item.damagedQuantities[s] === 'number' ? Number(item.damagedQuantities[s]) : 0;
      completedQ[s] = c;
      damagedQ[s] = d;

      if (d > 0) {
        totalDamaged += d;
        const available = getAvailableStock(item.poNumber, item.itemCode, s);
        if (available >= d) {
          fromStock[s] = d;
          totalFromStock += d;
        } else if (available > 0) {
          fromStock[s] = available;
          totalFromStock += available;
          const shortage = d - available;
          fromCustomer[s] = shortage;
          totalFromCustomer += shortage;
        } else {
          fromCustomer[s] = d;
          totalFromCustomer += d;
        }
      }
    });

    let status: ProductionReportRow['status'] = 'Đủ hàng';
    if (totalFromCustomer > 0) {
      status = 'Đề nghị KH cấp bù';
    } else if (totalFromStock > 0) {
      status = 'Xuất bù từ kho';
    }

    const reportData: ProductionReportRow = {
      id: item.isNew ? `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : item.id,
      customerId: currentCustomer?.id || '',
      reportDate: item.reportDate.trim() || defaultDate,
      poNumber: item.poNumber.trim().toUpperCase(),
      itemCode: item.itemCode.trim().toUpperCase(),
      detailName: item.detailName?.trim() || undefined,
      lineId: item.lineId,
      unit: item.unit || 'PRS',
      completedQuantities: completedQ,
      damagedQuantities: damagedQ,
      compensationFromStock: fromStock,
      compensationFromCustomer: fromCustomer,
      status,
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
              status,
              compensationFromStock: fromStock,
              compensationFromCustomer: fromCustomer,
            }
          : r
      )
    );

    toast(`🔒 Đã lưu & khóa dòng PO ${reportData.poNumber} thành công! Nhấn Sửa ✏️ để mở khóa chỉnh lại.`);
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

  // Dán từ Excel vào hàng (completed hoặc damaged) thông minh
  const handleCellPaste = (
    e: React.ClipboardEvent,
    targetItemIdx: number,
    type: 'completed' | 'damaged',
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

      if (rawLines.length === 1) {
        // Chỉ 1 dòng: Dán ngang trên dòng hiện tại (completed hoặc damaged)
        const parts = rawLines[0].trim().split(/[\t\s]+/).filter(Boolean);
        if (targetItemIdx < currentRows.length) {
          const item = { ...currentRows[targetItemIdx] };
          const targetDict = type === 'completed' ? { ...item.completedQuantities } : { ...item.damagedQuantities };
          parts.forEach((p, offset) => {
            const targetIdx = startSizeIdx + offset;
            if (targetIdx < sizes.length) {
              const sz = sizes[targetIdx];
              const num = parseFloat(p.replace(/,/g, ''));
              targetDict[sz] = isNaN(num) ? '' : Math.max(0, num);
            }
          });
          if (type === 'completed') {
            item.completedQuantities = targetDict;
          } else {
            item.damagedQuantities = targetDict;
          }
          currentRows[targetItemIdx] = item;
        }
        toast(`📋 Đã dán ${parts.length} số lượng từ Size ${startSize}!`);
      } else {
        // Nhiều dòng: Dán theo cặp (Dòng 1: Đạt chuẩn, Dòng 2: Làm hỏng)
        let rowLineIdx = 0;
        let poIdx = targetItemIdx;

        while (rowLineIdx < rawLines.length) {
          if (poIdx >= currentRows.length) {
            currentRows.push(createBlankItem(currentRows.length, true));
          }

          const item = { ...currentRows[poIdx], isEditing: true };

          // Dòng đầu: Đạt chuẩn (nếu bắt đầu từ completed)
          if (rowLineIdx < rawLines.length) {
            const compParts = rawLines[rowLineIdx].trim().split(/[\t\s]+/).filter(Boolean);
            const compDict = { ...item.completedQuantities };
            compParts.forEach((p, offset) => {
              const targetIdx = startSizeIdx + offset;
              if (targetIdx < sizes.length) {
                const sz = sizes[targetIdx];
                const num = parseFloat(p.replace(/,/g, ''));
                compDict[sz] = isNaN(num) ? '' : Math.max(0, num);
              }
            });
            item.completedQuantities = compDict;
            rowLineIdx++;
          }

          // Dòng tiếp: Làm hỏng (nếu còn dòng)
          if (rowLineIdx < rawLines.length && type === 'completed') {
            const damParts = rawLines[rowLineIdx].trim().split(/[\t\s]+/).filter(Boolean);
            const damDict = { ...item.damagedQuantities };
            damParts.forEach((p, offset) => {
              const targetIdx = startSizeIdx + offset;
              if (targetIdx < sizes.length) {
                const sz = sizes[targetIdx];
                const num = parseFloat(p.replace(/,/g, ''));
                damDict[sz] = isNaN(num) ? '' : Math.max(0, num);
              }
            });
            item.damagedQuantities = damDict;
            rowLineIdx++;
          }

          currentRows[poIdx] = item;
          poIdx++;
        }

        toast(`📋 Đã dán ${rawLines.length} dòng số lượng từ Excel thành công!`);
      }

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
      'Tên Chi Tiết',
      'Chuyền SX',
      'ĐVT',
      'Phân Loại',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL',
      'Trạng Thái Xử Lý Hỏng',
    ];

    const dataRows: any[] = [];
    filteredItems.forEach((rep, idx) => {
      const cTotal = sizes.reduce((sum, s) => sum + (typeof rep.completedQuantities[s] === 'number' ? Number(rep.completedQuantities[s]) : 0), 0);
      dataRows.push([
        idx + 1,
        rep.reportDate,
        rep.poNumber,
        rep.itemCode,
        rep.detailName || '',
        rep.lineId,
        rep.unit,
        '1. Đạt chuẩn (Nhập)',
        ...sizes.map((s) => (typeof rep.completedQuantities[s] === 'number' ? rep.completedQuantities[s] : 0)),
        cTotal,
        rep.status,
      ]);

      const dTotal = sizes.reduce((sum, s) => sum + (typeof rep.damagedQuantities[s] === 'number' ? Number(rep.damagedQuantities[s]) : 0), 0);
      if (dTotal > 0 || rep.isEditing) {
        dataRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '2. Làm hỏng (nếu có)',
          ...sizes.map((s) => (typeof rep.damagedQuantities[s] === 'number' ? rep.damagedQuantities[s] : 0)),
          dTotal,
          `Kho bù: ${sizes.reduce((s, k) => s + (rep.compensationFromStock[k] || 0), 0)} | KH bù: ${sizes.reduce((s, k) => s + (rep.compensationFromCustomer[k] || 0), 0)}`,
        ]);
      }
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
            lineId: r.lineId,
            unit: r.unit,
            completedQuantities: compNum,
            damagedQuantities: {},
            compensationFromStock: {},
            compensationFromCustomer: {},
            status: r.status as any,
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
        description: `Báo cáo nghiệm thu ${r.lineId}`,
        unit: r.unit,
        sizeQuantities: r.completedQuantities,
        totalQty: cTotal,
        note: `Trạng thái: ${r.status} ${r.note ? `• ${r.note}` : ''}`,
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
              | Nhập số đạt &amp; hỏng, Enter lưu và khóa dòng tại chỗ • Bấm Sửa để mở khóa trực tiếp trên ô
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

            {/* Nút thêm dòng cho PO mới: Tự tăng số thứ tự và lặp lại 2 dòng đạt chuẩn & làm hỏng */}
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

        {/* Bảng Dữ Liệu Trực Tiếp (Giữ nguyên vị trí dòng, Enter khóa dòng, Sửa mở khóa tại ô) */}
        <div ref={gridContainerRef} className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300 shadow-2xs">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-9">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[90px]">Ngày BC *</th>
                <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã PO *</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Code Vật tư *</th>
                <th className="p-2 border-r border-slate-300 min-w-[130px] bg-amber-50 text-amber-900 font-bold">
                  Tên Chi Tiết
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[110px] bg-sky-50 text-sky-900 font-bold">
                  Chuyền SX *
                </th>
                <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                <th className="p-2 border-r border-slate-300 min-w-[135px]">Phân Loại</th>

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
                <th className="p-2 border-r border-slate-300 min-w-[140px] text-center">Trạng Thái Xử Lý</th>
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
                const damTotal = sizes.reduce(
                  (sum, s) =>
                    sum + (typeof item.damagedQuantities[s] === 'number' ? Number(item.damagedQuantities[s]) : 0),
                  0
                );

                const isLocked = !item.isEditing;
                const rowStt = idx + 1; // Tự động tăng số thứ tự cho bất kỳ dòng nào được thêm

                return (
                  <React.Fragment key={item.id}>
                    {/* DÒNG 1: THÀNH PHẨM ĐẠT CHUẨN */}
                    <tr
                      className={`transition-colors ${
                        isLocked ? 'bg-white hover:bg-slate-50' : 'bg-[#f0fdf4]'
                      } border-t-2 border-slate-300`}
                    >
                      {/* Cột STT: Tự động tăng số thứ tự (1, 2, 3...) */}
                      <td
                        rowSpan={2}
                        className="p-2 border-r border-slate-300 text-center font-mono font-bold text-slate-700 bg-white align-middle"
                      >
                        {rowStt}
                      </td>

                      {/* Ngày báo cáo */}
                      <td
                        rowSpan={2}
                        className="p-0 border-r border-slate-300 align-middle bg-white"
                      >
                        {isLocked ? (
                          <div className="p-2 font-mono text-slate-700 whitespace-nowrap">
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
                      <td
                        rowSpan={2}
                        className="p-1 border-r border-slate-300 align-middle bg-white"
                      >
                        {isLocked ? (
                          <div className="p-1 font-mono font-bold text-sky-700 whitespace-nowrap">
                            {item.poNumber}
                          </div>
                        ) : (
                          <SearchablePoSelect
                            value={item.poNumber}
                            onChange={(val) => handleUpdateItemField(item.id, 'poNumber', val)}
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
                      <td
                        rowSpan={2}
                        className="p-0 border-r border-slate-300 align-middle bg-white"
                      >
                        {isLocked ? (
                          <div className="p-2 font-mono font-bold text-slate-800 whitespace-nowrap">
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

                      {/* Tên Chi Tiết */}
                      <td
                        rowSpan={2}
                        className="p-0 border-r border-slate-300 align-middle bg-white min-w-[120px]"
                      >
                        {isLocked ? (
                          <div className="p-2 text-slate-800 text-xs truncate max-w-[140px]" title={item.detailName || ''}>
                            {item.detailName || '-'}
                          </div>
                        ) : (
                          <div className="p-1">
                            <select
                              value={item.detailName || ''}
                              onChange={(e) => handleUpdateItemField(item.id, 'detailName', e.target.value)}
                              onKeyDown={(e) => {
                                handleCellArrowNavigation(e, gridContainerRef);
                                if (e.key === 'Enter') handleSaveRow(item.id);
                              }}
                              className="w-full h-8 px-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-emerald-500 bg-white"
                            >
                              <option value="">-- Chọn chi tiết --</option>
                              {getPoDetails(item.poNumber).map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </td>

                      {/* Chuyền sản xuất */}
                      <td
                        rowSpan={2}
                        className="p-0 border-r border-slate-300 bg-sky-50/40 align-middle"
                      >
                        {isLocked ? (
                          <div className="p-2 font-bold text-sky-900 whitespace-nowrap">
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
                      <td
                        rowSpan={2}
                        className="p-0 border-r border-slate-300 text-center align-middle bg-white"
                      >
                        {isLocked ? (
                          <div className="p-2 text-slate-600 text-center">{item.unit}</div>
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

                      {/* Phân loại: 1. Đạt chuẩn (Nhập) */}
                      <td className="p-2 border-r border-slate-200 font-bold text-emerald-800 flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span>1. Đạt chuẩn (Nhập)</span>
                      </td>

                      {/* Size columns cho Thành phẩm đạt */}
                      {sizes.map((s) => {
                        const val = item.completedQuantities[s];
                        return (
                          <td key={s} className="p-0 border-r border-slate-200 text-center">
                            {isLocked ? (
                              <div
                                className={`p-2 font-mono font-bold ${
                                   typeof val === 'number' && val > 0 ? 'text-emerald-900 bg-emerald-50/40' : 'text-slate-300'
                                }`}
                              >
                                {typeof val === 'number' && val > 0 ? val.toLocaleString('vi-VN') : '-'}
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                value={val ?? ''}
                                onChange={(e) => handleUpdateItemSizeQty(item.id, 'completed', s, e.target.value)}
                                onKeyDown={(e) => {
                                  handleCellArrowNavigation(e, gridContainerRef);
                                  if (e.key === 'Enter') handleSaveRow(item.id);
                                }}
                                onPaste={(e) => handleCellPaste(e, idx, 'completed', s)}
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

                      {/* Trạng thái xử lý */}
                      <td className="p-2 border-r border-slate-200 text-center">
                        {isLocked ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'Đủ hàng'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : item.status === 'Xuất bù từ kho'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700">
                            Tồn Tab 5 trừ tự động
                          </span>
                        )}
                      </td>

                      {/* Ghi chú */}
                      <td
                        rowSpan={2}
                        className="p-0 border-r border-slate-300 align-middle bg-white"
                      >
                        {isLocked ? (
                          <div className="p-2 text-slate-600 text-[11px] truncate max-w-[130px]">
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
                            placeholder="Ghi chú nguyên nhân hỏng (Enter lưu)..."
                            className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        )}
                      </td>

                      {/* Thao tác (Khóa dòng có Sửa/Xóa, Đang sửa có Lưu) */}
                      <td
                        rowSpan={2}
                        className="p-1.5 text-center whitespace-nowrap align-middle bg-white"
                      >
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

                    {/* DÒNG 2: SỐ LƯỢNG LÀM HƯ HỎNG */}
                    <tr
                      className={`transition-colors ${
                        isLocked ? 'bg-[#fff5f5]/60 hover:bg-[#ffe4e6]/50' : 'bg-[#fff1f2]'
                      } border-b border-slate-300`}
                    >
                      <td className="p-2 border-r border-slate-200 font-bold text-rose-800 flex items-center gap-1.5 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        <span>2. Làm hỏng (nếu có)</span>
                      </td>

                      {/* Size columns cho Làm hỏng */}
                      {sizes.map((s) => {
                        const val = item.damagedQuantities[s];
                        return (
                          <td key={s} className="p-0 border-r border-slate-200 text-center">
                            {isLocked ? (
                              <div
                                className={`p-2 font-mono font-bold ${
                                  typeof val === 'number' && val > 0 ? 'text-rose-900 bg-rose-100/60' : 'text-slate-300'
                                }`}
                              >
                                {typeof val === 'number' && val > 0 ? val.toLocaleString('vi-VN') : '-'}
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                value={val ?? ''}
                                onChange={(e) => handleUpdateItemSizeQty(item.id, 'damaged', s, e.target.value)}
                                onKeyDown={(e) => {
                                  handleCellArrowNavigation(e, gridContainerRef);
                                  if (e.key === 'Enter') handleSaveRow(item.id);
                                }}
                                onPaste={(e) => handleCellPaste(e, idx, 'damaged', s)}
                                placeholder="-"
                                className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-rose-950 border border-rose-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* Tổng SL Hỏng */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-rose-50 text-rose-950">
                        {damTotal > 0 ? damTotal.toLocaleString('vi-VN') : '-'}
                      </td>

                      {/* Kết quả bù hỏng */}
                      <td className="p-2 border-r border-slate-200 text-center text-[10px] text-slate-600">
                        {damTotal > 0 ? (
                          <span>
                            Kho bù:{' '}
                            <strong>
                              {sizes.reduce((s, k) => s + (item.compensationFromStock[k] || 0), 0)}
                            </strong>{' '}
                            | KH bù:{' '}
                            <strong>
                              {sizes.reduce((s, k) => s + (item.compensationFromCustomer[k] || 0), 0)}
                            </strong>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* DÒNG TỔNG CỘNG TOÀN BỘ BẢNG */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-400">
                <td colSpan={8} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG THÀNH PHẨM ĐÃ NGHIỆM THU:
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
                <td colSpan={3} className="p-2 text-slate-600 text-[11px] italic">
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
