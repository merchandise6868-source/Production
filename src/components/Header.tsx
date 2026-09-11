import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Building2, Calendar, Layers, RotateCcw, Plus, Check } from 'lucide-react';

interface HeaderProps {
  activeTab: number;
  setActiveTab: (tab: number) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    currentCustomer,
    activeSizeRun,
    setActiveSizeRun,
    startDate,
    endDate,
    setStartDate,
    setEndDate,
    resetAllData,
  } = useInventory();

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  const tabs = [
    { id: 0, label: '1. Khách Hàng & Dải Size', badge: null },
    { id: 1, label: '2. Nhập Kho Vật Tư', badge: 'CL Tự Động' },
    { id: 2, label: '3. Xuất Kho & Giao Đợt 1', badge: null },
    { id: 3, label: '4. Quản Lý Phiếu Bù', badge: 'Tab Độc Lập' },
    { id: 4, label: '5. Tồn Kho & Kiểm Kê', badge: null },
    { id: 5, label: '6. Báo Cáo Nhập-Xuất-Tồn', badge: 'N-X-T', highlight: true },
    { id: 6, label: '7. Báo Cáo Tổng Hợp & Đối Soát', badge: 'Dashboard' },
  ];

  const handleReset = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục toàn bộ dữ liệu mẫu ban đầu? Các dữ liệu tự nhập sẽ bị xóa.')) {
      resetAllData();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      {/* Upper bar: Brand & Global Context Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md font-bold text-lg">
              D&D
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Hệ Thống Quản Lý Kho & Sản Xuất Gia Công
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <span>D&D Long An Footwear OEM</span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-emerald-600 font-medium">Hệ thống đang hoạt động</span>
              </p>
            </div>
          </div>

          {/* Global Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            
            {/* Customer Switcher (Global Context) */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1.5 border border-slate-300">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 px-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <span>Khách hàng:</span>
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="bg-white text-slate-800 text-sm font-semibold rounded-md px-3 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm cursor-pointer"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Active Size Run Selector */}
            {currentCustomer && currentCustomer.sizeRuns.length > 0 && (
              <div className="flex items-center bg-slate-100 rounded-lg p-1.5 border border-slate-300">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 px-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Dải Size:</span>
                </div>
                <select
                  value={currentCustomer.activeSizeRunId}
                  onChange={(e) => setActiveSizeRun(e.target.value)}
                  className="bg-white text-slate-800 text-xs font-medium rounded-md px-2.5 py-1.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                >
                  {currentCustomer.sizeRuns.map((sr) => (
                    <option key={sr.id} value={sr.id}>
                      {sr.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Global Date Filter: DD/MM/YYYY */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1.5 border border-slate-300">
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700 px-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Kỳ:</span>
              </div>
              <input
                type="text"
                placeholder="Từ DD/MM/YYYY"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-24 bg-white text-slate-800 text-xs px-2 py-1 rounded border border-slate-300 focus:ring-1 focus:ring-sky-500"
                title="Ngày bắt đầu (DD/MM/YYYY)"
              />
              <span className="text-slate-400 text-xs px-1">-</span>
              <input
                type="text"
                placeholder="Đến DD/MM/YYYY"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-24 bg-white text-slate-800 text-xs px-2 py-1 rounded border border-slate-300 focus:ring-1 focus:ring-sky-500"
                title="Ngày kết thúc (DD/MM/YYYY)"
              />
            </div>

            {/* Reset Data Button */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
              title="Khôi phục dữ liệu mẫu ban đầu"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Khôi phục mẫu</span>
            </button>
          </div>
        </div>

        {/* Dynamic Size Run Indicator Bar */}
        {activeSizeRun && (
          <div className="py-1.5 px-3 bg-sky-50/80 rounded-md border border-sky-100 flex flex-wrap items-center justify-between text-xs text-sky-900 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sky-700">Dải size đang áp dụng:</span>
              <span className="bg-sky-200/70 text-sky-800 px-2 py-0.5 rounded font-mono font-bold">
                {activeSizeRun.name}
              </span>
              <span className="text-slate-600 hidden md:inline">
                ({activeSizeRun.sizes.join(', ')})
              </span>
            </div>
            <div className="text-[11px] text-sky-600 italic">
              Dropdown chọn Size ở các màn hình sẽ tự động hiển thị dải size này
            </div>
          </div>
        )}
      </div>

      {/* Lower Navigation Tabs */}
      <div className="bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : tab.highlight
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : tab.highlight
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
