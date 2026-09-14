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
  Truck,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

export const Tab8MasterSummary: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    currentCustomerRealtimeStock,
    currentCustomerProductionIssues,
    currentCustomerFinishedGoodsStock,
    currentCustomerFinishedGoodsDeliveries,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'NEEDED_ONLY' | 'HAS_STOCK_ONLY'>('ALL');
  const [viewMode, setViewMode] = useState<'MATRIX' | 'FLAT'>('MATRIX');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Helper coloring for Row 2: Số đã xuất
  // "khi nào còn thiếu thì màu đỏ, đủ thì số màu xanh,xuất dư thì số màu xanh dương"
  const getIssuedCellClass = (issued: number, order: number) => {
    if (order === 0 && issued === 0) {
      return 'text-slate-400 font-normal';
    }
    if (issued < order) {
      // Còn thiếu: MÀU ĐỎ
      return 'text-rose-600 font-bold bg-rose-50/70 border-rose-200';
    }
    if (issued === order) {
      // Đủ: SỐ MÀU XANH (xanh lá)
      return 'text-emerald-600 font-bold bg-emerald-50/70 border-emerald-200';
    }
    // Xuất dư: SỐ MÀU XANH DƯƠNG
    return 'text-blue-600 font-bold bg-blue-50/70 border-blue-200';
  };

  const getIssuedTotalClass = (issued: number, order: number) => {
    if (order === 0 && issued === 0) {
      return 'text-slate-400 font-bold bg-slate-100/50';
    }
    if (issued < order) {
      return 'text-rose-600 font-bold bg-rose-100/60';
    }
    if (issued === order) {
      return 'text-emerald-600 font-bold bg-emerald-100/60';
    }
    return 'text-blue-600 font-bold bg-blue-100/60';
  };

  const getIssuedBadge = (issued: number, order: number) => {
    if (order === 0 && issued === 0) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">Chưa đặt</span>;
    }
    if (issued < order) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
          Thiếu {order - issued}
        </span>
      );
    }
    if (issued === order) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
          Đã đủ
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
        Dư +{issued - order}
      </span>
    );
  };

  // Combine data per PO + itemCode
  const summaryRows = useMemo(() => {
    return currentCustomerPlanOrders.map((plan, idx) => {
      const poNum = plan.poNumber.trim().toUpperCase();
      const itemCd = (plan.itemCode || '').trim().toUpperCase();
      const key = `${poNum}__${itemCd}`;

      // 1. Số trên đơn hàng gốc (đọc từ bảng quản lý đơn hàng trong Khách hàng và dải size)
      const originalPO = currentCustomerPOs.find(
        (p) => p.poNumber.trim().toUpperCase() === poNum
      );

      const orderSizes: Record<string, number> = {};
      let orderTotal = 0;

      sizes.forEach((s) => {
        let val = 0;
        if (originalPO?.sizeQuantities && typeof originalPO.sizeQuantities[s] === 'number') {
          val = Number(originalPO.sizeQuantities[s]);
        } else if (typeof plan.sizeQuantities[s] === 'number') {
          val = Number(plan.sizeQuantities[s]);
        }
        orderSizes[s] = val;
        orderTotal += val;
      });

      if (orderTotal === 0) {
        if (originalPO && originalPO.targetQty > 0) {
          orderTotal = originalPO.targetQty;
        } else if (plan.totalQty > 0) {
          orderTotal = plan.totalQty;
        }
      }

      // Stock item (Tab 5)
      const stockItem =
        currentCustomerRealtimeStock.find((st) => st.key === key) ||
        currentCustomerRealtimeStock.find((st) => st.poNumber.trim().toUpperCase() === poNum);

      // 2. Số đã xuất: Đọc trực tiếp từ dòng TỔNG CỘNG ĐÃ XUẤT trong Tab 8 (Kho & Xuất Thành Phẩm) theo mỗi PO
      let poDeliveries = currentCustomerFinishedGoodsDeliveries.filter(
        (d) =>
          d.poNumber.trim().toUpperCase() === poNum &&
          itemCd &&
          d.itemCode &&
          d.itemCode.trim().toUpperCase() === itemCd
      );

      // Nếu không khớp cả mã hàng, lấy theo mã PO
      if (poDeliveries.length === 0) {
        poDeliveries = currentCustomerFinishedGoodsDeliveries.filter(
          (d) => d.poNumber.trim().toUpperCase() === poNum
        );
      }

      // Đối chiếu thêm với currentCustomerFinishedGoodsStock (nơi lưu trữ tồn kho TP tổng hợp theo PO)
      const fgStockItem =
        currentCustomerFinishedGoodsStock.find(
          (fg) =>
            fg.poNumber.trim().toUpperCase() === poNum &&
            itemCd &&
            fg.itemCode &&
            fg.itemCode.trim().toUpperCase() === itemCd
        ) ||
        currentCustomerFinishedGoodsStock.find(
          (fg) => fg.poNumber.trim().toUpperCase() === poNum
        );

      const issuedSizes: Record<string, number> = {};
      let issuedTotal = 0;

      sizes.forEach((s) => {
        let val = 0;
        if (poDeliveries.length > 0) {
          val = poDeliveries.reduce((sum, d) => sum + (Number(d.sizeQuantities?.[s]) || 0), 0);
        } else if (fgStockItem?.deliveredSizes && typeof fgStockItem.deliveredSizes[s] === 'number') {
          val = Number(fgStockItem.deliveredSizes[s]) || 0;
        }
        issuedSizes[s] = val;
        issuedTotal += val;
      });

      if (issuedTotal === 0) {
        if (poDeliveries.length > 0) {
          issuedTotal = poDeliveries.reduce((sum, d) => sum + (Number(d.totalQty) || 0), 0);
        } else if (fgStockItem && fgStockItem.totalDelivered > 0) {
          issuedTotal = fgStockItem.totalDelivered;
        }
      }

      // 3. Số còn cần xuất = Số trên đơn hàng gốc - Số đã xuất (đọc từ Tab 8)
      const neededSizes: Record<string, number> = {};
      let neededTotal = 0;
      sizes.forEach((s) => {
        const ord = orderSizes[s] || 0;
        const iss = issuedSizes[s] || 0;
        const need = Math.max(0, ord - iss);
        neededSizes[s] = need;
        neededTotal += need;
      });
      if (orderTotal > 0 && neededTotal === 0 && issuedTotal < orderTotal) {
        neededTotal = Math.max(0, orderTotal - issuedTotal);
      }

      // 4. Số còn tồn chưa xuất: Đọc trực tiếp từ dòng TỒN KHO TP HIỆN TẠI trong Tab 8 theo mỗi PO
      const stockSizes: Record<string, number> = {};
      let stockTotal = 0;
      sizes.forEach((s) => {
        let st = 0;
        if (fgStockItem) {
          const inQ = Number(fgStockItem.inboundSizes?.[s]) || 0;
          const outQ = typeof issuedSizes[s] === 'number' ? issuedSizes[s] : (Number(fgStockItem.deliveredSizes?.[s]) || 0);
          st = inQ - outQ;
        }
        stockSizes[s] = st;
        stockTotal += st;
      });

      if (fgStockItem && typeof fgStockItem.totalInbound === 'number') {
        stockTotal = fgStockItem.totalInbound - issuedTotal;
      } else if (fgStockItem && typeof fgStockItem.totalStock === 'number') {
        stockTotal = fgStockItem.totalStock;
      }

      return {
        id: plan.id,
        stt: idx + 1,
        date: plan.receiptDate,
        poNumber: plan.poNumber,
        itemCode: plan.itemCode,
        voucherCode: plan.voucherCode,
        description: plan.description,
        unit: plan.unit,

        // 4 chỉ số nghiệp vụ chính
        orderSizes,
        orderTotal,

        issuedSizes,
        issuedTotal,

        neededSizes,
        neededTotal,

        stockSizes,
        stockTotal,
      };
    });
  }, [
    currentCustomerPlanOrders,
    currentCustomerPOs,
    currentCustomerRealtimeStock,
    currentCustomerFinishedGoodsDeliveries,
    currentCustomerFinishedGoodsStock,
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

      if (filterMode === 'NEEDED_ONLY') return r.neededTotal > 0;
      if (filterMode === 'HAS_STOCK_ONLY') return r.stockTotal > 0;
      return true;
    });
  }, [summaryRows, searchQuery, filterMode]);

  // Overall totals for KPI cards
  const kpiTotals = useMemo(() => {
    let totalOrder = 0;
    let totalIssued = 0;
    let totalNeeded = 0;
    let totalStock = 0;
    let pendingCount = 0;

    summaryRows.forEach((r) => {
      totalOrder += r.orderTotal;
      totalIssued += r.issuedTotal;
      totalNeeded += r.neededTotal;
      totalStock += r.stockTotal;
      if (r.neededTotal > 0) pendingCount++;
    });

    const issuedRatio = totalOrder > 0 ? ((totalIssued / totalOrder) * 100).toFixed(1) : '0';

    return {
      totalOrder,
      totalIssued,
      totalNeeded,
      totalStock,
      pendingCount,
      issuedRatio,
    };
  }, [summaryRows]);

  // Finished Goods Overall Totals
  const fgSummary = useMemo(() => {
    let totalInbound = 0;
    let totalDelivered = 0;
    let totalStock = 0;
    currentCustomerFinishedGoodsStock.forEach((fg) => {
      totalInbound += fg.totalInbound;
      totalDelivered += fg.totalDelivered;
      totalStock += fg.totalStock;
    });
    return {
      totalInbound,
      totalDelivered,
      totalStock,
      skuCount: currentCustomerFinishedGoodsStock.length,
    };
  }, [currentCustomerFinishedGoodsStock]);

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
      // Line 1: Số trên đơn hàng gốc
      dataRows.push([
        stt,
        r.date,
        r.poNumber,
        r.itemCode,
        r.voucherCode,
        r.description,
        r.unit,
        '1. Số trên đơn hàng gốc',
        ...sizes.map((s) => r.orderSizes[s] || 0),
        r.orderTotal,
      ]);

      // Line 2: Số đã xuất
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '2. Số đã xuất',
        ...sizes.map((s) => r.issuedSizes[s] || 0),
        r.issuedTotal,
      ]);

      // Line 3: Số còn cần xuất
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '3. Số còn cần xuất',
        ...sizes.map((s) => r.neededSizes[s] || 0),
        r.neededTotal,
      ]);

      // Line 4: Số còn tồn chưa xuất
      dataRows.push([
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '4. Số còn tồn chưa xuất',
        ...sizes.map((s) => r.stockSizes[s] || 0),
        r.stockTotal,
      ]);

      stt++;
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ThongKeTongHop_Tab9');
    XLSX.writeFile(wb, `Tab9_ThongKeTongHop_${currentCustomer?.name || 'KhachHang'}.xlsx`);
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
      note: `Đơn gốc: ${r.orderTotal} | Đã xuất: ${r.issuedTotal} | Cần xuất: ${r.neededTotal} | Tồn chưa xuất: ${r.stockTotal}`,
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
              <span>TAB 9: BẢNG THỐNG KÊ TỔNG HỢP (ĐƠN GỐC - ĐÃ XUẤT - CÒN CẦN XUẤT - TỒN CHƯA XUẤT)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Quản lý xuất vật tư theo đơn hàng gốc &amp; kiểm soát tồn kho khả dụng
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

        {/* 4 KPI Stat Cards theo đúng 4 chỉ số */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Số trên đơn hàng gốc */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                1. Đơn Hàng Gốc (PO)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700">
                Kế hoạch gốc
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-slate-800 mt-1">
              {kpiTotals.totalOrder.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Số lượng trên đơn hàng gốc</span>
          </div>

          {/* 2. Số đã xuất */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                2. Số Đã Xuất
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                {kpiTotals.issuedRatio}%
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-sky-700 mt-1">
              {kpiTotals.totalIssued.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Tổng đã xuất giao từ Tab 8</span>
          </div>

          {/* 3. Số còn cần xuất */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                3. Còn Cần Xuất
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  kpiTotals.totalNeeded > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {kpiTotals.totalNeeded > 0 ? `${kpiTotals.pendingCount} mã cần xuất` : 'Đã xuất đủ'}
              </span>
            </div>
            <p
              className={`text-lg font-mono font-bold mt-1 ${
                kpiTotals.totalNeeded > 0 ? 'text-amber-700' : 'text-slate-800'
              }`}
            >
              {kpiTotals.totalNeeded.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-slate-400">Đơn gốc - Đã xuất</span>
          </div>

          {/* 4. Số còn tồn chưa xuất */}
          <div className="bg-white p-2.5 rounded-lg border border-emerald-300 shadow-2xs bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider">
                4. Tồn Chưa Xuất
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-200 text-emerald-900">
                Khả dụng
              </span>
            </div>
            <p className="text-lg font-mono font-bold text-emerald-900 mt-1">
              {kpiTotals.totalStock.toLocaleString('vi-VN')}
            </p>
            <span className="text-[10px] text-emerald-700">Tồn kho TP hiện tại (Tab 8)</span>
          </div>
        </div>

        {/* Finished Goods Summary Bar */}
        <div className="p-2.5 bg-indigo-50/50 border-b border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-indigo-100 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Factory className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-500">TP Nhập Kho Từ Chuyền (Tab 7)</div>
              <div className="text-sm font-mono font-bold text-indigo-900">{fgSummary.totalInbound.toLocaleString('vi-VN')} đôi</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-indigo-100 shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Truck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-slate-500">TP Đã Xuất Giao Khách (Tab 8)</div>
              <div className="text-sm font-mono font-bold text-sky-900">{fgSummary.totalDelivered.toLocaleString('vi-VN')} đôi</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-md border border-emerald-200 shadow-2xs bg-emerald-50/30">
            <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <PackageCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-emerald-800">Tồn Kho Thành Phẩm Khả Dụng</div>
              <div className="text-sm font-mono font-bold text-emerald-900">{fgSummary.totalStock.toLocaleString('vi-VN')} đôi</div>
            </div>
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
                onClick={() => setFilterMode('NEEDED_ONLY')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  filterMode === 'NEEDED_ONLY'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                Còn cần xuất ({kpiTotals.pendingCount})
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
                      {/* Row 1: Số trên đơn hàng gốc */}
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
                          <span>1. Số trên đơn hàng gốc</span>
                        </td>
                        {sizes.map((s) => {
                          const q = row.orderSizes[s] || 0;
                          return (
                            <td key={s} className="p-1.5 border-r border-slate-200 text-center font-mono text-slate-700">
                              {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800 bg-slate-100/50">
                          {row.orderTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-1.5 text-center">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            Đơn gốc
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: Số đã xuất */}
                      <tr className="bg-slate-50/20 hover:bg-slate-50/40">
                        <td className="p-1.5 border-r border-slate-200 text-slate-800 font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                          <span>2. Số đã xuất</span>
                        </td>
                        {sizes.map((s) => {
                          const iss = row.issuedSizes[s] || 0;
                          const ord = row.orderSizes[s] || 0;
                          const cellClass = getIssuedCellClass(iss, ord);
                          return (
                            <td key={s} className={`p-1.5 border-r border-slate-200 text-center font-mono ${cellClass}`}>
                              {iss > 0 ? iss.toLocaleString('vi-VN') : (ord > 0 ? '0' : '-')}
                            </td>
                          );
                        })}
                        <td className={`p-1.5 border-r border-slate-200 text-right font-mono ${getIssuedTotalClass(row.issuedTotal, row.orderTotal)}`}>
                          {row.issuedTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-1.5 text-center">
                          {getIssuedBadge(row.issuedTotal, row.orderTotal)}
                        </td>
                      </tr>

                      {/* Row 3: Số còn cần xuất */}
                      <tr className={row.neededTotal > 0 ? 'bg-amber-50/30 hover:bg-amber-50/50' : 'bg-slate-50/20 hover:bg-slate-50/40'}>
                        <td className="p-1.5 border-r border-slate-200 font-medium flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${row.neededTotal > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                          <span className={row.neededTotal > 0 ? 'text-amber-900 font-bold' : 'text-slate-700'}>
                            3. Số còn cần xuất
                          </span>
                        </td>
                        {sizes.map((s) => {
                          const need = row.neededSizes[s] || 0;
                          return (
                            <td
                              key={s}
                              className={`p-1.5 border-r border-slate-200 text-center font-mono font-bold ${
                                need > 0 ? 'bg-amber-100/70 text-amber-800' : 'text-slate-400'
                              }`}
                            >
                              {need > 0 ? need.toLocaleString('vi-VN') : '-'}
                            </td>
                          );
                        })}
                        <td
                          className={`p-1.5 border-r border-slate-200 text-right font-mono font-bold ${
                            row.neededTotal > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {row.neededTotal.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-1.5 text-center">
                          {row.neededTotal > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Cần xuất
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Đã đủ
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Row 4: Số còn tồn chưa xuất */}
                      <tr className="bg-emerald-50/50 hover:bg-emerald-50/70 font-bold border-b-2 border-slate-300">
                        <td className="p-2 border-r border-slate-200 text-emerald-950 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          <span>4. Số còn tồn chưa xuất</span>
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
                    TỔNG CỘNG TOÀN BỘ TỒN KHO CHƯA XUẤT:
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
                    1. Đơn Gốc
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-sky-50 text-sky-900">
                    2. Đã Xuất
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-amber-50 text-amber-900">
                    3. Còn Cần Xuất
                  </th>
                  <th className="p-2 border-r border-slate-300 text-right min-w-[95px] bg-emerald-100 text-emerald-950 font-bold">
                    4. Tồn Chưa Xuất
                  </th>
                  <th className="p-2 text-center min-w-[90px]">
                    TÌNH TRẠNG
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 text-xs italic">
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
                        {r.orderTotal.toLocaleString('vi-VN')}
                      </td>
                      <td className={`p-2 border-r border-slate-200 text-right font-mono font-bold ${getIssuedTotalClass(r.issuedTotal, r.orderTotal)}`}>
                        {r.issuedTotal.toLocaleString('vi-VN')}
                      </td>
                      <td
                        className={`p-2 border-r border-slate-200 text-right font-mono font-bold ${
                          r.neededTotal > 0 ? 'bg-amber-100/70 text-amber-900' : 'bg-slate-50 text-slate-500'
                        }`}
                      >
                        {r.neededTotal.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-950 bg-emerald-100/50">
                        {r.stockTotal.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 text-center">
                        {r.neededTotal > 0 ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Cần xuất
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
                    {kpiTotals.totalOrder.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-sky-800">
                    {kpiTotals.totalIssued.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-amber-900">
                    {kpiTotals.totalNeeded.toLocaleString('vi-VN')}
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
            <span>💡 Bảng thống kê đối chiếu liên hoàn: <strong>1. Số trên đơn hàng gốc</strong> ➔ <strong>2. Số đã xuất</strong> ➔ <strong>3. Số còn cần xuất</strong> ➔ <strong>4. Số còn tồn chưa xuất</strong>.</span>
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
        title="BẢNG THỐNG KÊ TỔNG HỢP GIAO NHẬN, ĐỐI SOÁT &amp; TỒN KHO (TAB 9)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="09-TK/TONGHOP"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
