import React from 'react';
import { Printer, X } from 'lucide-react';

export interface PrintTableRow {
  stt: number;
  date: string;
  voucherCode?: string;
  poNumber: string;
  code: string;
  description: string;
  unit: string;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  note?: string;
}

interface PrintHtmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
  title?: string;
  documentNumber?: string;
  documentCode?: string;
  dateStr?: string;
  customerName: string;
  poNumber?: string;
  sizes: string[];
  rows: PrintTableRow[];
}

export const PrintHtmlModal: React.FC<PrintHtmlModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  title,
  documentNumber,
  documentCode,
  dateStr,
  customerName,
  poNumber,
  sizes,
  rows,
}) => {
  if (!isOpen) return null;

  const docTitle = documentTitle || title || 'BẢNG IN';
  const docNum = documentNumber || documentCode || '';

  // Calculate size column totals
  const sizeTotals: Record<string, number> = {};
  sizes.forEach((s) => {
    sizeTotals[s] = rows.reduce((sum, r) => sum + (r.sizeQuantities[s] || 0), 0);
  });
  const grandTotal = rows.reduce((sum, r) => sum + r.totalQty, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Xem Trước Bản In HTML (A4 Khổ Ngang - Chuẩn In Ấn & Ký Tên)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>In Ngay (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="print-area p-6 sm:p-8 overflow-y-auto flex-1 font-sans text-slate-900 bg-white">
          {/* Header standard */}
          <div className="flex justify-between items-start border-b border-black pb-3 text-xs">
            <div>
              <div className="font-bold uppercase text-sm tracking-wide">CÔNG TY TNHH D&D LONG AN</div>
              <div>Xưởng Gia Công Sản Xuất Giày Dép Xuất Khẩu</div>
              <div className="text-slate-600">Đ/c: Ấp 24, Xã Đông Thạnh / Long An, Việt Nam</div>
              <div className="text-slate-600">Điện thoại: 84-0287110022 • MST: 0300827376</div>
            </div>
            <div className="text-right text-[11px] leading-tight text-slate-700">
              <div className="font-bold">Mẫu số: 01 - VT</div>
              <div className="italic">(Ban hành theo thông tư số 200/2014/TT-BTC</div>
              <div className="italic">ngày 22/12/2014 của Bộ Tài Chính)</div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center my-4">
            <h1 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-black">
              {docTitle}
            </h1>
            <div className="text-xs italic text-slate-600 mt-0.5">
              {dateStr ? `Ngày lập: ${dateStr}` : `Ngày ... tháng ... năm 2026`}
              {docNum && ` • Số phiếu: ${docNum}`}
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3 bg-slate-50/60 p-2.5 rounded border border-slate-200">
            <div>
              <span>Đối tác giao / Khách hàng: </span>
              <strong className="text-black uppercase">{customerName}</strong>
            </div>
            <div>
              <span>Đơn vị nhận: </span>
              <strong className="text-black">Xưởng sản xuất D&D Long An</strong>
            </div>
            <div>
              <span>Mã Đơn PO / Style: </span>
              <strong className="text-black">{poNumber || 'Theo chi tiết từng dòng'}</strong>
            </div>
            <div>
              <span>Quy cách dải size: </span>
              <span className="font-mono font-medium text-black">
                {sizes.join(', ')} ({sizes.length} size)
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-black">
              <thead>
                <tr className="bg-slate-100 text-black font-bold uppercase text-[10px]">
                  <th className="p-1.5 border border-black text-center w-7">STT</th>
                  <th className="p-1.5 border border-black whitespace-nowrap min-w-[75px]">Ngày</th>
                  <th className="p-1.5 border border-black min-w-[90px]">Số Phiếu KH</th>
                  <th className="p-1.5 border border-black min-w-[80px]">Mã PO</th>
                  <th className="p-1.5 border border-black min-w-[95px]">Code Vật tư</th>
                  <th className="p-1.5 border border-black min-w-[120px]">Diễn Giải Vật Tư</th>
                  <th className="p-1.5 border border-black text-center w-12">ĐVT</th>

                  {/* Horizontal Sizes */}
                  {sizes.map((s) => (
                    <th
                      key={s}
                      className="p-1.5 border border-black text-center min-w-[38px] font-mono text-[10px]"
                    >
                      {s}
                    </th>
                  ))}

                  <th className="p-1.5 border border-black text-right min-w-[65px]">TỔNG CỘNG</th>
                  <th className="p-1.5 border border-black min-w-[90px]">Ghi Chú</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7 + sizes.length + 2} className="p-4 text-center text-slate-500 italic">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-1.5 border border-black text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-black whitespace-nowrap">{r.date}</td>
                      <td className="p-1.5 border border-black font-mono font-semibold">{r.voucherCode || '-'}</td>
                      <td className="p-1.5 border border-black font-mono font-bold">{r.poNumber}</td>
                      <td className="p-1.5 border border-black font-bold">{r.code}</td>
                      <td className="p-1.5 border border-black">{r.description}</td>
                      <td className="p-1.5 border border-black text-center font-medium">{r.unit}</td>

                      {/* Size values */}
                      {sizes.map((s) => {
                        const q = r.sizeQuantities[s];
                        return (
                          <td
                            key={s}
                            className={`p-1.5 border border-black text-center font-mono ${
                              q ? 'font-bold text-black' : 'text-slate-300'
                            }`}
                          >
                            {q ? q.toLocaleString('vi-VN') : '-'}
                          </td>
                        );
                      })}

                      <td className="p-1.5 border border-black text-right font-mono font-bold">
                        {r.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 border border-black text-slate-600 text-[10px]">{r.note || '-'}</td>
                    </tr>
                  ))
                )}

                {/* SUMMARY ROW CHUẨN ERP HÌNH 2 */}
                <tr className="print-total-row bg-slate-200 text-black font-bold">
                  <td colSpan={7} className="p-2 border border-black text-right uppercase tracking-wider">
                    TỔNG CỘNG TOÀN BỘ:
                  </td>
                  {sizes.map((s) => (
                    <td key={s} className="p-2 border border-black text-center font-mono font-bold">
                      {sizeTotals[s] ? sizeTotals[s].toLocaleString('vi-VN') : '-'}
                    </td>
                  ))}
                  <td className="p-2 border border-black text-right font-mono font-bold text-sm">
                    {grandTotal.toLocaleString('vi-VN')}
                  </td>
                  <td className="p-2 border border-black text-center italic text-[10px]">Đạt chuẩn</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Words Total */}
          <div className="text-xs italic text-slate-800 mt-2.5">
            Tổng số lượng tiếp nhận: <strong>{grandTotal.toLocaleString('vi-VN')}</strong> {rows[0]?.unit || 'đôi/bộ'}.
          </div>

          {/* Signatures standard 5 columns matching physical delivery bill */}
          <div className="grid grid-cols-5 gap-2 text-center text-xs mt-8 pt-4 border-t border-slate-300">
            <div>
              <div className="font-bold uppercase">Người Lập Phiếu</div>
              <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
              <div className="h-16"></div>
              <div className="font-semibold text-[11px] text-slate-700">Vũ Minh Đức</div>
            </div>

            <div>
              <div className="font-bold uppercase">Người Nhận Hàng</div>
              <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
              <div className="h-16"></div>
              <div className="font-semibold text-[11px] text-slate-700">Phan Quang Vinh</div>
            </div>

            <div>
              <div className="font-bold uppercase">Thủ Kho Nhận</div>
              <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
              <div className="h-16"></div>
              <div className="font-semibold text-[11px] text-slate-700">Nguyễn Văn Kho</div>
            </div>

            <div>
              <div className="font-bold uppercase">Kế Toán Kho</div>
              <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
              <div className="h-16"></div>
              <div className="font-semibold text-[11px] text-slate-700">Trần Thị Thanh</div>
            </div>

            <div>
              <div className="font-bold uppercase">Giám Đốc Xưởng</div>
              <div className="italic text-[10px] text-slate-500">(Ký, đóng dấu)</div>
              <div className="h-16"></div>
              <div className="font-semibold text-[11px] text-slate-700">D&D Long An</div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="no-print p-3 border-t border-slate-200 bg-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            Khổ in khuyến nghị: <strong>A4 Khổ Ngang (Landscape)</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
            >
              Đóng
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>In Ngay (Print)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
