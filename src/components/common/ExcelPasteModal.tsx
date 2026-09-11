import React, { useState } from 'react';
import { Clipboard, Check, X, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface ExcelPasteModalProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  columnsSample: string[];
  onParse: (rawText: string) => T[];
  renderPreviewRow: (item: T, idx: number) => React.ReactNode;
  onApply: (items: T[]) => void;
}

export function ExcelPasteModal<T>({
  isOpen,
  onClose,
  title,
  description,
  columnsSample,
  onParse,
  renderPreviewRow,
  onApply,
}: ExcelPasteModalProps<T>) {
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<T[]>([]);

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setPastedText(text);
    const parsed = onParse(text);
    setParsedItems(parsed);
  };

  const handleApply = () => {
    if (parsedItems.length === 0) {
      alert('Chưa có dòng dữ liệu hợp lệ nào được phân tích. Vui lòng kiểm tra lại dữ liệu dán!');
      return;
    }
    onApply(parsedItems);
    setPastedText('');
    setParsedItems([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Guide banner */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-900 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <Clipboard className="w-4 h-4 text-sky-600" />
              <span>Hướng dẫn copy từ Excel:</span>
            </div>
            <p>
              Chọn các dòng trong file Excel hoặc Google Sheets ➔ Bấm <strong>Ctrl + C</strong> ➔ Nhấp chuột vào khung bên dưới ➔ Bấm <strong>Ctrl + V</strong> để dán.
            </p>
            <div className="text-[11px] text-sky-700 mt-1">
              Thứ tự cột chuẩn: <span className="font-mono font-medium text-sky-900 bg-sky-100 px-1.5 py-0.5 rounded">{columnsSample.join(' | ')}</span>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Khung dán dữ liệu thô (Ctrl + V vào đây):
            </label>
            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Nhấp vào đây và nhấn phím Ctrl + V để dán dữ liệu copy từ Excel..."
              className="w-full font-mono text-xs border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
              autoFocus
            />
          </div>

          {/* Preview section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Xem trước kết quả phân tích:
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  parsedItems.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}>
                  {parsedItems.length} dòng hợp lệ
                </span>
              </span>
            </div>

            {parsedItems.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-400 text-xs">
                Chưa có dữ liệu. Hãy copy từ bảng tính và dán vào khung trên.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-52 overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2 border-b border-slate-200">#</th>
                      {columnsSample.map((col, i) => (
                        <th key={i} className="p-2 border-b border-slate-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {parsedItems.map((item, idx) => renderPreviewRow(item, idx))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
          >
            Đóng
          </button>
          <button
            onClick={handleApply}
            disabled={parsedItems.length === 0}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition"
          >
            <Check className="w-4 h-4" />
            <span>Chèn {parsedItems.length} dòng này vào bảng</span>
          </button>
        </div>
      </div>
    </div>
  );
}
