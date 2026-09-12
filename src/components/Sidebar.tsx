import React from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Building2,
  Calendar,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { useMessageBox } from './common/MessageBox';

export const Sidebar: React.FC = () => {
  const { confirm, toast } = useMessageBox();
  const {
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    currentCustomer,
    activeSizeRun,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    currentCustomerPOs,
    currentCustomerReceipts,
    resetAllData,
  } = useInventory();

  const handleReset = () => {
    confirm(
      'Bạn có chắc chắn muốn khôi phục toàn bộ dữ liệu mẫu ban đầu? Các dữ liệu tự nhập sẽ bị xóa.',
      () => {
        resetAllData();
        toast('Đã khôi phục dữ liệu mẫu ban đầu thành công!');
      }
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0 shrink-0 select-none shadow-2xs">
      {/* Brand & Logo */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xs font-bold text-base shrink-0">
            D&D
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate leading-tight">
              D&D Long An
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              Kho & Gia Công Giày
            </p>
          </div>
        </div>
      </div>

      {/* Global Context Controls */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Thiết Lập Chung
        </div>

        {/* Khách hàng Dropdown */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            <span>Khách Hàng:</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-slate-50 text-slate-900 text-xs font-semibold rounded-lg p-2 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer truncate"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Dải Size Hiển Thị Trực Quan */}
        {currentCustomer && (
          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Dải Size Áp Dụng:</span>
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold">
                ({(activeSizeRun?.sizes || []).length} size)
              </span>
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex flex-wrap gap-1">
              {(activeSizeRun?.sizes || ['4', '5', '6', '7', '8', '9', '10', '11', '12']).map((s) => (
                <span
                  key={s}
                  className="px-1.5 py-0.5 bg-white border border-indigo-200 rounded font-mono font-bold text-[11px] text-indigo-900 shadow-2xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Kỳ Ngày Tháng Năm Filter */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Kỳ Lọc (DD/MM/YYYY):</span>
          </label>
          <div className="grid grid-cols-2 gap-1">
            <input
              type="text"
              placeholder="Từ ngày"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-xs px-2 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-sky-500 font-mono text-center"
            />
            <input
              type="text"
              placeholder="Đến ngày"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 text-xs px-2 py-1.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-sky-500 font-mono text-center"
            />
          </div>
        </div>

        {/* Quick Summary Card */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
          <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
            <span>Đơn Hàng (PO):</span>
            <span className="text-sky-700 font-bold">{currentCustomerPOs.length} PO</span>
          </div>
          <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
            <span>Phiếu Nhập Kho:</span>
            <span className="text-emerald-700 font-bold">{currentCustomerReceipts.length} phiếu</span>
          </div>
        </div>
      </div>

      {/* Footer in Sidebar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1.5">
        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
          title="Khôi phục lại dữ liệu mẫu ban đầu"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Khôi Phục Mẫu</span>
        </button>

        <div className="text-[10px] text-center text-slate-400">
          D&D Long An &copy; 2026
        </div>
      </div>
    </aside>
  );
};
