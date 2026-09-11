import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { exportNXTToExcel } from '../../utils/excelExport';
import { FileSpreadsheet, Calendar, Filter, Search, Download, CheckCircle, AlertTriangle } from 'lucide-react';

export const NXTReportTab: React.FC = () => {
  const {
    currentCustomer,
    currentCustomerPOs,
    inventoryMovementData,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
  } = useInventory();

  const [selectedPoFilter, setSelectedPoFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredData = inventoryMovementData.filter((item) => {
    if (selectedPoFilter !== 'ALL' && item.poNumber !== selectedPoFilter) {
      return false;
    }
    const q = searchQuery.toLowerCase();
    return (
      item.poNumber.toLowerCase().includes(q) ||
      item.style.toLowerCase().includes(q) ||
      item.originalName.toLowerCase().includes(q) ||
      item.vnName.toLowerCase().includes(q) ||
      item.size.toLowerCase().includes(q)
    );
  });

  // Calculate totals
  const totalInbound = filteredData.reduce((acc, cur) => acc + cur.inboundQty, 0);
  const totalBatch1 = filteredData.reduce((acc, cur) => acc + cur.outboundBatch1, 0);
  const totalComp = filteredData.reduce((acc, cur) => acc + cur.outboundComp, 0);
  const totalOut = filteredData.reduce((acc, cur) => acc + cur.totalOutbound, 0);
  const totalClosing = filteredData.reduce((acc, cur) => acc + cur.closingStock, 0);

  const handleExportExcel = () => {
    exportNXTToExcel(
      filteredData,
      currentCustomer?.name || 'Chung',
      { start: startDate, end: endDate }
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bảng Thống Kê Tổng Hợp Nhập - Xuất - Tồn (N-X-T)
              </h2>
              <p className="text-xs text-slate-500">
                Đối soát luân chuyển vật tư và thành phẩm chi tiết theo Khách Hàng: <strong className="text-sky-700">{currentCustomer?.name}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Action button: Export to Excel */}
        <button
          onClick={handleExportExcel}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition"
        >
          <Download className="w-4 h-4" />
          <span>In / Xuất File Excel (.XLSX)</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-700">Kỳ báo cáo:</span>
            <input
              type="text"
              placeholder="Từ DD/MM/YYYY"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-400 font-bold">-</span>
            <input
              type="text"
              placeholder="Đến DD/MM/YYYY"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-24 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* PO Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
            <Filter className="w-4 h-4 text-sky-600" />
            <span className="font-semibold text-slate-700">Lọc PO:</span>
            <select
              value={selectedPoFilter}
              onChange={(e) => setSelectedPoFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-medium focus:ring-1 focus:ring-sky-500"
            >
              <option value="ALL">-- Tất cả PO ({currentCustomerPOs.length}) --</option>
              {currentCustomerPOs.map((p) => (
                <option key={p.id} value={p.poNumber}>
                  {p.poNumber} ({p.style})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Tìm theo PO, tên NVL, size..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-emerald-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Main NXT Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            {/* Header Group */}
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th rowSpan={2} className="py-2.5 px-2 text-center border-r border-slate-200">STT</th>
                <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200">Mã PO / Style</th>
                <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200">Tên NVL (Gốc)</th>
                <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-200">Tên Tiếng Việt</th>
                <th rowSpan={2} className="py-2.5 px-2 text-center border-r border-slate-200">ĐVT</th>
                <th rowSpan={2} className="py-2.5 px-2 text-center border-r border-slate-200">Size</th>
                <th rowSpan={2} className="py-2.5 px-3 text-right bg-slate-50 border-r border-slate-200">Tồn Đầu Kỳ</th>
                <th rowSpan={2} className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-900 border-r border-slate-200">
                  Nhập Trong Kỳ<br/><span className="text-[9px] font-normal">(N_thực)</span>
                </th>
                <th colSpan={3} className="py-1 px-3 text-center bg-indigo-50 text-indigo-900 border-r border-slate-200 border-b border-indigo-200">
                  Xuất Trong Kỳ
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-right bg-sky-50 text-sky-900 border-r border-slate-200 font-extrabold">
                  Tồn Cuối Kỳ
                </th>
                <th rowSpan={2} className="py-2.5 px-3 text-center">Trạng Thái</th>
              </tr>
              <tr className="bg-indigo-50/70 text-indigo-900">
                <th className="py-1.5 px-2 text-right border-r border-slate-200">Xuất Đợt 1</th>
                <th className="py-1.5 px-2 text-right border-r border-slate-200">Xuất Bù</th>
                <th className="py-1.5 px-2 text-right border-r border-slate-200 font-bold">Tổng Xuất</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-8 text-center text-slate-400 italic">
                    Không tìm thấy bản ghi nhập xuất tồn nào thỏa mãn điều kiện lọc.
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-2 text-center text-slate-500 font-medium border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 border-r border-slate-100">
                      <div className="font-bold text-sky-700">{row.poNumber}</div>
                      <div className="text-[10px] text-slate-500">{row.style}</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-100">
                      {row.originalName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 border-r border-slate-100">
                      {row.vnName}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-500 border-r border-slate-100">
                      {row.unit}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-indigo-700 border-r border-slate-100">
                      {row.size}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700 bg-slate-50/40 border-r border-slate-100">
                      {row.openingStock}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700 bg-emerald-50/30 border-r border-slate-100">
                      {row.inboundQty}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-indigo-700 border-r border-slate-100">
                      {row.outboundBatch1}
                    </td>
                    <td className="py-2.5 px-2 text-right font-medium text-amber-700 border-r border-slate-100">
                      {row.outboundComp}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900 bg-indigo-50/20 border-r border-slate-100">
                      {row.totalOutbound}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-sky-800 bg-sky-50/40 border-r border-slate-100 text-sm">
                      {row.closingStock}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {row.closingStock <= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">
                          Đã hết vật tư
                        </span>
                      ) : row.closingStock < 5 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Tồn thấp ({row.closingStock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Khả dụng ({row.closingStock})
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Summary Footer */}
            {filteredData.length > 0 && (
              <tfoot className="bg-slate-100/90 font-bold text-slate-800 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={6} className="py-3 px-3 text-right uppercase text-[11px] text-slate-600">
                    TỔNG CỘNG ({filteredData.length} dòng):
                  </td>
                  <td className="py-3 px-3 text-right">0</td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-extrabold text-sm">{totalInbound}</td>
                  <td className="py-3 px-2 text-right text-indigo-700">{totalBatch1}</td>
                  <td className="py-3 px-2 text-right text-amber-700">{totalComp}</td>
                  <td className="py-3 px-2 text-right text-slate-900 font-extrabold">{totalOut}</td>
                  <td className="py-3 px-3 text-right text-sky-900 font-extrabold text-sm bg-sky-100/60">{totalClosing}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
