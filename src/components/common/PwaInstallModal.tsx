import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Laptop, Share2, PlusSquare, CheckCircle, X, ArrowUpRight } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    // Kiểm tra xem đã chạy ở chế độ standalone (đã cài đặt) chưa
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsInstalled(isStandalone);

    // Kiểm tra thiết bị iOS (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // Lắng nghe sự kiện beforeinstallprompt của Chromium (Android, Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Lắng nghe sự kiện cài đặt thành công
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt = null;
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerInstall = async (onShowIosModal?: () => void) => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      deferredPrompt = null;
      setCanInstall(false);
    } else if (isIos && onShowIosModal) {
      onShowIosModal();
    } else if (onShowIosModal) {
      onShowIosModal();
    }
  };

  return { canInstall, isInstalled, isIos, triggerInstall };
}

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({ isOpen, onClose }) => {
  const { canInstall, isInstalled, isIos, triggerInstall } = usePwaInstall();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 shadow-xs backdrop-blur-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">Cài Đặt Ứng Dụng Kho D&amp;D</h3>
              <p className="text-xs text-sky-100">Thêm vào màn hình chính &amp; Ghim Taskbar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Lợi ích khi cài đặt */}
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700">
            <div className="font-bold text-sky-900 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Tiện ích vượt trội sau khi cài đặt:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Mở trực tiếp 1 chạm từ màn hình điện thoại hoặc thanh Taskbar laptop.</li>
              <li>Chạy toàn màn hình như App gốc, không chiếm diện tích bởi thanh URL.</li>
              <li>Tốc độ tải cực nhanh và hoạt động ổn định mọi lúc.</li>
            </ul>
          </div>

          {/* Hướng dẫn chi tiết cho từng loại thiết bị */}
          {isIos ? (
            /* Hướng dẫn cho iPhone / iPad (Safari iOS) */
            <div className="space-y-3">
              <div className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-sky-600" />
                <span>Hướng dẫn cài đặt trên iPhone / iPad (Safari):</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Bấm vào nút <strong>Chia sẻ (Share)</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      Biểu tượng hình vuông có mũi tên <Share2 className="w-3.5 h-3.5 text-sky-600 inline" /> ở thanh dưới trình duyệt Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Cuộn xuống và chọn <strong>"Thêm vào MH chính"</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      (Add to Home Screen <PlusSquare className="w-3.5 h-3.5 text-indigo-600 inline" />)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      Nhấn nút <strong>"Thêm" (Add)</strong> ở góc trên bên phải
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ứng dụng Kho D&amp;D sẽ xuất hiện trên màn hình chính của iPhone!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Hướng dẫn cho Android & Laptop Windows/Mac (Chrome/Edge) */
            <div className="space-y-3">
              {canInstall ? (
                <div className="text-center py-2 space-y-3">
                  <p className="text-xs text-slate-600">
                    Nhấp vào nút bên dưới để tiến hành cài đặt trực tiếp vào thiết bị của bạn:
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      triggerInstall();
                      onClose();
                    }}
                    className="w-full py-3 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Cài Đặt Ngay (1 Click)</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Laptop className="w-4 h-4 text-indigo-600" />
                    <span>Cách Ghim vào Taskbar trên Laptop / Máy tính:</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
                    <p>
                      <strong>1. Trên Google Chrome / Microsoft Edge:</strong> Nhấp vào biểu tượng <strong>Cài đặt</strong> (hoặc dấu 3 chấm ➔ <i>Lưu &amp; Chia sẻ ➔ Cài đặt trang này dưới dạng ứng dụng</i>).
                    </p>
                    <p>
                      <strong>2. Ghim Taskbar:</strong> Khi cửa sổ App mở ra, nhấp chuột phải vào biểu tượng D&amp;D trên thanh Taskbar phía dưới và chọn <strong>"Ghim vào thanh tác vụ" (Pin to Taskbar)</strong>.
                    </p>
                  </div>

                  <div className="font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 pt-2">
                    <Smartphone className="w-4 h-4 text-emerald-600" />
                    <span>Cách Thêm vào Màn hình chính Android:</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                    <p>
                      Bấm vào dấu <strong>3 chấm (⋮)</strong> ở góc trên bên phải Chrome ➔ Chọn <strong>"Thêm vào Màn hình chính" (Add to Home screen)</strong> hoặc <strong>"Cài đặt ứng dụng"</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
