import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CompensationRequestItem } from '../../types';
import {
  Printer,
  Download,
  Search,
  FileCheck2,
  AlertTriangle,
  Building2,
  Calendar,
  Send,
  Eye,
} from 'lucide-react';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import * as XLSX from 'xlsx';

export const Tab4CompensationPrint: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerCompensationItems,
    updateCompensationRequestStatus,
  } = useInventory();

  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'TAB3' | 'TAB7'>('ALL');
  const [selectedItemForPrint, setSelectedItemForPrint] = useState<CompensationRequestItem | null>(null);
  const [showPrintAllModal, setShowPrintAllModal] = useState(false);

  // Filtered compensation items
  const filteredItems = useMemo(() => {
    return currentCustomerCompensationItems.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.voucherCode && item.voucherCode.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (sourceFilter === 'TAB3') return item.source === 'DISCREPANCY_TAB3';
      if (sourceFilter === 'TAB7') return item.source === 'DAMAGE_OUT_OF_STOCK_TAB7';
      return true;
    });
  }, [currentCustomerCompensationItems, searchQuery, sourceFilter]);

  // Column totals
  const totalCompBySize = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredItems.reduce((sum, item) => {
        return sum + (item.sizeQuantities[s] || 0);
      }, 0);
    });
    return totals;
  }, [filteredItems, sizes]);

  const grandTotalComp = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.totalQty, 0);
  }, [filteredItems]);

  // Export Excel
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }
    const headers = [
      'STT',
      'Nguồn Phát Sinh',
      'Ngày Đề Nghị',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Số Phiếu / Chuyền',
      'Lý Do Cấp Bù',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng SL Cần Bù',
      'Trạng Thái',
    ];

    const dataRows = filteredItems.map((item, idx) => [
      idx + 1,
      item.sourceLabel,
      item.requestDate,
      item.poNumber,
      item.itemCode,
      item.voucherCode || item.lineId || '-',
      item.reason,
      ...sizes.map((s) => item.sizeQuantities[s] || 0),
      item.totalQty,
      item.status,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PhieuBu_Tab4');
    XLSX.writeFile(wb, `Tab4_PhieuBu_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Prepare Print rows for All items
  const printAllRows: PrintTableRow[] = useMemo(() => {
    return filteredItems.map((item, idx) => ({
      stt: idx + 1,
      date: item.requestDate,
      voucherCode: item.voucherCode || item.lineId || 'BU-NLGC',
      poNumber: item.poNumber,
      code: item.itemCode,
      description: `Đề nghị bù: ${item.reason}`,
      unit: 'PRS',
      sizeQuantities: item.sizeQuantities,
      totalQty: item.totalQty,
      note: `Nguồn: ${item.sourceLabel} • ${item.status}`,
    }));
  }, [filteredItems]);

  // Prepare Print rows for Single selected item
  const printSingleRows: PrintTableRow[] = useMemo(() => {
    if (!selectedItemForPrint) return [];
    return [
      {
        stt: 1,
        date: selectedItemForPrint.requestDate,
        voucherCode: selectedItemForPrint.voucherCode || selectedItemForPrint.lineId || 'BU-NLGC',
        poNumber: selectedItemForPrint.poNumber,
        code: selectedItemForPrint.itemCode,
        description: `Đề nghị bù: ${selectedItemForPrint.reason}`,
        unit: 'PRS',
        sizeQuantities: selectedItemForPrint.sizeQuantities,
        totalQty: selectedItemForPrint.totalQty,
        note: `Nguồn: ${selectedItemForPrint.sourceLabel}`,
      },
    ];
  }, [selectedItemForPrint]);

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-rose-600" />
              <span>TAB 4: IN PHIẾU BÙ NGUYÊN LIỆU (CHỨNG TỪ GỬI KHÁCH HÀNG)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Tự động tổng hợp từ Chênh lệch âm (Tab 3) &amp; Hỏng hết kho (Tab 7)
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowPrintAllModal(true)}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>IN TẤT CẢ PHIẾU BÙ ({filteredItems.length})</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <input
                type="text"
                placeholder="Tìm PO, mã hàng, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>

            {/* Source Segmented */}
            <div className="inline-flex rounded-md shadow-2xs bg-white border border-slate-300 p-0.5">
              <button
                type="button"
                onClick={() => setSourceFilter('ALL')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả nguồn ({currentCustomerCompensationItems.length})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('TAB3')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'TAB3' ? 'bg-rose-600 text-white' : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                Giao thiếu (Tab 3)
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('TAB7')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                  sourceFilter === 'TAB7' ? 'bg-amber-600 text-white' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Hỏng hết kho (Tab 7)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong>{filteredItems.length}</strong> yêu cầu • Tổng SL nguyên liệu cần bù:{' '}
            <strong className="text-rose-700 font-mono font-bold text-xs">{grandTotalComp.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        {/* Table List */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[90px]">Nguồn Phát Sinh</th>
                <th className="p-2 border-r border-slate-300 min-w-[85px]">Ngày Đề Nghị</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px]">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px]">Mã Hàng (TT)</th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Số Phiếu / Chuyền</th>
                <th className="p-2 border-r border-slate-300 min-w-[150px]">Lý Do Cấp Bù</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-rose-50 text-rose-900"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-rose-100 text-rose-950 font-bold">
                  TỔNG CẦN BÙ
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[95px] text-center">Trạng Thái</th>
                <th className="p-2 text-center w-20">In Phiếu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                    Hiện tại không có đơn hàng nào bị giao thiếu hoặc hỏng hết kho cần yêu cầu cấp bù!
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    <td className="p-2 border-r border-slate-200 whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.source === 'DISCREPANCY_TAB3'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {item.sourceLabel}
                      </span>
                    </td>

                    <td className="p-2 border-r border-slate-200 text-slate-700 whitespace-nowrap">
                      {item.requestDate}
                    </td>

                    <td className="p-2 border-r border-slate-200 font-mono font-bold text-sky-700 whitespace-nowrap">
                      {item.poNumber}
                    </td>

                    <td className="p-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                      {item.itemCode}
                    </td>

                    <td className="p-2 border-r border-slate-200 text-slate-600">
                      {item.voucherCode || item.lineId || '-'}
                    </td>

                    <td className="p-2 border-r border-slate-200 text-slate-700 font-medium">
                      {item.reason}
                    </td>

                    {/* Missing size quantities */}
                    {sizes.map((s) => {
                      const q = item.sizeQuantities[s] || 0;
                      return (
                        <td
                          key={s}
                          className={`p-2 border-r border-slate-200 text-center font-mono ${
                            q > 0
                              ? 'bg-rose-50 text-rose-700 font-bold border-rose-200'
                              : 'text-slate-300'
                          }`}
                        >
                          {q > 0 ? q.toLocaleString('vi-VN') : '-'}
                        </td>
                      );
                    })}

                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-rose-50 text-rose-900">
                      {item.totalQty.toLocaleString('vi-VN')}
                    </td>

                    {/* Status Dropdown */}
                    <td className="p-1.5 border-r border-slate-200 text-center">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          updateCompensationRequestStatus(item.id, e.target.value as any)
                        }
                        className={`w-full text-[11px] font-semibold rounded p-1 border ${
                          item.status === 'Đã nhận bù'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : item.status === 'Đã gửi yêu cầu'
                            ? 'bg-sky-50 text-sky-800 border-sky-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}
                      >
                        <option value="Chờ gửi KH">Chờ gửi KH</option>
                        <option value="Đã gửi yêu cầu">Đã gửi KH</option>
                        <option value="Đã nhận bù">Đã nhận bù</option>
                      </select>
                    </td>

                    {/* Single Print Button */}
                    <td className="p-1.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedItemForPrint(item)}
                        className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[11px] font-semibold px-2 py-1 rounded transition shadow-2xs"
                        title="In phiếu bù cho riêng đơn này"
                      >
                        <Printer className="w-3 h-3 text-indigo-600" />
                        <span>In Phiếu</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}

              {/* Total Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG CỘNG NGUYÊN LIỆU ĐỀ NGHỊ CẤP BÙ:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-rose-900">
                    {totalCompBySize[s] > 0 ? totalCompBySize[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-rose-900">
                  {grandTotalComp > 0 ? grandTotalComp.toLocaleString('vi-VN') : '0'}
                </td>
                <td colSpan={2} className="p-2 text-slate-500 text-[11px] italic">
                  Tổng {filteredItems.length} yêu cầu
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: In TẤT CẢ phiếu bù */}
      <PrintHtmlModal
        isOpen={showPrintAllModal}
        onClose={() => setShowPrintAllModal(false)}
        title="PHIẾU ĐỀ NGHỊ CẤP BÙ NGUYÊN LIỆU GIA CÔNG (TỔNG HỢP)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="04-BU/NLGC"
        sizes={sizes}
        rows={printAllRows}
      />

      {/* MODAL 2: In RIÊNG 1 phiếu bù được chọn */}
      {selectedItemForPrint && (
        <PrintHtmlModal
          isOpen={true}
          onClose={() => setSelectedItemForPrint(null)}
          title={`PHIẾU ĐỀ NGHỊ CẤP BÙ NGUYÊN LIỆU - PO: ${selectedItemForPrint.poNumber}`}
          customerName={currentCustomer?.name || 'Chung'}
          documentCode={`04-BU-${selectedItemForPrint.poNumber}`}
          sizes={sizes}
          rows={printSingleRows}
        />
      )}
    </div>
  );
};
