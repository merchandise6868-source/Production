import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { RealtimeStockItem } from '../../types';
import {
  Printer,
  Download,
  Search,
  Warehouse,
  AlertTriangle,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

export const Tab6RealtimeStock: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerRealtimeStock,
    currentCustomerActualReceives,
    currentCustomerProductionIssues,
    currentCustomerProductionReports,
    currentCustomerPlanOrders,
    updateStockCompensation,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDetailView, setIsDetailView] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'MATRIX' | 'MOVEMENTS'>('MATRIX');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Helper: Get list of material names (Tên vật tư) in that PO
  const getPoMaterials = (poNumber: string) => {
    const matching = currentCustomerPlanOrders.filter(
      (p) => p.poNumber.toUpperCase() === poNumber.toUpperCase()
    );
    const names = matching.map((p) => p.description || p.itemCode).filter(Boolean);
    return Array.from(new Set(names));
  };

  // Filtered matrix items (Standard 4-row view)
  const filteredStockItems = useMemo(() => {
    if (!searchQuery.trim()) return currentCustomerRealtimeStock;
    const q = searchQuery.toLowerCase();
    return currentCustomerRealtimeStock.filter(
      (item) =>
        item.poNumber.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [currentCustomerRealtimeStock, searchQuery]);

  // Detail mode: All receipts for searched PO
  const detailReceipts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return currentCustomerActualReceives.filter(
      (a) =>
        a.poNumber?.toLowerCase().includes(q) ||
        a.itemCode?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q)
    );
  }, [currentCustomerActualReceives, searchQuery]);

  // Detail mode: All production issues for searched PO
  const detailIssues = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return currentCustomerProductionIssues.filter(
      (p) =>
        p.poNumber.toLowerCase().includes(q) ||
        p.itemCode.toLowerCase().includes(q) ||
        (p.detailName && p.detailName.toLowerCase().includes(q))
    );
  }, [currentCustomerProductionIssues, searchQuery]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let received = 0;
    let prodIssued = 0;
    let damageComp = 0;
    let currentStock = 0;

    filteredStockItems.forEach((item) => {
      received += item.totalReceived;
      prodIssued += item.totalProductionIssued;
      damageComp += item.totalDamagedComp;
      currentStock += item.totalCurrentStock;
    });

    return { received, prodIssued, damageComp, currentStock };
  }, [filteredStockItems]);

  // Export Excel
  const handleExportExcel = () => {
    if (isDetailView && searchQuery.trim()) {
      if (detailReceipts.length === 0 && detailIssues.length === 0) {
        alert('Không có dữ liệu chi tiết để xuất.');
        return;
      }
      const headers = [
        'STT',
        'Ngày',
        'Mã PO',
        'Code Vật tư',
        'Tên Vật Tư / Diễn Giải',
        'ĐVT',
        'Phân Loại Luồng',
        ...sizes.map((s) => `Size ${s}`),
        'Tổng Cộng',
        'Trạng Thái',
      ];
      const dataRows: any[] = [];
      detailReceipts.forEach((r, idx) => {
        dataRows.push([
          idx + 1,
          r.receiptDate || '',
          r.poNumber,
          r.itemCode,
          r.description || '',
          r.unit || 'PRS',
          `1. Thực nhận (Phiếu ${r.voucherCode || 'N/A'})`,
          ...sizes.map((s) => r.sizeQuantities[s] || 0),
          r.totalQty,
          r.status || 'Hàng đơn',
        ]);
      });
      detailIssues.forEach((i, idx) => {
        dataRows.push([
          detailReceipts.length + idx + 1,
          i.issueDate || '',
          i.poNumber,
          i.itemCode,
          i.detailName || 'Chi tiết SX',
          i.unit || 'PRS',
          `2. Xuất SX (${i.lineId})`,
          ...sizes.map((s) => i.sizeQuantities[s] || 0),
          i.totalQty,
          'Xuất SX',
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `ChiTiet_${searchQuery}`);
      XLSX.writeFile(wb, `Tab5_ChiTiet_${searchQuery}_${currentCustomer?.name || 'KhachHang'}.xlsx`);
      return;
    }

    if (filteredStockItems.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }
    const headers = [
      'STT',
      'Mã PO',
      'Code Vật tư',
      'Diễn Giải',
      'ĐVT',
      'Phân Loại Luồng Dữ Liệu',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng Cộng',
    ];

    const dataRows: any[] = [];
    let stt = 1;

    filteredStockItems.forEach((item) => {
      // Line 1: Thực nhận
      dataRows.push([
        stt,
        item.poNumber,
        item.itemCode,
        item.description,
        item.unit,
        '1. Số Thực Nhận (Tab 2)',
        ...sizes.map((s) => item.receivedSizes[s] || 0),
        item.totalReceived,
      ]);

      // Line 2: Xuất sản xuất
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '2. Xuất Sản Xuất (Tab 6)',
        ...sizes.map((s) => item.productionIssuedSizes[s] || 0),
        item.totalProductionIssued,
      ]);

      // Line 3: Xuất bù
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '3. Xuất Bù Hỏng Hàng (Tab 7)',
        ...sizes.map((s) => item.damagedCompSizes[s] || 0),
        item.totalDamagedComp,
      ]);

      // Line 4: Tồn kho còn lại
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '4. TỒN KHO CÒN LẠI (= 1 - 2 - 3)',
        ...sizes.map((s) => item.currentStockSizes[s] || 0),
        item.totalCurrentStock,
      ]);

      stt++;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'TonKhoRealtime_Tab5');
    XLSX.writeFile(wb, `Tab5_TonKho_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    return filteredStockItems.map((item, idx) => ({
      stt: idx + 1,
      date: new Date().toLocaleDateString('vi-VN'),
      voucherCode: 'KHO-TON',
      poNumber: item.poNumber,
      code: item.itemCode,
      description: item.description,
      unit: item.unit,
      sizeQuantities: item.currentStockSizes,
      totalQty: item.totalCurrentStock,
      note: `Thực nhận: ${item.totalReceived} | Xuất SX: ${item.totalProductionIssued} | Xuất bù: ${item.totalDamagedComp}`,
    }));
  }, [filteredStockItems]);

  return (
    <div className="space-y-4">
      {/* Top Banner & KPI Cards */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-sky-600" />
              <span>TAB 5: TỒN KHO VẬT TƯ REALTIME &amp; PHÂN LOẠI XUẤT</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Tồn = Thực nhận (Tab 2) - Xuất SX (Tab 6) - Xuất bù (Tab 7)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In Bảng Tồn</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                1. Thực Nhận (Tab 2)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                Đường 1
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-slate-800 mt-1">
              {overallTotals.received.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Tồn kho ban đầu</span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                2. Xuất Sản Xuất (Tab 6)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                Đường 2
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-sky-700 mt-1">
              {overallTotals.prodIssued.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Cấp phát Chuyền theo kế hoạch</span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-purple-200 shadow-2xs bg-purple-50/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">
                3. Xuất Bù (Hỏng / Thiếu)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-200 text-purple-900">
                Cho nhập ✍️
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-purple-700 mt-1">
              {overallTotals.damageComp.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-purple-600">Điền số lượng khi xuất bù</span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-emerald-300 shadow-2xs bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider">
                4. TỒN KHO CÒN LẠI
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-200 text-emerald-900">
                Khả dụng
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-emerald-800 mt-1">
              {overallTotals.currentStock.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-emerald-600">Sẵn sàng cấp tiếp</span>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="p-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Tìm PO, Code Vật tư, tên vật tư..."
                value={searchQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchQuery(v);
                  if (!v.trim()) setIsDetailView(false);
                }}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Nút Xem Chi Tiết cạnh khung tìm kiếm */}
            <button
              type="button"
              onClick={() => {
                if (!searchQuery.trim()) {
                  alert('Vui lòng nhập mã PO vào ô tìm kiếm trước khi bấm Xem chi tiết!');
                  return;
                }
                setIsDetailView((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition cursor-pointer ${
                isDetailView
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-sky-700 border-sky-300 shadow-2xs'
              }`}
              title={
                isDetailView
                  ? 'Quay lại dạng tổng hợp 4 dòng'
                  : 'Hiển thị thêm cột Ngày, chi tiết từng lần thực nhận và từng lần xuất sản xuất'
              }
            >
              {isDetailView ? (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>📊 Dạng Tổng Hợp</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>👁️ Xem Chi Tiết</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            {isDetailView ? (
              <span className="text-amber-700 font-semibold">
                Đang xem chi tiết theo ngày cho mã PO "{searchQuery}" • Xóa mã PO để quay lại tổng hợp
              </span>
            ) : (
              <span>Hiển thị chi tiết 4 dòng cho mỗi Code Vật tư: Thực nhận ➔ Xuất SX ➔ Xuất bù ➔ Tồn kho</span>
            )}
          </div>
        </div>

        {/* Detailed Table (Either Detail View with Date Column OR Standard 4-row View) */}
        {isDetailView && searchQuery.trim() ? (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[95px] bg-amber-100/70 text-amber-950 font-bold">Ngày</th>
                  <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Code Vật tư</th>
                  <th className="p-2 border-r border-slate-300 min-w-[140px]">Tên Vật Tư</th>
                  <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 min-w-[190px]">Phân Loại / Chi Tiết</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right font-bold bg-slate-100 text-slate-900">
                    TỔNG CỘNG
                  </th>
                  <th className="p-2 text-center min-w-[95px]">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {detailReceipts.length === 0 && detailIssues.length === 0 ? (
                  <tr>
                    <td colSpan={8 + sizes.length + 1} className="p-8 text-center text-slate-400 text-xs italic">
                      Không tìm thấy giao dịch nhập/xuất nào cho PO "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* 1. Các lần Thực Nhận từ Tab 2 */}
                    {detailReceipts.map((rec, rIdx) => (
                      <tr key={`rec-${rec.id}-${rIdx}`} className="bg-white hover:bg-emerald-50/30 transition">
                        <td className="p-2 border-r border-slate-200 text-center font-mono text-[11px] text-slate-400">
                          {rIdx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-semibold text-amber-900 bg-amber-50/40">
                          {rec.receiptDate || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700">
                          {rec.poNumber}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                          {rec.itemCode}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-700">
                          {rec.description || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-slate-500">
                          {rec.unit || 'PRS'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-700 font-medium">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                          <span>1. Thực nhận (Phiếu: {rec.voucherCode || 'N/A'})</span>
                        </td>
                        {sizes.map((s) => {
                          const q = rec.sizeQuantities[s] || 0;
                          return (
                            <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-slate-800">
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                          {rec.totalQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.status === 'Hàng bù' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {rec.status || 'Hàng đơn'}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* 2. Các lần Xuất Sản Xuất từ Tab 6 */}
                    {detailIssues.map((iss, iIdx) => (
                      <tr key={`iss-${iss.id}-${iIdx}`} className="bg-sky-50/20 hover:bg-sky-50/40 transition">
                        <td className="p-2 border-r border-slate-200 text-center font-mono text-[11px] text-slate-400">
                          {detailReceipts.length + iIdx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-semibold text-amber-900 bg-amber-50/40">
                          {iss.issueDate || '-'}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700">
                          {iss.poNumber}
                        </td>
                        <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                          {iss.itemCode}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-slate-700">
                          {iss.detailName || 'Chi tiết SX'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-center text-slate-500">
                          {iss.unit || 'PRS'}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-sky-800 font-medium">
                          <span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1.5"></span>
                          <span>2. Xuất SX ({iss.lineId})</span>
                        </td>
                        {sizes.map((s) => {
                          const q = iss.sizeQuantities[s] || 0;
                          return (
                            <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-sky-900">
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-sky-950 bg-sky-100/50">
                          {iss.totalQty.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                            Xuất SX
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Dòng Tổng Kết Tồn Kho Cho PO */}
                    <tr className="bg-emerald-100/60 font-bold border-t-2 border-emerald-400">
                      <td colSpan={2} className="p-2 border-r border-slate-300 text-center font-mono text-[11px] text-emerald-950">
                        TỒN HIỆN TẠI
                      </td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-sky-800">
                        {searchQuery}
                      </td>
                      <td colSpan={3} className="p-2 border-r border-slate-300 text-emerald-950 uppercase text-[11px]">
                        TỒN KHO CÒN LẠI (THỰC NHẬN - XUẤT SX)
                      </td>
                      <td className="p-2 border-r border-slate-300 font-bold text-emerald-950">
                        Số dư khả dụng
                      </td>
                      {sizes.map((s) => {
                        const totRec = detailReceipts.reduce((sum, r) => sum + (r.sizeQuantities[s] || 0), 0);
                        const totIss = detailIssues.reduce((sum, i) => sum + (i.sizeQuantities[s] || 0), 0);
                        const net = totRec - totIss;
                        return (
                          <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-950">
                            {net !== 0 ? net.toLocaleString('vi-VN') : '0'}
                          </td>
                        );
                      })}
                      {(() => {
                        const totRec = detailReceipts.reduce((sum, r) => sum + r.totalQty, 0);
                        const totIss = detailIssues.reduce((sum, i) => sum + i.totalQty, 0);
                        const grandNet = totRec - totIss;
                        return (
                          <td className="p-2 border-r border-slate-300 text-right font-mono font-extrabold text-xs text-emerald-950 bg-emerald-200/80">
                            {grandNet.toLocaleString('vi-VN')}
                          </td>
                        );
                      })()}
                      <td className="p-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                          Khả dụng
                        </span>
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Code Vật tư</th>
                  <th className="p-2 border-r border-slate-300 min-w-[140px]">Diễn Giải (Tên VT)</th>
                  <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 min-w-[170px]">Luồng Vật Tư</th>

                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-slate-100 text-slate-800"
                    >
                      Size {s}
                    </th>
                  ))}

                  <th className="p-2 border-r border-slate-300 min-w-[85px] text-right font-bold bg-slate-100 text-slate-900">
                    TỔNG CỘNG
                  </th>
                  <th className="p-2 text-center min-w-[95px]">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={7 + sizes.length + 1} className="p-8 text-center text-slate-400 text-xs italic">
                      Chưa có vật tư nào được nhập vào kho cho khách hàng này.
                    </td>
                  </tr>
                ) : (
                  filteredStockItems.map((item, idx) => (
                    <React.Fragment key={item.key}>
                      {/* Row 1: Thực Nhận (Tab 2) */}
                      <tr className="bg-white hover:bg-slate-50/50">
                        <td
                          rowSpan={4}
                          className="p-2 border-r border-slate-300 text-center font-mono text-[11px] text-slate-400 bg-slate-50 font-bold align-middle"
                        >
                          {idx + 1}
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 font-mono font-bold text-sky-700 align-middle">
                          {item.poNumber}
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 font-mono font-bold text-slate-900 align-middle">
                          {item.itemCode}
                        </td>
                        {/* Dropdown chọn Tên Vật Tư trong PO đó */}
                        <td rowSpan={4} className="p-2 border-r border-slate-300 text-slate-700 align-middle">
                          {(() => {
                            const materials = getPoMaterials(item.poNumber);
                            if (materials.length > 0) {
                              return (
                                <select
                                  value={item.description}
                                  onChange={() => {}}
                                  className="w-full text-xs border border-slate-300 rounded px-1.5 py-1 bg-white focus:ring-1 focus:ring-sky-500 font-medium text-slate-800 cursor-pointer"
                                >
                                  {materials.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                  {!materials.includes(item.description) && item.description && (
                                    <option value={item.description}>{item.description}</option>
                                  )}
                                </select>
                              );
                            }
                            return <span className="font-medium">{item.description || '-'}</span>;
                          })()}
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 text-center text-slate-500 align-middle">
                          {item.unit}
                        </td>

                        {/* Sub-row 1 */}
                        <td className="p-1.5 border-r border-slate-200 text-slate-600 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>1. Thực Nhận (Tab 2)</span>
                        </td>
                        {sizes.map((s) => {
                          const q = item.receivedSizes[s] || 0;
                          return (
                            <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-slate-700">
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800 bg-slate-50/50">
                        {item.totalReceived.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 text-center text-[10px] text-slate-500">
                        Nhập kho
                      </td>
                    </tr>

                    {/* Row 2: Xuất Sản Xuất (Tab 6) */}
                    <tr className="bg-sky-50/20 hover:bg-sky-50/40">
                      <td className="p-1.5 border-r border-slate-200 text-sky-800 font-medium flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                        <span>2. Xuất Sản Xuất (Tab 6)</span>
                      </td>
                      {sizes.map((s) => {
                        const q = item.productionIssuedSizes[s] || 0;
                        return (
                          <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-sky-800">
                            {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                          </td>
                        );
                      })}
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-sky-900 bg-sky-50/50">
                        {item.totalProductionIssued.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                          Xuất SX
                        </span>
                      </td>
                    </tr>

                    {/* Row 3: Xuất Bù (Cho phép nhập trực tiếp số lượng khi có đợt cấp bù) */}
                    <tr className="bg-purple-50/40 hover:bg-purple-50/60 transition-colors">
                      <td className="p-1.5 border-r border-slate-200 text-purple-900 font-semibold flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                          <span>3. Xuất Bù (Hỏng / Thiếu)</span>
                        </div>
                        <span className="text-[10px] text-purple-700 bg-purple-100 px-1 py-0.5 rounded font-mono font-bold">
                          Nhập bù ✍️
                        </span>
                      </td>
                      {sizes.map((s) => {
                        const q = item.damagedCompSizes[s];
                        const displayVal = q && q > 0 ? q : '';
                        return (
                          <td
                            key={s}
                            className="p-0 border-r border-slate-200 text-center bg-white focus-within:ring-2 focus-within:ring-purple-500 focus-within:z-10"
                          >
                            <input
                              type="number"
                              min="0"
                              value={displayVal}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0);
                                updateStockCompensation(item.poNumber, item.itemCode, s, val);
                              }}
                              placeholder="-"
                              title={`Nhập SL Xuất bù Size ${s} cho PO ${item.poNumber}`}
                              className="w-full h-7 text-center font-mono font-bold text-xs text-purple-900 bg-transparent border-0 focus:outline-none focus:bg-purple-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>
                        );
                      })}
                      <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-xs text-purple-900 bg-purple-100/70">
                        {item.totalDamagedComp > 0 ? item.totalDamagedComp.toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="p-1.5 text-center">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.totalDamagedComp > 0
                              ? 'bg-purple-200 text-purple-900'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.totalDamagedComp > 0 ? 'Đã xuất bù' : 'Chưa bù'}
                        </span>
                      </td>
                    </tr>

                    {/* Row 4: TỒN KHO CÒN LẠI */}
                    <tr className="bg-emerald-50/60 font-bold border-b-2 border-slate-300">
                      <td className="p-2 border-r border-slate-200 text-emerald-950 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <span>4. TỒN KHO CÒN LẠI</span>
                      </td>
                      {sizes.map((s) => {
                        const stock = item.currentStockSizes[s] || 0;
                        return (
                          <td
                            key={s}
                            className={`p-2 border-r border-slate-200 text-center font-mono font-bold text-xs ${
                              stock <= 0
                                ? 'text-slate-400 bg-slate-100/50'
                                : 'text-emerald-900 bg-emerald-100/60'
                            }`}
                          >
                            {stock !== 0 ? stock.toLocaleString('vi-VN') : '0'}
                          </td>
                        );
                      })}
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-extrabold text-xs text-emerald-950 bg-emerald-200/60">
                        {item.totalCurrentStock.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 text-center">
                        {item.totalCurrentStock > 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-2xs">
                            Còn tồn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                            Hết kho
                          </span>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}

              {/* Total Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={6} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG TOÀN KHO HIỆN CÒN:
                </td>
                {sizes.map((s) => {
                  const sumSize = filteredStockItems.reduce(
                    (sum, i) => sum + (i.currentStockSizes[s] || 0),
                    0
                  );
                  return (
                    <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-900">
                      {sumSize !== 0 ? sumSize.toLocaleString('vi-VN') : '0'}
                    </td>
                  );
                })}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-extrabold text-xs text-emerald-900">
                  {overallTotals.currentStock.toLocaleString('vi-VN')}
                </td>
                <td className="p-2 text-center text-slate-500 text-[11px] italic">
                  Tổng {filteredStockItems.length} mã
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        )}

        {/* Footer info bar */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 Hàng <strong>"3. Xuất Bù"</strong> cho phép nhập trực tiếp số lượng khi có đợt cấp bù. Số tồn kho còn lại sẽ tự động trừ lùi theo thời gian thực.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng tồn khả dụng: <strong className="text-emerald-700">{overallTotals.currentStock.toLocaleString('vi-VN')}</strong> đơn vị
          </div>
        </div>
      </div>

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="BẢNG TỒN KHO VẬT TƯ THỜI GIAN THỰC (TAB 5)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="05-TK/REALTIME"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
