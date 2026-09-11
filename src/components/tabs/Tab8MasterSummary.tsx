import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  Printer,
  Download,
  Search,
  BarChart3,
  Scale,
  Warehouse,
  FileSpreadsheet,
  PackageCheck,
  Factory,
  Layers,
  Table,
  Filter,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

export const Tab8MasterSummary: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    currentCustomerRealtimeStock,
    currentCustomerProductionIssues,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEGATIVE_ONLY' | 'HAS_STOCK_ONLY'>('ALL');
  const [viewMode, setViewMode] = useState<'MATRIX' | 'FLAT'>('MATRIX');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Combine data per PO + itemCode
  const summaryRows = useMemo(() => {
    return currentCustomerPlanOrders.map((plan, idx) => {
      const key = `${plan.poNumber.trim().toUpperCase()}__${plan.itemCode.trim().toUpperCase()}`;
      
      // Actual Receive (Tab 2)
      const actual = currentCustomerActualReceives.find((a) => a.planOrderId === plan.id);
      const actualSizes = actual?.sizeQuantities || {};
      const actualTotal = actual?.totalQty || 0;

      // Discrepancy (Tab 3)
      const diffSizes: Record<string, number> = {};
      let hasNegative = false;
      let diffTotal = 0;
      sizes.forEach((s) => {
        const pVal = typeof plan.sizeQuantities[s] === 'number' ? Number(plan.sizeQuantities[s]) : 0;
        const aVal = typeof actualSizes[s] === 'number' ? Number(actualSizes[s]) : 0;
        const diff = aVal - pVal;
        diffSizes[s] = diff;
        diffTotal += diff;
        if (diff < 0) hasNegative = true;
      });

      // Stock item (Tab 5)
      const stockItem = currentCustomerRealtimeStock.find((st) => st.key === key);
      const stockSizes = stockItem?.currentStockSizes || {};
      const stockTotal = stockItem?.totalCurrentStock || 0;
      const prodIssuedTotal = stockItem?.totalProductionIssued || 0;
      const compTotal = stockItem?.totalDamagedComp || 0;

      return {
        id: plan.id,
        stt: idx + 1,
        date: plan.receiptDate,
        poNumber: plan.poNumber,
        itemCode: plan.itemCode,
        voucherCode: plan.voucherCode,
        description: plan.description,
        unit: plan.unit,
        
        // 1. Trên phiếu
        planSizes: plan.sizeQuantities,
        planTotal: plan.totalQty,

        // 2. Thực tế
        actualSizes,
        actualTotal,

        // 3. Chênh lệch
        diffSizes,
        diffTotal,
        hasNegative,

        // 4. Xuất sản xuất & bù
        prodIssuedTotal,
        compTotal,

        // 5. Tồn kho còn lại
        stockSizes,
        stockTotal,
      };
    });
  }, [
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    currentCustomerRealtimeStock,
    sizes,
  ]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return summaryRows.filter((r) => {
      const matchSearch =
        !searchQuery.trim() ||
        r.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.voucherCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterMode === 'NEGATIVE_ONLY') return r.hasNegative;
      if (filterMode === 'HAS_STOCK_ONLY') return r.stockTotal > 0;
      return true;
    });
  }, [summaryRows, searchQuery, filterMode]);

  // Overall totals for KPI cards
  const kpiTotals = useMemo(() => {
    let totalPlan = 0;
    let totalActual = 0;
    let totalDiff = 0;
    let totalStock = 0;
    let totalIssued = 0;
    let negativeCount = 0;

    summaryRows.forEach((r) => {
      totalPlan += r.planTotal;
      totalActual += r.actualTotal;
      totalDiff += r.diffTotal;
      totalStock += r.stockTotal;
      totalIssued += r.prodIssuedTotal;
      if (r.hasNegative) negativeCount++;
    });

    const receivedRatio = totalPlan > 0 ? ((totalActual / totalPlan) * 100).toFixed(1) : '0';

    return {
      totalPlan,
      totalActual,
      totalDiff,
      totalStock,
      totalIssued,
      negativeCount,
      receivedRatio,
    };
  }, [summaryRows]);

  // Export Excel
  const handleExportExcel = () => {
    if (filteredRows.length === 0) {
      alert('Không có dữ liệu để xuất Excel.');
      return;
    }

    const headers = [
      'STT',
      'Ngày Nhập',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Số Phiếu KH',
      'Diễn Giải',
      'ĐVT',
      'Chỉ Số Đối Soát & Tồn',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng Cộng',
    ];

    const dataRows: any[] = [];
    let stt = 1;

    filteredRows.forEach((r) => {
      // Line 1: Số Trên Phiếu
      dataRows.push([
        stt,
        r.date,
        r.poNumber,
        r.itemCode,
        r.voucherCode,
        r.description,
        r.unit,
        '1. Số Trên Phiếu (Tab 1)',
        ...sizes.map((s) => r.planSizes[s] || 0),
        r.planTotal,
      ]);

      // Line 2: Số Thực Tế
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '2. Số Thực Tế (Tab 2)',
        ...sizes.map((s) => r.actualSizes[s] || 0),
        r.actualTotal,
      ]);

      // Line 3: Số Chênh Lệch
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '3. Số Chênh Lệch (Tab 3 = 2 - 1)',
        ...sizes.map((s) => r.diffSizes[s] || 0),
        r.diffTotal,
      ]);

      // Line 4: Số Tồn Kho Còn Lại
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '4. Số Tồn Kho Còn Lại (Tab 5)',
        ...sizes.map((s) => r.stockSizes[s] || 0),
        r.stockTotal,
      ]);

      stt++;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ThongKeTongHop_Tab8');
    XLSX.writeFile(wb, `Tab8_ThongKeTongHop_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print HTML preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    return filteredRows.map((r, idx) => ({
      stt: idx + 1,
      date: r.date,
      poNumber: r.poNumber,
      code: r.itemCode,
      voucherCode: r.voucherCode,
      description: r.description,
      unit: r.unit,
      sizeQuantities: r.stockSizes,
      totalQty: r.stockTotal,
      note: `Phiếu: ${r.planTotal} | Thực: ${r.actualTotal} | Lệch: ${r.diffTotal > 0 ? `+${r.diffTotal}` : r.diffTotal} | Tồn: ${r.stockTotal}`,
    }));
  }, [filteredRows]);

  return (
    <div className="space-y-4">
      {/* 5 KPI Stat Cards Header */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-sky-600" />
              <span>TAB 8: BẢNG THỐNG KÊ TỔNG HỢP (PHIẾU - THỰC TẾ - CHÊNH LỆCH - TỒN KHO)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Master Reconciliation &amp; Live Stock Overview
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            {/* View Mode Switcher */}
            <div className="flex bg-slate-100 p-0.5 rounded border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
                  viewMode === 'MATRIX'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Chi Tiết Dải Size</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('FLAT')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition ${
                  viewMode === 'FLAT'
                    ? 'bg-white text-sky-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Rút Gọn 1 Dòng</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In Bảng Tổng Hợp</span>
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

        {/* 5 KPI Stat Cards */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* 1. Kế hoạch trên phiếu */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                1. Trên Phiếu (Tab 1)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                Kế hoạch
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-slate-800 mt-1">
              {kpiTotals.totalPlan.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Số lượng hợp đồng</span>
          </div>

          {/* 2. Thực tế nhận */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                2. Thực Tế (Tab 2)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                {kpiTotals.receivedRatio}%
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-emerald-700 mt-1">
              {kpiTotals.totalActual.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Kho thực nhận</span>
          </div>

          {/* 3. Chênh lệch */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                3. Chênh Lệch (Tab 3)
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  kpiTotals.negativeCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {kpiTotals.negativeCount > 0 ? `${kpiTotals.negativeCount} mã thiếu` : 'Khớp đủ'}
              </span>
            </div>
            <p
              className={`text-lg font-mono font-bold mt-1 ${
                kpiTotals.totalDiff < 0 ? 'text-rose-600' : kpiTotals.totalDiff > 0 ? 'text-blue-600' : 'text-slate-800'
              }`}
            >
              {kpiTotals.totalDiff > 0 ? `+${kpiTotals.totalDiff.toLocaleString('vi-VN')}` : kpiTotals.totalDiff.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Thực nhận - Phiếu</span>
          </div>

          {/* 4. Đã Xuất Sản Xuất */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Xuất Cho SX (Tab 6)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                Đã cấp
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-sky-700 mt-1">
              {kpiTotals.totalIssued.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Cấp phát Chuyền</span>
          </div>

          {/* 5. Tồn kho còn lại */}
          <div className="bg-white p-2.5 rounded-lg border border-emerald-300 shadow-2xs bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider">
                4. TỒN KHO CÒN LẠI
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-200 text-emerald-900">
                Khả dụng
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-emerald-900 mt-1">
              {kpiTotals.totalStock.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-emerald-700">Sẵn sàng sử dụng</span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center flex-wrap gap-2">
            <div className="relative w-56 sm:w-64">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng, diễn giải..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({summaryRows.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('NEGATIVE_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'NEGATIVE_ONLY'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Có lệch âm ({kpiTotals.negativeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('HAS_STOCK_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'HAS_STOCK_ONLY'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Còn tồn kho
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-mono text-slate-600">
              Khách hàng: <strong className="text-slate-900">{currentCustomer?.name || 'Mặc định'}</strong>
            </span>
          </div>
        </div>

        {/* VIEW 1: MATRIX VIEW (CHI TIẾT DẢI SIZE) */}
        {viewMode === 'MATRIX' && (
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT)</th>
                  <th className="p-2 border-r border-slate-300 min-w-[140px]">Diễn Giải</th>
                  <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 min-w-[185px] bg-slate-100 text-slate-800">
                    Chỉ Số Nghiệp Vụ
                  </th>

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
                  <th className="p-2 text-center min-w-[90px] bg-slate-100 text-slate-800">
                    TÌNH TRẠNG
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6 + sizes.length + 2} className="p-8 text-center text-slate-400 text-xs italic">
                      Không tìm thấy đơn hàng nào phù hợp với bộ lọc!
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <React.Fragment key={row.id}>
                      {/* Row 1: Số Trên Phiếu */}
                      <tr className="bg-slate-50/50 hover:bg-slate-100/50 border-t border-slate-300">
                        <td rowSpan={4} className="p-2 border-r border-slate-300 text-center font-mono text-slate-500 font-bold bg-slate-50/80 align-middle">
                          {row.stt}
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 font-mono font-bold text-sky-700 bg-slate-50/80 align-middle">
                          {row.poNumber}
                          <div className="text-[10px] text-slate-400 font-normal font-sans">
                            {row.voucherCode ? `Số: ${row.voucherCode}` : row.date}
                          </div>
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 font-mono font-bold text-slate-800 bg-slate-50/80 align-middle">
                          {row.itemCode}
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 text-slate-600 bg-slate-50/80 align-middle max-w-[160px] truncate" title={row.description}>
                          {row.description}
                        </td>
                        <td rowSpan={4} className="p-2 border-r border-slate-300 text-center text-slate-500 bg-slate-50/80 align-middle font-mono">
                          {row.unit}
                        </td>

                        <td className="p-1.5 border-r border-slate-200 text-slate-700 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                          <span>1. Số Trên Phiếu (Tab 1)</span>
                        </td>
                        {sizes.map((s) => {
                          const q = row.planSizes[s] || 0;
                          return (
                            <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-slate-700">
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800 bg-slate-100/50">
                          {row.planTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            Kế hoạch
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: Số Thực Tế (Thực Nhận) */}
                      <tr className="bg-emerald-50/20 hover:bg-emerald-50/40">
                        <td className="p-1.5 border-r border-slate-200 text-emerald-800 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>2. Số Thực Tế (Tab 2)</span>
                        </td>
                        {sizes.map((s) => {
                          const q = row.actualSizes[s] || 0;
                          return (
                            <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-emerald-800 font-semibold">
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-900 bg-emerald-50/60">
                          {row.actualTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Thực nhận
                          </span>
                        </td>
                      </tr>

                      {/* Row 3: Số Chênh Lệch */}
                      <tr className={row.hasNegative ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'bg-slate-50/20 hover:bg-slate-50/40'}>
                        <td className="p-1.5 border-r border-slate-200 font-medium flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${row.hasNegative ? 'bg-rose-500' : 'bg-slate-400'}`}></span>
                          <span className={row.hasNegative ? 'text-rose-800 font-bold' : 'text-slate-700'}>
                            3. Số Chênh Lệch (Tab 3)
                          </span>
                        </td>
                        {sizes.map((s) => {
                          const diff = row.diffSizes[s] || 0;
                          return (
                            <td
                              key={s}
                              className={`p-1.5 border-r border-slate-200 text-center font-mono font-bold ${
                                diff < 0
                                  ? 'bg-rose-100 text-rose-700'
                                  : diff > 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {diff !== 0 ? (diff > 0 ? `+${diff}` : diff) : '-'}
                            </td>
                          );
                        })}
                        <td
                          className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${
                            row.diffTotal < 0
                              ? 'bg-rose-100 text-rose-700'
                              : row.diffTotal > 0
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {row.diffTotal !== 0 ? (row.diffTotal > 0 ? `+${row.diffTotal}` : row.diffTotal) : '0'}
                        </td>
                        <td className="p-1.5 text-center">
                          {row.hasNegative ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 animate-pulse">
                              Cần bù KH
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                              Khớp đủ
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Row 4: Số Tồn Kho Còn Lại */}
                      <tr className="bg-emerald-50/50 hover:bg-emerald-50/70 font-bold border-b-2 border-slate-300">
                        <td className="p-2 border-r border-slate-200 text-emerald-950 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>4. TỒN KHO CÒN LẠI (Tab 5)</span>
                        </td>
                        {sizes.map((s) => {
                          const stock = row.stockSizes[s] || 0;
                          return (
                            <td
                              key={s}
                              className={`p-2 border-r border-slate-200 text-center font-mono font-bold text-xs ${
                                stock > 0
                                  ? 'text-emerald-950 bg-emerald-100/40'
                                  : stock < 0
                                  ? 'text-rose-700 bg-rose-100/60'
                                  : 'text-slate-400'
                              }`}
                            >
                              {stock !== 0 ? stock.toLocaleString('vi-VN') : '0'}
                            </td>
                          );
                        })}
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-extrabold text-xs text-emerald-950 bg-emerald-200/50">
                          {row.stockTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.stockTotal > 0
                                ? 'bg-emerald-200 text-emerald-900'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {row.stockTotal > 0 ? 'Còn tồn' : 'Hết tồn'}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))
                )}

                {/* Footer Total */}
                <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                  <td colSpan={6} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    TỔNG CỘNG TOÀN BỘ TỒN KHO HIỆN CÒN:
                  </td>
                  {sizes.map((s) => {
                    const sumSize = filteredRows.reduce((sum, r) => sum + (r.stockSizes[s] || 0), 0);
                    return (
                      <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-900">
                        {sumSize !== 0 ? sumSize.toLocaleString('vi-VN') : '0'}
                      </td>
                    );
                  })}
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-extrabold text-xs text-emerald-900">
                    {kpiTotals.totalStock.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 text-center text-slate-500 text-[11px] italic">
                    Tổng {filteredRows.length} mã
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW 2: FLAT VIEW (BẢNG RÚT GỌN 1 DÒNG) */}
        {viewMode === 'FLAT' && (
          <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                  <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                  <th className="p-2 border-r border-slate-300 min-w-[125px]">Mã Hàng (TT)</th>
                  <th className="p-2 border-r border-slate-300 min-w-[140px]">Diễn Giải</th>
                  <th className="p-2 border-r border-slate-300 text-center w-12">ĐVT</th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[90px] bg-slate-100 text-slate-800">
                    1. SL Phiếu
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-emerald-50 text-emerald-900">
                    2. Thực Nhận
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-slate-100 text-slate-900">
                    3. Chênh Lệch
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-sky-50 text-sky-900">
                    Xuất Cho SX
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-emerald-100 text-emerald-950 font-bold">
                    4. TỒN KHO
                  </th>
                  <th className="p-2 text-center min-w-[90px]">
                    TÌNH TRẠNG
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 text-xs italic">
                      Không tìm thấy đơn hàng nào!
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 border-r border-slate-200 text-center text-slate-500 font-mono">
                        {r.stt}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700">
                        {r.poNumber}
                      </td>
                      <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-800">
                        {r.itemCode}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-slate-600 max-w-[180px] truncate" title={r.description}>
                        {r.description}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-center text-slate-500 font-mono">
                        {r.unit}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-semibold text-slate-800 bg-slate-50/50">
                        {r.planTotal.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                        {r.actualTotal.toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 text-right font-mono font-bold ${
                          r.diffTotal < 0
                            ? 'bg-rose-50 text-rose-700'
                            : r.diffTotal > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'text-slate-500'
                        }`}
                      >
                        {r.diffTotal !== 0 ? (r.diffTotal > 0 ? `+${r.diffTotal}` : r.diffTotal) : '0'}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-semibold text-sky-800 bg-sky-50/30">
                        {r.prodIssuedTotal.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-950 bg-emerald-100/50">
                        {r.stockTotal.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 text-center">
                        {r.hasNegative ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Cần bù KH
                          </span>
                        ) : r.stockTotal > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Còn tồn
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            Đã hết tồn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}

                {/* Footer Total */}
                <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                  <td colSpan={5} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                    TỔNG CỘNG TẤT CẢ ĐƠN HÀNG:
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900">
                    {kpiTotals.totalPlan.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-emerald-800">
                    {kpiTotals.totalActual.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900">
                    {kpiTotals.totalDiff !== 0 ? (kpiTotals.totalDiff > 0 ? `+${kpiTotals.totalDiff}` : kpiTotals.totalDiff) : '0'}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-sky-800">
                    {kpiTotals.totalIssued.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-extrabold text-emerald-950">
                    {kpiTotals.totalStock.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 text-center text-slate-500 text-[11px] italic">
                    {filteredRows.length} đơn
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info bar */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 Bảng thống kê đối chiếu liên hoàn: <strong>1. Trên Phiếu</strong> ➔ <strong>2. Thực Tế</strong> ➔ <strong>3. Chênh Lệch</strong> ➔ <strong>4. Tồn Kho</strong>.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng tồn khả dụng: <strong className="text-emerald-700">{kpiTotals.totalStock.toLocaleString('vi-VN')}</strong> đơn vị
          </div>
        </div>
      </div>

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="BẢNG THỐNG KÊ TỔNG HỢP GIAO NHẬN, ĐỐI SOÁT &amp; TỒN KHO (TAB 8)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="08-TK/TONGHOP"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
