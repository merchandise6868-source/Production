import React from 'react';
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
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

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
  } = useInventory();

  const negDiffCount = currentCustomerDiscrepancies.filter((d) => d.hasNegative).length;

  const tabs = [
    { id: 0, label: 'Khách Hàng & Dải Size', icon: Users, badge: null },
    {
      id: 1,
      label: 'Tab 1: Số Trên Phiếu',
      icon: FileSpreadsheet,
      badge: currentCustomerPlanOrders.length > 0 ? `${currentCustomerPlanOrders.length} đơn` : null,
    },
    {
      id: 2,
      label: 'Tab 2: Số Thực Nhận',
      icon: PackageCheck,
      badge: currentCustomerActualReceives.length > 0 ? `${currentCustomerActualReceives.length} đã nhận` : null,
    },
    {
      id: 3,
      label: 'Tab 3: Số Chênh Lệch',
      icon: Scale,
      badge: negDiffCount > 0 ? `${negDiffCount} lệch âm` : 'Khớp',
      isWarning: negDiffCount > 0,
    },
    {
      id: 4,
      label: 'Tab 4: In Phiếu Bù',
      icon: Printer,
      badge: currentCustomerCompensationItems.length > 0 ? `${currentCustomerCompensationItems.length} cần bù` : null,
      highlight: currentCustomerCompensationItems.length > 0,
    },
    {
      id: 5,
      label: 'Tab 5: Tồn Kho Thời Gian Thực',
      icon: Warehouse,
      badge: currentCustomerRealtimeStock.length > 0 ? `${currentCustomerRealtimeStock.length} mã` : null,
    },
    {
      id: 6,
      label: 'Tab 6: Xuất Cho Sản Xuất',
      icon: Factory,
      badge: currentCustomerProductionIssues.length > 0 ? `${currentCustomerProductionIssues.length} đợt` : null,
    },
    {
      id: 7,
      label: 'Tab 7: Ghi Nhận Sản Xuất Xong',
      icon: ClipboardCheck,
      badge: currentCustomerProductionReports.length > 0 ? `${currentCustomerProductionReports.length} báo cáo` : null,
    },
    {
      id: 8,
      label: 'Tab 8: Bảng Thống Kê Tổng Hợp',
      icon: BarChart3,
      badge: currentCustomerPlanOrders.length > 0 ? `${currentCustomerPlanOrders.length} mã` : null,
      highlight: true,
    },
  ];

  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-200 shadow-2xs px-4 sm:px-6 py-2.5">
      <nav className="flex space-x-1.5 overflow-x-auto scrollbar-none items-center">
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
    </div>
  );
};
