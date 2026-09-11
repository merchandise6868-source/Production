import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { exportDashboardToExcel } from '../../utils/excelExport';
import { LayoutDashboard, CheckCircle2, Clock, Download, PackageCheck, AlertCircle, TrendingUp } from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const { currentCustomer, dashboardReportData } = useInventory();

  const handleExportExcel = () => {
    exportDashboardToExcel(dashboardReportData, currentCustomer?.name || 'Chung');
  };

  const totalOrders = dashboardReportData.length;
  const completedOrders = dashboardReportData.filter((i) => i.status === 'Hoàn thành').length;
  const pendingOrders = totalOrders - completedOrders;
  const totalDeliveredAll = dashboardReportData.reduce((acc, cur) => acc + cur.totalDelivered, 0);
  const totalCompAll = dashboardReportData.reduce((acc, cur) => acc + cur.qtyComp, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Export */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-800">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bảng Tổng Hợp Chi Tiết Đối Soát Đơn Hàng & Tiến Độ Giao
              </h2>
              <p className="text-xs text-slate-500">
                Khách hàng hiện hành: <strong className="text-sky-700">{currentCustomer?.name}</strong> (Khớp 100% mẫu đối soát ban đầu)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition"
        >
          <Download className="w-4 h-4" />
          <span>In / Xuất Báo Cáo Đối Soát (.XLSX)</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Tổng Đơn Hàng (PO)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalOrders}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Đang quản lý theo khách hàng</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Đơn Đã Hoàn Thành</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{completedOrders}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Đạt 100% số lượng giao</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Đang Chờ Giao Bù / Đợt Tiếp</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{pendingOrders}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Chưa hoàn thành đơn gốc</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 font-semibold">Thành Phẩm Đã Giao</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{totalDeliveredAll} đôi</div>
            <div className="text-[11px] text-indigo-600 mt-0.5">Bao gồm {totalCompAll} đôi phiếu bù</div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table: Matches exact user sample */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            Bảng Ma Trận Đối Soát Giao Nhận & Tồn Kho (Theo Khách Hàng)
          </span>
          <span className="text-slate-500 italic">
            Tự động cập nhật khi thêm phiếu nhập, xuất đợt 1 hoặc duyệt phiếu bù
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">Mã PO</th>
                <th className="py-3 px-4">Tên NVL / Giày (Gốc)</th>
                <th className="py-3 px-4">Tên Tiếng Việt</th>
                <th className="py-3 px-2 text-center">Size</th>
                <th className="py-3 px-3 text-right">Số Phiếu Nhận</th>
                <th className="py-3 px-3 text-right">Số Thực Nhận</th>
                <th className="py-3 px-3 text-right">SL Đã Giao Đợt 1</th>
                <th className="py-3 px-3 text-right text-amber-700">SL Phiếu Bù (Giao Thêm)</th>
                <th className="py-3 px-3 text-right font-bold text-indigo-900 bg-indigo-50/50">
                  Tổng Thành Phẩm Đã Giao
                </th>
                <th className="py-3 px-3 text-right font-bold text-sky-900 bg-sky-50/50">
                  Tồn Kho NVL
                </th>
                <th className="py-3 px-4 text-center">Trạng Thái PO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dashboardReportData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                    Chưa có đơn PO nào cho khách hàng này.
                  </td>
                </tr>
              ) : (
                dashboardReportData.map((item) => {
                  const isDone = item.status === 'Hoàn thành';

                  return (
                    <tr key={item.poId} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-bold text-sky-700 whitespace-nowrap">
                        {item.poNumber}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.originalName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.vnName}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-indigo-700">
                        {item.size}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {item.qtyDoc}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800">
                        {item.qtyActual}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        {item.qtyBatch1}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-700">
                        {item.qtyComp}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-indigo-800 bg-indigo-50/30 text-sm">
                        {item.totalDelivered}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-sky-800 bg-sky-50/30 text-sm">
                        {item.remainingStock}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Hoàn thành
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full shadow-xs">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Chưa hoàn thành đơn gốc
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
