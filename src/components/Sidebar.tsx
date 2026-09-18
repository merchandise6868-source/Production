import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Building2,
  Calendar,
  Layers,
  RotateCcw,
  Cloud,
  LogOut,
  X,
  Download,
  Smartphone,
} from 'lucide-react';
import { useMessageBox } from './common/MessageBox';
import { GoogleSheetsBackupModal } from './common/GoogleSheetsBackupModal';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenInstallModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen = false,
  onCloseMobile,
  onOpenInstallModal,
}) => {
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
    currentUser,
    logout,
  } = useInventory();

  const [showBackupModal, setShowBackupModal] = useState(false);

  const handleReset = () => {
    confirm(
      'Bạn có chắc chắn muốn khôi phục toàn bộ dữ liệu mẫu ban đầu? Các dữ liệu tự nhập sẽ bị xóa.',
      () => {
        resetAllData();
        toast('Đã khôi phục dữ liệu mẫu ban đầu thành công!');
      }
    );
  };

  const renderSidebarContent = (isMobileView: boolean = false) => (
    <div className="flex flex-col h-full">
      {/* Brand & Logo */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xs font-bold text-base shrink-0">
            D&D
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate leading-tight">
              D&amp;D Long An
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              Quản lý kho &amp; sản xuất
            </p>
          </div>
        </div>

        {isMobileView && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Customer Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-sky-600" />
            <span>ĐỐI TÁC / KHÁCH HÀNG</span>
          </label>
          <select
            value={selectedCustomerId}
            onChange={(e) => {
              setSelectedCustomerId(e.target.value);
              if (isMobileView && onCloseMobile) onCloseMobile();
            }}
            className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-lg p-2 focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
            {!customers.some((c) => c.id === 'cust-chung') && (
              <option value="cust-chung">Kho Chung (Nội Bộ D&D) (CHUNG)</option>
            )}
          </select>
        </div>

        {/* Size Run Display */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>{selectedCustomerId === 'cust-chung' ? 'QUY CÁCH QUẢN LÝ' : 'DẢI SIZE HOẠT ĐỘNG'}</span>
          </label>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            {selectedCustomerId === 'cust-chung' ? (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                  <span>Kho Nội Bộ D&amp;D</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Quản lý theo ĐVT (Cái, Bộ, Mét, Thùng, Hộp, Cuộn, Kg...)
                </p>
                <div className="flex flex-wrap gap-1 mt-1 text-[10px] font-semibold text-slate-700">
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-sky-800">Công cụ</span>
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-emerald-800">Vật tư</span>
                  <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-indigo-800">Máy móc</span>
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs font-semibold text-slate-800">
                  {activeSizeRun ? activeSizeRun.name : 'Chưa thiết lập'}
                </div>
                <div className="text-[11px] font-mono text-slate-500 flex flex-wrap gap-1 mt-1">
                  {activeSizeRun && activeSizeRun.sizes && activeSizeRun.sizes.length > 0 ? (
                    activeSizeRun.sizes.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-bold"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="italic text-slate-400">4, 5, 6, 7, 8, 9, 10, 11, 12</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-sky-600" />
            <span>KỲ BÁO CÁO (N-X-T)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
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
      </div>

      {/* Footer in Sidebar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        {/* Nút Cài đặt App / Ghim Taskbar */}
        {onOpenInstallModal && (
          <button
            type="button"
            onClick={() => {
              onOpenInstallModal();
              if (isMobileView && onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-sky-900 bg-sky-100 hover:bg-sky-200 border border-sky-300 rounded-lg transition shadow-2xs cursor-pointer"
            title="Cài đặt App lên điện thoại hoặc Ghim thanh Taskbar laptop"
          >
            <Smartphone className="w-4 h-4 text-sky-700" />
            <span>Cài App / Ghim Taskbar</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setShowBackupModal(true);
            if (isMobileView && onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-lg transition shadow-xs cursor-pointer"
          title="Mở Trung tâm Sao lưu dữ liệu lên Google Sheets"
        >
          <Cloud className="w-4 h-4" />
          <span>Sao Lưu Google Sheets</span>
        </button>

        <button
          onClick={handleReset}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors"
          title="Khôi phục lại dữ liệu mẫu ban đầu"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Khôi Phục Mẫu</span>
        </button>

        {/* Thông tin tài khoản & Nút Đăng Xuất */}
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
              TK
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[11px] text-slate-800 truncate leading-tight">
                {currentUser || 'tienkyosx'}
              </p>
              <p className="text-[9px] text-teal-600 font-semibold leading-tight">
                Quản Trị Viên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer shrink-0"
            title="Đăng xuất khỏi thiết bị này"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="text-[10px] text-center text-slate-400">
          D&amp;D Long An &copy; 2026
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col h-screen sticky top-0 shrink-0 select-none shadow-2xs">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Overlay & Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
          />

          {/* Drawer Sheet */}
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* Modal Sao Lưu Google Sheets */}
      <GoogleSheetsBackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </>
  );
};
