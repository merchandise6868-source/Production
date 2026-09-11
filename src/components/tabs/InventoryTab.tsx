import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Warehouse,
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  Search,
  Edit3,
  RotateCcw,
  X,
  Download,
} from 'lucide-react';
import { exportInventoryAuditToExcel } from '../../utils/excelExport';

export const InventoryTab: React.FC = () => {
  const {
    currentCustomer,
    inventoryMovementData,
    inventories,
    updateInventoryActual,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    stockSystem: number;
    stockActual: number;
    unit: string;
  } | null>(null);

  const [actualInput, setActualInput] = useState<number>(0);
  const [auditDateInput, setAuditDateInput] = useState<string>(getCurrentDateFormatted());
  const [noteInput, setNoteInput] = useState<string>('');

  const handleOpenAuditModal = (item: typeof inventoryMovementData[0]) => {
    const existingAudit = inventories.find((inv) => inv.id === item.id);

    setEditingItem({
      id: item.id,
      name: `${item.originalName} (${item.vnName}) - Size ${item.size}`,
      stockSystem: item.closingStock,
      stockActual: existingAudit ? existingAudit.stockActual : item.closingStock,
      unit: item.unit,
    });
    setActualInput(existingAudit ? existingAudit.stockActual : item.closingStock);
    setAuditDateInput(existingAudit?.auditDate || getCurrentDateFormatted());
    setNoteInput(existingAudit?.note || 'Kiểm kê định kỳ tháng 9');
  };

  const handleSaveAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    updateInventoryActual(editingItem.id, actualInput, auditDateInput, noteInput);
    setEditingItem(null);
    alert('Đã cập nhật biên bản kiểm kê thực tế kho thành công!');
  };

  const handleResetAudit = (item: typeof inventoryMovementData[0]) => {
    if (window.confirm(`Khôi phục số kiểm kê thực tế của "${item.originalName}" về bằng số tồn phần mềm (${item.closingStock})?`)) {
      updateInventoryActual(item.id, item.closingStock, getCurrentDateFormatted(), 'Đã đồng bộ lại khớp số phần mềm');
    }
  };

  const filteredItems = inventoryMovementData.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.poNumber.toLowerCase().includes(q) ||
      item.originalName.toLowerCase().includes(q) ||
      item.vnName.toLowerCase().includes(q) ||
      item.size.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold text-slate-900">
              Tồn Kho Vật Tư Khả Dụng & Kiểm Kê Định Kỳ (Sửa Số Đếm Thực Tế / Cân Đối Kho)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Đối chiếu số lượng tồn trên phần mềm với số đếm thực tế, ghi nhận thất thoát và điều chỉnh cân đối kho cho khách hàng: <strong className="text-sky-600">{currentCustomer?.name}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              exportInventoryAuditToExcel(
                inventoryMovementData,
                inventories,
                currentCustomer?.name || 'Chung'
              )
            }
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition"
            title="In / Xuất bảng kiểm kê và tồn kho ra file Excel"
          >
            <Download className="w-4 h-4" />
            <span>In / Xuất Excel</span>
          </button>
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder="Tìm theo PO, tên NVL, size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 focus:ring-1 focus:ring-sky-500 bg-white"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-3">Mã PO / Kiểu</th>
                <th className="py-3 px-4">Tên NVL (Gốc)</th>
                <th className="py-3 px-4">Tên Tiếng Việt</th>
                <th className="py-3 px-2 text-center">Size</th>
                <th className="py-3 px-3 text-right">Tồn Phần Mềm</th>
                <th className="py-3 px-3 text-right">Kiểm Kê Thực Tế</th>
                <th className="py-3 px-3 text-center">Chênh Lệch Thất Thoát</th>
                <th className="py-3 px-3 text-center">Ngày Kiểm Kê Gần Nhất</th>
                <th className="py-3 px-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    Chưa có dữ liệu tồn kho nào cho khách hàng này.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const savedAudit = inventories.find((inv) => inv.id === item.id);
                  const actual = savedAudit ? savedAudit.stockActual : item.closingStock;
                  const diff = actual - item.closingStock;
                  const auditDate = savedAudit?.auditDate || getCurrentDateFormatted();

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-sky-700">{item.poNumber}</div>
                        <div className="text-[11px] text-slate-500">{item.style}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {item.originalName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.vnName}
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-bold text-indigo-700">
                        {item.size}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-800 text-sm">
                        {item.closingStock} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                        {actual} {item.unit}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {diff === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Khớp 100%
                          </span>
                        ) : diff < 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Hao hụt {Math.abs(diff)} {item.unit}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            Thừa {diff} {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                        {auditDate}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpenAuditModal(item)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 px-2 py-1 rounded-md border border-sky-200 transition mr-1"
                          title="Sửa số kiểm kê thực tế"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa Đếm</span>
                        </button>
                        <button
                          onClick={() => handleResetAudit(item)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-2 py-1 rounded-md border border-slate-200 transition"
                          title="Đồng bộ lại khớp với số tồn phần mềm"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Khớp Lại</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Audit Entry */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Cập Nhật Kiểm Kê Thực Tế Kho
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAudit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div className="font-bold text-slate-900">{editingItem.name}</div>
                <div className="text-slate-600">
                  Tồn kho phần mềm: <strong className="text-slate-800">{editingItem.stockSystem} {editingItem.unit}</strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày Kiểm Kê (DD/MM/YYYY) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="DD/MM/YYYY"
                  value={auditDateInput}
                  onChange={(e) => setAuditDateInput(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số Lượng Đếm Thực Tế Tại Kho ({editingItem.unit}) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={actualInput}
                  onChange={(e) => setActualInput(Number(e.target.value))}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 font-bold text-emerald-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="p-2.5 rounded-lg text-xs font-semibold bg-slate-100 flex justify-between">
                <span>Chênh lệch thất thoát:</span>
                <span className={actualInput - editingItem.stockSystem < 0 ? 'text-rose-600 font-bold' : 'text-emerald-700 font-bold'}>
                  {actualInput - editingItem.stockSystem} {editingItem.unit}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi Chú Kiểm Kê
                </label>
                <input
                  type="text"
                  placeholder="Nguyên nhân hao hụt, vị trí kệ..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow"
                >
                  Lưu Kết Quả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
