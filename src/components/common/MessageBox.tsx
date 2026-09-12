import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  HelpCircle,
  X,
} from 'lucide-react';

export type DialogType = 'success' | 'warning' | 'error' | 'info' | 'confirm';

interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface MessageBoxContextType {
  alert: (message: string, title?: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  confirm: (message: string, onConfirm: () => void, title?: string, confirmText?: string) => void;
  toast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

const MessageBoxContext = createContext<MessageBoxContextType | undefined>(undefined);

export const MessageBoxProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showAlert = useCallback(
    (message: string, title: string = 'Thông Báo', type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
      setDialog({
        title,
        message,
        type,
        confirmText: 'Đồng Ý',
      });
    },
    []
  );

  const showConfirm = useCallback(
    (message: string, onConfirm: () => void, title: string = 'Xác Nhận Thao Tác', confirmText: string = 'Xác Nhận') => {
      setDialog({
        title,
        message,
        type: 'confirm',
        confirmText,
        cancelText: 'Hủy Bỏ',
        onConfirm: () => {
          setDialog(null);
          onConfirm();
        },
        onCancel: () => setDialog(null),
      });
    },
    []
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const closeDialog = () => setDialog(null);

  return (
    <MessageBoxContext.Provider
      value={{
        alert: showAlert,
        confirm: showConfirm,
        toast: showToast,
      }}
    >
      {children}

      {/* TOAST CONTAINER (Top-Center of screen) */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-md px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold border transition-all animate-in slide-in-from-top-3 duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-800 text-white border-emerald-600'
                : t.type === 'error'
                ? 'bg-rose-800 text-white border-rose-600'
                : t.type === 'warning'
                ? 'bg-amber-800 text-white border-amber-600'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />}
            {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-sky-300 shrink-0" />}
            <span className="flex-1 whitespace-pre-line">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-white/70 hover:text-white p-0.5 rounded ml-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* MODAL DIALOG (Centered on screen) */}
      {dialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div
              className={`p-4 flex items-center gap-3 border-b ${
                dialog.type === 'confirm'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : dialog.type === 'error'
                  ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                  : dialog.type === 'warning'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : dialog.type === 'success'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="p-2 rounded-xl bg-white shadow-xs shrink-0">
                {dialog.type === 'confirm' && <HelpCircle className="w-5 h-5 text-amber-600" />}
                {dialog.type === 'error' && <XCircle className="w-5 h-5 text-rose-600" />}
                {dialog.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {dialog.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {dialog.type === 'info' && <Info className="w-5 h-5 text-sky-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm leading-snug">{dialog.title || 'Thông Báo'}</h3>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="text-slate-400 hover:text-slate-700 p-1 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 text-xs sm:text-sm text-slate-700 leading-relaxed max-h-[60vh] overflow-y-auto whitespace-pre-line">
              {dialog.message}
            </div>

            {/* Footer Buttons */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              {dialog.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (dialog.onCancel) dialog.onCancel();
                      closeDialog();
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  >
                    {dialog.cancelText || 'Hủy Bỏ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (dialog.onConfirm) dialog.onConfirm();
                      closeDialog();
                    }}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition cursor-pointer"
                  >
                    {dialog.confirmText || 'Xác Nhận'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg shadow-xs transition cursor-pointer"
                >
                  {dialog.confirmText || 'Đồng Ý'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </MessageBoxContext.Provider>
  );
};

export const useMessageBox = (): MessageBoxContextType => {
  const context = useContext(MessageBoxContext);
  if (!context) {
    throw new Error('useMessageBox must be used within a MessageBoxProvider');
  }
  return context;
};
