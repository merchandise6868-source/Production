import React, { useState } from 'react';
import {
  Users,
  FileSpreadsheet,
  PackageCheck,
  Scale,
  Printer,
  Factory,
  Warehouse,
  ClipboardCheck,
  BarChart3,
  Truck,
  Cloud,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { GoogleSheetsBackupModal } from './common/GoogleSheetsBackupModal';

interface HorizontalTabsProps {
  activeTab: number;
  setActiveTab: (tab: number) => void;
}

export const HorizontalTabs: React.FC<HorizontalTabsProps> = ({ activeTab, setActiveTab }) => {
  const {
    selectedCustomerId,
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    currentCustomerDiscrepancies,
    currentCustomerCompensationItems,
    currentCustomerProductionIssues,
    currentCustomerRealtimeStock,
    currentCustomerProductionReports,
    currentCustomerFinishedGoodsStock,
    generalInboundSlips,
    generalOutboundSlips,
  } = useInventory();

  // Tự động chuyển về Tab 1 nếu đang ở tab không thuộc Kho Chung
  React.useEffect(() => {
    if (selectedCustomerId === 'cust-chung' && activeTab !== 1 && activeTab !== 2 && activeTab !== 3) {
      setActiveTab(1);
    }
  }, [selectedCustomerId, activeTab, setActiveTab]);

  const negDiffCount = currentCustomerDiscrepancies.filter((d) => d.hasNegative).length;
  const pendingCompCount = currentCustomerCompensationItems.filter(
    (c) => c.status !== 'Đã nhận bù' && !c.isFullyReceived
  ).length;

  const [showBackupModal, setShowBackupModal] = useState(false);

  // KHI CHỌN "KHO CHUNG (NỘI BỘ D&D)": CHỈ CÓ ĐÚNG 3 TAB CHÍNH
  const tabs =
    selectedCustomerId === 'cust-chung'
      ? [
          {
            id: 1,
            label: 'Tab 1: Phiếu Nhập Kho',
            icon: FileSpreadsheet,
            badge: generalInboundSlips.length > 0 ? `${generalInboundSlips.length} phiếu` : null,
          },
          {
            id: 2,
            label: 'Tab 2: Phiếu Xuất Kho',
            icon: Truck,
            badge: generalOutboundSlips.length > 0 ? `${generalOutboundSlips.length} phiếu` : null,
          },
          {
            id: 3,
            label: 'Tab 3: Tồn Kho & Lần Xuất',
            icon: Warehouse,
            badge: 'Realtime',
            highlight: true,
          },
        ]
      : [
          { id: 0, label: 'Khách Hàng & Dải Size', icon: Users, badge: null },
          {
            id: 1,
            label: 'Tab 1: Số Vật Tư Trên Phiếu',
            icon: FileSpreadsheet,
            badge: currentCustomerPlanOrders.length > 0 ? `${currentCustomerPlanOrders.length} đơn` : null,
          },
          {
            id: 2,
            label: 'Tab 2: Số Vật Tư Thực Nhận',
            icon: PackageCheck,
            badge: currentCustomerActualReceives.length > 0 ? `${currentCustomerActualReceives.length} đã nhận` : null,
          },
          {
            id: 3,
            label: 'Tab 3: Số Vật Tư Chênh Lệch',
            icon: Scale,
            badge: negDiffCount > 0 ? `${negDiffCount} lệch âm` : 'Khớp',
            isWarning: negDiffCount > 0,
          },
          {
            id: 5,
            label: 'Tab 5: Xuất Vật Tư Cho Sản Xuất',
            icon: Factory,
            badge: currentCustomerProductionIssues.length > 0 ? `${currentCustomerProductionIssues.length} đợt` : null,
          },
          {
            id: 6,
            label: 'Tab 6: Tồn Kho Vật Tư Realtime',
            icon: Warehouse,
            badge: currentCustomerRealtimeStock.length > 0 ? `${currentCustomerRealtimeStock.length} mã` : null,
          },
          {
            id: 7,
            label: 'Tab 7: Ghi Nhận Sản Xuất Xong',
            icon: ClipboardCheck,
            badge: currentCustomerProductionReports.length > 0 ? `${currentCustomerProductionReports.length} báo cáo` : null,
          },
          {
            id: 8,
            label: 'Tab 8: Kho & Xuất Thành Phẩm',
            icon: Truck,
            badge: currentCustomerFinishedGoodsStock.length > 0 ? `${currentCustomerFinishedGoodsStock.length} mã TP` : null,
            highlight: currentCustomerFinishedGoodsStock.some((s) => s.totalStock > 0),
          },
          {
            id: 9,
            label: 'Tab 9: Bảng Thống Kê Tổng Hợp',
            icon: BarChart3,
            badge: currentCustomerPlanOrders.length > 0 ? `${currentCustomerPlanOrders.length} mã` : null,
            highlight: true,
          },
        ];

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-2xs px-3 sm:px-6 py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
      {/* Mobile Quick Dropdown Tab Selector (Visible on small screens) */}
      <div className="sm:hidden flex items-center gap-2">
        <label className="text-[11px] font-bold text-slate-500 shrink-0">Phân hệ:</label>
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(Number(e.target.value))}
          className="flex-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:outline-none"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label} {tab.badge ? `(${tab.badge})` : ''}
            </option>
          ))}
        </select>
        {/* Mobile Backup Button */}
        <button
          type="button"
          onClick={() => setShowBackupModal(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-700 text-white shrink-0 shadow-xs cursor-pointer"
          title="Sao lưu Google Sheets"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Sao Lưu</span>
        </button>
      </div>

      {/* Desktop & Mobile Scrollable Tab Bar */}
      <nav className="flex space-x-1.5 overflow-x-auto scrollbar-none items-center flex-1 py-0.5 -mx-1 px-1 touch-pan-x">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-bold'
                  : tab.isWarning
                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold'
                  : tab.highlight
                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive
                    ? 'text-white'
                    : tab.isWarning
                    ? 'text-rose-600'
                    : tab.highlight
                    ? 'text-amber-600'
                    : 'text-slate-500'
                }`}
              />
              <span>{tab.label}</span>

              {tab.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : tab.isWarning
                      ? 'bg-rose-200 text-rose-900'
                      : tab.highlight
                      ? 'bg-amber-200 text-amber-900'
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

      {/* Desktop Backup Button */}
      <button
        type="button"
        onClick={() => setShowBackupModal(true)}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-xs cursor-pointer shrink-0"
        title="Mở Trung tâm Sao lưu dữ liệu lên Google Sheets (Đa công ty)"
      >
        <Cloud className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Sao Lưu Google Sheets</span>
        <span className="md:hidden">Sao Lưu</span>
      </button>

      {/* Modal Sao Lưu Google Sheets */}
      <GoogleSheetsBackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
};
