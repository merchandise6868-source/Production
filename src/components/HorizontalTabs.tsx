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
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    currentCustomerDiscrepancies,
    currentCustomerCompensationItems,
    currentCustomerProductionIssues,
    currentCustomerRealtimeStock,
    currentCustomerProductionReports,
    currentCustomerFinishedGoodsStock,
  } = useInventory();

  const negDiffCount = currentCustomerDiscrepancies.filter((d) => d.hasNegative).length;
  const pendingCompCount = currentCustomerCompensationItems.filter(
    (c) => c.status !== 'Đã nhận bù' && !c.isFullyReceived
  ).length;

  const [showBackupModal, setShowBackupModal] = useState(false);

  const tabs = [
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
      highlight: currentCustomerFinishedGoodsStock.some(s => s.totalStock > 0),
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
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-2xs px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
      <nav className="flex space-x-1.5 overflow-x-auto scrollbar-none items-center flex-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
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

      {/* Nút Mở Trung Tâm Sao Lưu Google Sheets Đa Công Ty */}
      <button
        type="button"
        onClick={() => setShowBackupModal(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-xs cursor-pointer shrink-0"
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
