import React, { useState, useMemo } from 'react';
import {
  Warehouse,
  Search,
  Printer,
  ListFilter,
  Layers,
  ArrowRight,
  Package,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  RotateCcw,
} from 'lucide-react';
import { useInventory } from '../../../context/InventoryContext';
import { GeneralStockCardRow, GeneralStockSummaryItem } from '../../../types';

export const GeneralInventoryTab: React.FC = () => {
  const { generalInboundSlips, generalOutboundSlips } = useInventory();

  // Từ khóa tìm kiếm (Đúng như ô tìm kiếm ở Hình 3)
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Mặt hàng đang chọn xem thẻ kho chi tiết (null = xem bảng tổng hợp)
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  // Modal in Thẻ kho A4
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // ==========================================================================
  // TÍNH TOÁN BẢNG TỔNG HỢP TỒN KHO (TẦNG 1)
  // ==========================================================================
  const stockSummaryList = useMemo<GeneralStockSummaryItem[]>(() => {
    const map = new Map<string, GeneralStockSummaryItem>();

    // Tính tổng nhập từ tất cả phiếu nhập
    generalInboundSlips.forEach((slip) => {
      slip.items.forEach((it) => {
        const key = (it.itemCode || it.itemName).trim().toUpperCase();
        if (!key) return;

        if (!map.has(key)) {
          map.set(key, {
            itemCode: it.itemCode || '-',
            itemName: it.itemName,
            unit: it.unit || 'Cái',
            totalInbound: 0,
            totalOutbound: 0,
            currentStock: 0,
            lastInboundDate: slip.date,
          });
        }

        const existing = map.get(key)!;
        existing.totalInbound += Number(it.quantity) || 0;
        existing.lastInboundDate = slip.date;
      });
    });

    // Tính tổng xuất từ tất cả phiếu xuất
    generalOutboundSlips.forEach((slip) => {
      slip.items.forEach((it) => {
        const key = (it.itemCode || it.itemName).trim().toUpperCase();
        if (!key) return;

        if (!map.has(key)) {
          map.set(key, {
            itemCode: it.itemCode || '-',
            itemName: it.itemName,
            group: it.group,
            unit: it.unit || 'Cái',
            totalInbound: 0,
            totalOutbound: 0,
            currentStock: 0,
            lastOutboundDate: slip.date,
          });
        }

        const existing = map.get(key)!;
        existing.totalOutbound += Number(it.quantity) || 0;
        if (it.group && !existing.group) existing.group = it.group;
        existing.lastOutboundDate = slip.date;
      });
    });

    // Tính tồn kho cuối cùng: Tồn = Nhập - Xuất
    map.forEach((item) => {
      item.currentStock = item.totalInbound - item.totalOutbound;
    });

    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [generalInboundSlips, generalOutboundSlips]);

  // Lọc danh sách tổng hợp theo từ khóa tìm kiếm
  const filteredSummaryList = useMemo(() => {
    if (!searchTerm.trim()) return stockSummaryList;
    const term = searchTerm.toLowerCase();
    return stockSummaryList.filter(
      (it) =>
        it.itemName.toLowerCase().includes(term) ||
        it.itemCode.toLowerCase().includes(term) ||
        (it.group && it.group.toLowerCase().includes(term))
    );
  }, [stockSummaryList, searchTerm]);

  // Thống kê nhanh KPI
  const totalItemsCount = stockSummaryList.length;
  const totalInboundQty = stockSummaryList.reduce((sum, it) => sum + it.totalInbound, 0);
  const totalOutboundQty = stockSummaryList.reduce((sum, it) => sum + it.totalOutbound, 0);
  const totalCurrentStockQty = stockSummaryList.reduce((sum, it) => sum + it.currentStock, 0);
  const outOfStockCount = stockSummaryList.filter((it) => it.currentStock <= 0).length;

  // ==========================================================================
  // TÍNH TOÁN DÒNG THẺ KHO CHI TIẾT THEO LẦN XUẤT (TẦNG 2 - ĐÚNG THEO HÌNH 3)
  // STT | Tên hàng hoá | Ngày nhập | Ngày xuất | Lần xuất | Số lượng | Người nhận | Mục đích sử dụng | Ghi chú
  // ==========================================================================
  const activeDetailItem = useMemo(() => {
    if (!selectedItemKey) return null;
    return stockSummaryList.find(
      (it) =>
        it.itemCode.toUpperCase() === selectedItemKey.toUpperCase() ||
        it.itemName.toUpperCase() === selectedItemKey.toUpperCase()
    );
  }, [selectedItemKey, stockSummaryList]);

  const stockCardRows = useMemo<GeneralStockCardRow[]>(() => {
    if (!activeDetailItem) return [];

    const targetKey = (activeDetailItem.itemCode || activeDetailItem.itemName).trim().toUpperCase();
    const rows: GeneralStockCardRow[] = [];
    let sttCounter = 1;

    // 1. Lấy tất cả các lần nhập liên quan
    generalInboundSlips.forEach((slip) => {
      slip.items.forEach((it) => {
        const itKey = (it.itemCode || it.itemName).trim().toUpperCase();
        if (itKey === targetKey || it.itemName.toUpperCase() === activeDetailItem.itemName.toUpperCase()) {
          rows.push({
            stt: sttCounter++,
            itemName: it.itemName,
            inboundDate: slip.date,
            outboundDate: '-',
            exportSequence: '-',
            quantity: it.quantity,
            receiver: it.receiver || 'Hà',
            purpose: it.department ? `Nhập về ${it.department}` : 'Nhập kho',
            note: it.note || `Theo phiếu ${slip.slipNumber}`,
            type: 'INBOUND',
          });
        }
      });
    });

    // 2. Lấy tất cả các lần xuất liên quan và tự động đánh số: Lần 1, Lần 2, Lần 3...
    let exportIndex = 1;
    generalOutboundSlips.forEach((slip) => {
      slip.items.forEach((it) => {
        const itKey = (it.itemCode || it.itemName).trim().toUpperCase();
        if (itKey === targetKey || it.itemName.toUpperCase() === activeDetailItem.itemName.toUpperCase()) {
          rows.push({
            stt: sttCounter++,
            itemName: it.itemName,
            inboundDate: '-',
            outboundDate: slip.date,
            exportSequence: `Lần ${exportIndex++}`,
            quantity: it.quantity,
            receiver: it.receiver || '-',
            purpose: it.purpose ? `${it.purpose}${it.department ? ` (${it.department})` : ''}` : it.department || '-',
            note: it.note || `Theo phiếu ${slip.slipNumber}`,
            type: 'OUTBOUND',
          });
        }
      });
    });

    return rows;
  }, [activeDetailItem, generalInboundSlips, generalOutboundSlips]);

  return (
    <div className="space-y-4">
      {/* THANH TÌM KIẾM TRÊN CÙNG (Đúng vị trí và nhãn như Hình 3) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              // Nếu người dùng gõ tìm kiếm và có ít nhất 1 kết quả khớp, gợi ý mở nhanh
            }}
            placeholder="Tìm kiếm theo tên hàng hoá, mã hàng hoá..."
            className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 font-medium"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedItemKey ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedItemKey(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Xem Tất Cả Mặt Hàng</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Thẻ Kho (A4)</span>
              </button>
            </>
          ) : (
            <div className="text-xs text-slate-500 font-medium">
              Đang quản lý: <strong>{totalItemsCount}</strong> mặt hàng &bull; Tổng tồn: <strong>{totalCurrentStockQty.toLocaleString('vi-VN')}</strong>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Thống Kê Nhanh */}
      {!selectedItemKey && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Tổng Mặt Hàng</p>
              <p className="text-base font-bold text-slate-900">{totalItemsCount}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Tổng Nhập Kho</p>
              <p className="text-base font-bold text-emerald-700">{totalInboundQty.toLocaleString('vi-VN')}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Tổng Xuất Dùng</p>
              <p className="text-base font-bold text-blue-700">{totalOutboundQty.toLocaleString('vi-VN')}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">Tồn Kho Hiện Tại</p>
              <p className="text-base font-bold text-amber-900">{totalCurrentStockQty.toLocaleString('vi-VN')}</p>
            </div>
          </div>
        </div>
      )}

      {/* BANNER XANH ĐẬM "TỒN KHO" (Đúng 100% Theo Mẫu Hình 3) */}
      <div className="bg-[#1f4e78] text-white py-2.5 px-4 text-center rounded-sm shadow-xs">
        <h2 className="text-base sm:text-lg font-bold tracking-wider uppercase">
          TỒN KHO {activeDetailItem ? `- ${activeDetailItem.itemName} (${activeDetailItem.itemCode})` : ''}
        </h2>
      </div>

      {/* NỘI DUNG CHÍNH: */}
      {/* TRƯỜNG HỢP 1: ĐANG CHỌN 1 MẶT HÀNG -> HIỂN THỊ ĐÚNG 100% BẢNG THEO HÌNH 3 */}
      {activeDetailItem ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">{activeDetailItem.itemName}</span>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700 text-[11px]">
                {activeDetailItem.itemCode}
              </span>
              {activeDetailItem.group && (
                <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-800 text-[11px] font-semibold">
                  {activeDetailItem.group}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span className="text-slate-600">
                Tổng Nhập: <strong className="text-emerald-700 font-mono">{activeDetailItem.totalInbound}</strong> {activeDetailItem.unit}
              </span>
              <span className="text-slate-600">
                Tổng Xuất: <strong className="text-blue-700 font-mono">{activeDetailItem.totalOutbound}</strong> {activeDetailItem.unit}
              </span>
              <span className="text-slate-900 font-bold">
                TỒN HIỆN TẠI:{' '}
                <strong className={`font-mono text-sm ${activeDetailItem.currentStock <= 0 ? 'text-rose-600' : 'text-amber-800'}`}>
                  {activeDetailItem.currentStock}
                </strong>{' '}
                {activeDetailItem.unit}
              </span>
            </div>
          </div>

          {/* BẢNG ĐÚNG CỘT THEO HÌNH 3: */}
          {/* STT | Tên hàng hoá | Ngày nhập | Ngày xuất | Lần xuất | Số lượng | Người nhận | Mục đích sử dụng | Ghi chú */}
          <div className="overflow-x-auto border border-slate-300 rounded-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold text-[11px] border-b border-slate-300">
                  <th className="py-2 px-2 border-r border-slate-300 text-center w-10">STT</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[180px]">Tên hàng hoá</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center min-w-[90px]">Ngày nhập</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-center min-w-[90px]">Ngày xuất</th>
                  <th className="py-2 px-2 border-r border-slate-300 text-center min-w-[80px]">Lần xuất</th>
                  <th className="py-2 px-2.5 border-r border-slate-300 text-right min-w-[80px]">Số lượng</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[120px]">Người nhận</th>
                  <th className="py-2 px-3 border-r border-slate-300 min-w-[150px]">Mục đích sử dụng</th>
                  <th className="py-2 px-3 min-w-[130px]">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {stockCardRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                      Chưa có lịch sử nhập xuất cho mặt hàng này.
                    </td>
                  </tr>
                ) : (
                  stockCardRows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-slate-200 transition ${
                        r.type === 'INBOUND' ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-200">
                        {r.stt}
                      </td>
                      <td className="p-2 font-semibold text-slate-900 border-r border-slate-200">
                        {r.itemName}
                      </td>
                      <td className="p-2 text-center font-mono border-r border-slate-200 text-emerald-800 font-medium">
                        {r.inboundDate}
                      </td>
                      <td className="p-2 text-center font-mono border-r border-slate-200 text-blue-800 font-medium">
                        {r.outboundDate}
                      </td>
                      <td className="p-2 text-center border-r border-slate-200">
                        {r.exportSequence !== '-' ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-bold rounded-full text-[10px]">
                            {r.exportSequence}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td
                        className={`p-2 text-right font-mono font-bold border-r border-slate-200 ${
                          r.type === 'INBOUND' ? 'text-emerald-700' : 'text-blue-900'
                        }`}
                      >
                        {r.quantity.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2 text-slate-800 border-r border-slate-200 font-medium">
                        {r.receiver}
                      </td>
                      <td className="p-2 text-slate-700 border-r border-slate-200">
                        {r.purpose}
                      </td>
                      <td className="p-2 text-slate-600 text-[11px]">
                        {r.note}
                      </td>
                    </tr>
                  ))
                )}

                {/* Hàng Tổng Kết Thẻ Kho */}
                <tr className="bg-slate-200 font-bold text-slate-900 border-t-2 border-slate-400">
                  <td colSpan={5} className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px]">
                    TỒN KHO HIỆN TẠI (NHẬP - XUẤT):
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono text-sm text-amber-950 font-black border-r border-slate-300">
                    {activeDetailItem.currentStock.toLocaleString('vi-VN')} {activeDetailItem.unit}
                  </td>
                  <td colSpan={3} className="py-2.5 px-3 text-slate-600 italic text-[11px]">
                    (Tổng Nhập: {activeDetailItem.totalInbound.toLocaleString('vi-VN')} &minus; Tổng Xuất:{' '}
                    {activeDetailItem.totalOutbound.toLocaleString('vi-VN')})
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TRƯỜNG HỢP 2: BẢNG TỔNG HỢP TẤT CẢ MẶT HÀNG (TẦNG 1) */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Danh sách tổng hợp tồn kho tức thời ({filteredSummaryList.length} mặt hàng). Nhấp vào bất kỳ dòng nào để xem
              Thẻ kho chi tiết theo từng lần xuất (Hình 3).
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 text-center w-12">STT</th>
                  <th className="p-2.5 min-w-[100px]">Mã Hàng</th>
                  <th className="p-2.5 min-w-[200px]">Tên Hàng Hóa</th>
                  <th className="p-2.5 min-w-[130px]">Nhóm Phân Loại</th>
                  <th className="p-2.5 text-center w-16">ĐVT</th>
                  <th className="p-2.5 text-right w-24">Tổng Nhập</th>
                  <th className="p-2.5 text-right w-24">Tổng Xuất</th>
                  <th className="p-2.5 text-right w-28">Tồn Kho Hiện Tại</th>
                  <th className="p-2.5 text-center w-28">Trạng Thái</th>
                  <th className="p-2.5 text-center w-32">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSummaryList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                      Không tìm thấy mặt hàng nào phù hợp với từ khóa "{searchTerm}".
                    </td>
                  </tr>
                ) : (
                  filteredSummaryList.map((item, idx) => (
                    <tr
                      key={item.itemCode || idx}
                      onClick={() => setSelectedItemKey(item.itemCode || item.itemName)}
                      className="hover:bg-sky-50/50 transition cursor-pointer"
                    >
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-sky-800 font-mono">{item.itemCode}</td>
                      <td className="p-2.5 font-semibold text-slate-900">{item.itemName}</td>
                      <td className="p-2.5">
                        {item.group ? (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded font-semibold text-[11px]">
                            {item.group}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">{item.unit}</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-emerald-700">
                        {item.totalInbound.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-blue-700">
                        {item.totalOutbound.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-sm">
                        <span className={item.currentStock <= 0 ? 'text-rose-600' : 'text-slate-900'}>
                          {item.currentStock.toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {item.currentStock <= 0 ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                            Hết hàng
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                            Còn hàng
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItemKey(item.itemCode || item.itemName);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded border border-sky-200 transition cursor-pointer"
                        >
                          <span>Xem Thẻ Kho</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL IN THẺ KHO A4 (THEO MẪU HÌNH 3) */}
      {showPrintModal && activeDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
            {/* Modal actions */}
            <div className="no-print p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Bản In Thẻ Kho / Lần Xuất A4 - {activeDetailItem.itemName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>In Ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Vùng in */}
            <div className="print-area p-8 overflow-y-auto flex-1 font-sans text-slate-900 bg-white">
              {/* Header D&D Long An bên góc trái */}
              <div className="flex justify-between items-start border-b border-black pb-3 text-xs">
                <div>
                  <div className="font-bold uppercase text-sm tracking-wide text-black">
                    CÔNG TY TNHH GIA CÔNG THƯƠNG MẠI D&amp;D LONG AN
                  </div>
                  <div className="text-black mt-0.5">
                    Địa chỉ: A8/21C, Bông Văn Dĩa, Xã Tân Nhựt, TP HCM
                  </div>
                  <div className="text-slate-600">
                    Kho nội bộ: Quản lý công cụ, vật tư &amp; thiết bị
                  </div>
                </div>
                <div className="text-right text-[11px] leading-tight text-slate-700">
                  <div className="font-bold">Mẫu số: 06 - VT</div>
                  <div className="italic">(Ban hành theo TT 200/2014/TT-BTC)</div>
                </div>
              </div>

              {/* Tiêu đề thẻ kho */}
              <div className="text-center my-4">
                <h1 className="text-xl font-bold uppercase tracking-wider text-black">
                  THẺ KHO &amp; LỊCH SỬ XUẤT VẬT TƯ
                </h1>
                <div className="text-xs text-slate-700 mt-1">
                  Mặt hàng: <strong>{activeDetailItem.itemName}</strong> &bull; Mã: <strong>{activeDetailItem.itemCode}</strong> &bull; ĐVT: <strong>{activeDetailItem.unit}</strong>
                </div>
              </div>

              {/* Bảng in đúng các cột Hình 3 */}
              <table className="w-full text-xs text-left border-collapse border border-black my-4">
                <thead>
                  <tr className="bg-slate-100 text-black font-bold uppercase text-[10px] text-center">
                    <th className="p-2 border border-black w-8">STT</th>
                    <th className="p-2 border border-black min-w-[180px]">Tên hàng hoá</th>
                    <th className="p-2 border border-black text-center min-w-[85px]">Ngày nhập</th>
                    <th className="p-2 border border-black text-center min-w-[85px]">Ngày xuất</th>
                    <th className="p-2 border border-black text-center min-w-[70px]">Lần xuất</th>
                    <th className="p-2 border border-black text-right min-w-[75px]">Số lượng</th>
                    <th className="p-2 border border-black min-w-[110px]">Người nhận</th>
                    <th className="p-2 border border-black min-w-[130px]">Mục đích sử dụng</th>
                    <th className="p-2 border border-black min-w-[100px]">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {stockCardRows.map((r, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 border border-black text-center font-mono">{r.stt}</td>
                      <td className="p-1.5 border border-black font-semibold">{r.itemName}</td>
                      <td className="p-1.5 border border-black text-center font-mono">{r.inboundDate}</td>
                      <td className="p-1.5 border border-black text-center font-mono">{r.outboundDate}</td>
                      <td className="p-1.5 border border-black text-center font-bold">{r.exportSequence}</td>
                      <td className="p-1.5 border border-black text-right font-mono font-bold">
                        {r.quantity.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 border border-black">{r.receiver}</td>
                      <td className="p-1.5 border border-black">{r.purpose}</td>
                      <td className="p-1.5 border border-black text-slate-600 text-[10px]">{r.note}</td>
                    </tr>
                  ))}

                  {/* Hàng tổng cộng */}
                  <tr className="bg-slate-200 text-black font-bold">
                    <td colSpan={5} className="p-2 border border-black text-right uppercase">
                      TỒN KHO CUỐI CÙNG:
                    </td>
                    <td className="p-2 border border-black text-right font-mono font-bold text-sm">
                      {activeDetailItem.currentStock.toLocaleString('vi-VN')}
                    </td>
                    <td colSpan={3} className="p-2 border border-black text-slate-700 italic text-[10px]">
                      (Đã xuất {activeDetailItem.totalOutbound} / Tổng nhập {activeDetailItem.totalInbound} {activeDetailItem.unit})
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Chữ ký 3 bên */}
              <div className="grid grid-cols-3 gap-4 text-center text-xs mt-10 pt-4 border-t border-slate-300">
                <div>
                  <div className="font-bold uppercase">Người Lập Thẻ</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">Hà</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Thủ Kho</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">Nguyễn Văn Kho</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Kế Toán Kho</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">Trần Thị Thanh</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
