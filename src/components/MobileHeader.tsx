import React from 'react';
import { Menu, Building2, Download, LogOut, Layers, Cloud } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface MobileHeaderProps {
  onOpenSidebar: () => void;
  onOpenInstallModal: () => void;
  onOpenBackupModal?: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenSidebar,
  onOpenInstallModal,
  onOpenBackupModal,
}) => {
  const {
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    currentUser,
    logout,
  } = useInventory();

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 py-2 select-none shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Menu Hamburger & Brand Logo */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer shrink-0"
            title="Mở menu hệ thống"
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
              D&amp;D
            </div>
            <span className="font-extrabold text-xs text-slate-900 hidden sm:inline">
              Long An
            </span>
          </div>
        </div>

        {/* Center / Right: Quick Customer Dropdown Selector */}
        <div className="flex-1 max-w-[180px] sm:max-w-[240px] min-w-0">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-[11px] font-bold rounded-lg px-2 py-1.5 truncate focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
            title="Chọn Khách hàng / Kho Chung"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
            {!customers.some((c) => c.id === 'cust-chung') && (
              <option value="cust-chung">Kho Chung (Nội Bộ)</option>
            )}
          </select>
        </div>

        {/* Right: Actions (Install App button & Logout) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Nút Cài đặt App PWA */}
          <button
            type="button"
            onClick={onOpenInstallModal}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-sky-600 to-indigo-600 active:from-sky-700 active:to-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition cursor-pointer"
            title="Cài đặt App / Thêm vào màn hình chính"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Cài App</span>
          </button>

          {/* Đăng xuất */}
          <button
            type="button"
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
            title={`Đăng xuất (${currentUser || 'admin'})`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
