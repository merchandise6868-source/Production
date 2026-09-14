import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { InventoryProvider } from './context/InventoryContext';
import { Sidebar } from './components/Sidebar';
import { HorizontalTabs } from './components/HorizontalTabs';
import { CustomerTab } from './components/tabs/CustomerTab';
import { Tab1PlanOrder } from './components/tabs/Tab1PlanOrder';
import { Tab2ActualReceive } from './components/tabs/Tab2ActualReceive';
import { Tab3Discrepancy } from './components/tabs/Tab3Discrepancy';
import { Tab5ProductionIssue } from './components/tabs/Tab5ProductionIssue';
import { Tab6RealtimeStock } from './components/tabs/Tab6RealtimeStock';
import { Tab7ProductionReport } from './components/tabs/Tab7ProductionReport';
import { Tab8FinishedGoods } from './components/tabs/Tab8FinishedGoods';
import { Tab8MasterSummary } from './components/tabs/Tab8MasterSummary';
import { MessageBoxProvider } from './components/common/MessageBox';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Đã xảy ra sự cố hiển thị</h2>
            <p className="text-xs text-slate-500">
              {this.state.error?.message || 'Có lỗi phát sinh trong quá trình kết xuất giao diện.'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Khôi Phục & Tải Lại Trang</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(1); // Default to Tab 1: Số Trên Phiếu

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900 overflow-hidden">
      {/* Cột Dọc Bên Trái: Header hệ thống, Khách Hàng, Dải Size, Kỳ Báo Cáo */}
      <Sidebar />

      {/* Vùng Bên Phải: Phía trên là Các Tab Ngang, phía dưới là Nội Dung Chi Tiết */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Thanh Tab Ngang Ở Trên Cùng Vùng Bên Phải */}
        <HorizontalTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Nội Dung Phân Hệ Đang Chọn Theo SRS */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {activeTab === 0 && <CustomerTab />}
          {activeTab === 1 && <Tab1PlanOrder />}
          {activeTab === 2 && <Tab2ActualReceive />}
          {activeTab === 3 && <Tab3Discrepancy />}
          {activeTab === 5 && <Tab6RealtimeStock />}
          {activeTab === 6 && <Tab5ProductionIssue />}
          {activeTab === 7 && <Tab7ProductionReport />}
          {activeTab === 8 && <Tab8FinishedGoods />}
          {activeTab === 9 && <Tab8MasterSummary />}
        </main>

        {/* Chân Trang */}
        <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Hệ Thống Quản Lý Kho & Sản Xuất Đơn Hàng Gia Công &copy; 2026 D&D Long An
            </span>
            <span className="text-slate-400">
              Dữ liệu được lưu trữ tự động trong trình duyệt (LocalStorage)
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <MessageBoxProvider>
        <InventoryProvider>
          <AppContent />
        </InventoryProvider>
      </MessageBoxProvider>
    </ErrorBoundary>
  );
};

export default App;
