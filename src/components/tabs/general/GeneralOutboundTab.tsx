import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  ListFilter,
  Search,
  CheckCircle2,
  Calendar,
  FileText,
  Building2,
  Eye,
  X,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { useInventory } from '../../../context/InventoryContext';
import { GeneralOutboundSlip, GeneralOutboundItem, GeneralItemGroup } from '../../../types';
import { useMessageBox } from '../../common/MessageBox';

export const GeneralOutboundTab: React.FC = () => {
  const { generalOutboundSlips, saveGeneralOutboundSlip, deleteGeneralOutboundSlip, generalInboundSlips } = useInventory();
  const { toast, confirm } = useMessageBox();

  // Chế độ hiển thị: 'FORM' (Lập / Sửa phiếu) hoặc 'LIST' (Sổ nhật ký phiếu xuất đã lưu)
  const [viewMode, setViewMode] = useState<'FORM' | 'LIST'>('FORM');

  // State phiếu hiện tại
  const getTodayStr = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const [currentSlipId, setCurrentSlipId] = useState<string>('');
  const [slipDate, setSlipDate] = useState<string>(getTodayStr());
  const [slipNumber, setSlipNumber] = useState<string>('');
  const [rows, setRows] = useState<GeneralOutboundItem[]>([
    {
      id: 'row-out-1',
      itemCode: '',
      itemName: '',
      group: 'Vật tư sản xuất',
      unit: 'Cái',
      quantity: 1,
      receiver: '',
      department: 'Chuyền 1',
      purpose: 'Sản xuất đơn hàng',
      note: '',
    },
  ]);

  // Modal in ấn A4
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printSlip, setPrintSlip] = useState<GeneralOutboundSlip | null>(null);

  // Tìm kiếm trong Sổ nhật ký
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Tự động sinh mã phiếu xuất gợi ý
  const generateSlipNumber = () => {
    const todayNum = getTodayStr().replace(/\//g, '').slice(0, 4); // DDMM
    const count = generalOutboundSlips.length + 1;
    const code = `PXK-${todayNum}-${String(count).padStart(2, '0')}`;
    setSlipNumber(code);
  };

  // Danh mục mặt hàng đã từng nhập trong kho để gợi ý chọn nhanh
  const uniqueInboundItems = React.useMemo(() => {
    const map = new Map<string, { itemCode: string; itemName: string; unit: string }>();
    generalInboundSlips.forEach((s) => {
      s.items.forEach((it) => {
        if (it.itemCode && !map.has(it.itemCode)) {
          map.set(it.itemCode, { itemCode: it.itemCode, itemName: it.itemName, unit: it.unit });
        }
      });
    });
    return Array.from(map.values());
  }, [generalInboundSlips]);

  // Thêm dòng mới
  const handleAddRow = () => {
    const newId = `row-out-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        itemCode: '',
        itemName: '',
        group: 'Vật tư sản xuất',
        unit: 'Cái',
        quantity: 1,
        receiver: '',
        department: 'Chuyền 1',
        purpose: 'Sản xuất đơn hàng',
        note: '',
      },
    ]);
  };

  // Cập nhật ô dữ liệu trên dòng
  const handleRowChange = (index: number, field: keyof GeneralOutboundItem, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      // Nếu người dùng chọn/gõ mã hàng đã có trong kho, tự động điền Tên và ĐVT
      if (field === 'itemCode') {
        const found = uniqueInboundItems.find((it) => it.itemCode.toUpperCase() === String(value).toUpperCase().trim());
        if (found) {
          target.itemName = found.itemName;
          target.unit = found.unit;
        }
      }

      next[index] = target;
      return next;
    });
  };

  // Xóa dòng
  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) {
      toast('Phiếu phải có ít nhất 1 dòng vật tư xuất kho.', 'warning');
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Tính tổng
  const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Lập phiếu mới hoàn toàn
  const handleNewSlip = () => {
    setCurrentSlipId('');
    setSlipDate(getTodayStr());
    setSlipNumber('');
    setRows([
      {
        id: `row-out-${Date.now()}`,
        itemCode: '',
        itemName: '',
        group: 'Vật tư sản xuất',
        unit: 'Cái',
        quantity: 1,
        receiver: '',
        department: 'Chuyền 1',
        purpose: 'Sản xuất đơn hàng',
        note: '',
      },
    ]);
    setViewMode('FORM');
  };

  // Lưu phiếu xuất kho
  const handleSaveSlip = () => {
    if (!slipDate.trim()) {
      toast('Vui lòng nhập Ngày lập phiếu xuất!', 'error');
      return;
    }
    if (!slipNumber.trim()) {
      toast('Vui lòng nhập Mã phiếu xuất kho!', 'error');
      return;
    }

    const validRows = rows.filter((r) => r.itemName.trim() || r.itemCode.trim());
    if (validRows.length === 0) {
      toast('Vui lòng nhập ít nhất một mặt hàng có Tên hoặc Mã hàng!', 'error');
      return;
    }

    const slipId = currentSlipId || `gen-out-${Date.now()}`;
    const timestamp = new Date().toLocaleString('vi-VN');

    const slipData: GeneralOutboundSlip = {
      id: slipId,
      slipNumber: slipNumber.trim().toUpperCase(),
      date: slipDate.trim(),
      items: validRows,
      totalQty,
      createdAt: currentSlipId ? (generalOutboundSlips.find((s) => s.id === currentSlipId)?.createdAt || timestamp) : timestamp,
      updatedAt: timestamp,
    };

    saveGeneralOutboundSlip(slipData);
    setCurrentSlipId(slipId);
    toast(`Đã lưu Phiếu Xuất Kho "${slipData.slipNumber}" thành công!`, 'success');
  };

  // Xem / Sửa phiếu từ danh sách
  const handleOpenSlip = (slip: GeneralOutboundSlip) => {
    setCurrentSlipId(slip.id);
    setSlipDate(slip.date);
    setSlipNumber(slip.slipNumber);
    setRows(
      slip.items.map((it) => ({
        ...it,
      }))
    );
    setViewMode('FORM');
  };

  // Xóa phiếu khỏi danh sách
  const handleDeleteSlip = (slip: GeneralOutboundSlip) => {
    confirm(`Bạn có chắc chắn muốn xóa Phiếu Xuất Kho "${slip.slipNumber}"? Tồn kho liên quan sẽ được khôi phục lại.`, () => {
      deleteGeneralOutboundSlip(slip.id);
      if (currentSlipId === slip.id) {
        handleNewSlip();
      }
      toast(`Đã xóa Phiếu Xuất Kho "${slip.slipNumber}".`, 'success');
    });
  };

  // Mở in phiếu hiện tại
  const handlePrintCurrent = () => {
    if (!slipNumber.trim()) {
      toast('Vui lòng điền mã phiếu trước khi in!', 'warning');
      return;
    }
    const slipData: GeneralOutboundSlip = {
      id: currentSlipId || 'temp',
      slipNumber: slipNumber.trim().toUpperCase(),
      date: slipDate.trim(),
      items: rows.filter((r) => r.itemName.trim() || r.itemCode.trim()),
      totalQty,
      createdAt: '',
      updatedAt: '',
    };
    setPrintSlip(slipData);
    setShowPrintModal(true);
  };

  // Mở in một phiếu từ danh sách
  const handlePrintSpecific = (slip: GeneralOutboundSlip) => {
    setPrintSlip(slip);
    setShowPrintModal(true);
  };

  // Lọc danh sách phiếu theo tìm kiếm
  const filteredSlips = generalOutboundSlips.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.slipNumber.toLowerCase().includes(term) ||
      s.date.includes(term) ||
      s.items.some(
        (it) =>
          it.itemName.toLowerCase().includes(term) ||
          it.itemCode.toLowerCase().includes(term) ||
          it.receiver.toLowerCase().includes(term) ||
          it.department.toLowerCase().includes(term)
      )
    );
  });

  return (
    <div className="space-y-4">
      {/* Thanh điều hướng chế độ (Lập Phiếu Xuất vs Sổ Nhật Ký) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('FORM')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'FORM'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Mẫu Phiếu Xuất Kho (Hình 2)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewMode === 'LIST'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Sổ Nhật Ký Phiếu Xuất ({generalOutboundSlips.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewSlip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition cursor-pointer"
            title="Lập phiếu xuất kho trắng mới"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Phiếu Xuất Mới</span>
          </button>

          {viewMode === 'FORM' && (
            <>
              <button
                type="button"
                onClick={handleSaveSlip}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition cursor-pointer"
                title="Lưu phiếu xuất vào hệ thống và trừ tồn kho"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Phiếu Xuất</span>
              </button>

              <button
                type="button"
                onClick={handlePrintCurrent}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
                title="In phiếu xuất khổ A4"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Phiếu (A4)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CHẾ ĐỘ 1: FORM LẬP PHIẾU XUẤT KHO (ĐÚNG 100% THEO HÌNH 2) */}
      {viewMode === 'FORM' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
          {/* Header công ty góc trái (như Hình 2) */}
          <div className="text-left leading-tight text-xs text-slate-800">
            <div className="font-bold text-sm tracking-wide text-slate-900 uppercase">
              CÔNG TY TNHH GIA CÔNG THƯƠNG MẠI D&amp;D LONG AN
            </div>
            <div className="text-slate-600 mt-0.5">
              Địa chỉ: A8/21C, Bông Văn Dĩa, Xã Tân Nhựt, TP HCM
            </div>
          </div>

          {/* Banner Tiêu đề: PHIẾU XUẤT KHO (nền xanh đậm chữ trắng như Hình 2) */}
          <div className="bg-[#1f4e78] text-white py-2.5 px-4 text-center rounded-sm shadow-xs">
            <h2 className="text-base sm:text-lg font-bold tracking-wider uppercase">
              PHIẾU XUẤT KHO
            </h2>
          </div>

          {/* Hàng thông tin Ngày và Mã phiếu (Bắt buộc) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-700 w-24 shrink-0 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>Ngày:</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={slipDate}
                onChange={(e) => setSlipDate(e.target.value)}
                placeholder="DD/MM/YYYY"
                className="w-48 px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-slate-700 w-24 shrink-0 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>Mã phiếu:</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                <input
                  type="text"
                  value={slipNumber}
                  onChange={(e) => setSlipNumber(e.target.value)}
                  placeholder="Ví dụ: PXK-2609-01"
                  className="w-full px-2.5 py-1.5 text-xs font-bold uppercase bg-slate-50 border border-slate-300 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 font-mono"
                />
                {!slipNumber && (
                  <button
                    type="button"
                    onClick={generateSlipNumber}
                    className="px-2 py-1 text-[11px] text-sky-700 bg-sky-100 hover:bg-sky-200 rounded whitespace-nowrap font-medium cursor-pointer"
                    title="Gợi ý mã phiếu tự động"
                  >
                    Tự sinh
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bảng nhập liệu lưới (Header Màu Xanh Đậm Chuẩn Hình 2) */}
          <div className="overflow-x-auto border border-slate-300 rounded-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#2f5597] text-white font-bold text-[11px] text-center border-b border-[#2f5597]">
                  <th className="py-2 px-2 border-r border-blue-400 w-10">STT</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[110px]">Mã hàng</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[180px]">Tên hàng hóa</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[140px]">Nhóm</th>
                  <th className="py-2 px-2 border-r border-blue-400 w-20">ĐVT</th>
                  <th className="py-2 px-2 border-r border-blue-400 w-24">Số lượng xuất</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[120px]">Người nhận</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[130px]">Bộ phận sử dụng</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[150px]">Mục đích sử dụng</th>
                  <th className="py-2 px-2 border-r border-blue-400 min-w-[120px]">Ghi chú</th>
                  <th className="py-2 px-1 w-10">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-blue-50/40 border-b border-slate-200">
                    {/* STT */}
                    <td className="p-1 text-center font-bold text-slate-700 border-r border-slate-200">
                      {idx + 1}
                    </td>

                    {/* Mã hàng (có dropdown gợi ý từ danh mục) */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        list={`items-list-${idx}`}
                        value={row.itemCode}
                        onChange={(e) => handleRowChange(idx, 'itemCode', e.target.value)}
                        placeholder="Mã hàng"
                        className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white font-mono uppercase"
                      />
                      <datalist id={`items-list-${idx}`}>
                        {uniqueInboundItems.map((u) => (
                          <option key={u.itemCode} value={u.itemCode}>
                            {u.itemName} ({u.unit})
                          </option>
                        ))}
                      </datalist>
                    </td>

                    {/* Tên hàng hóa */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => handleRowChange(idx, 'itemName', e.target.value)}
                        placeholder="Tên hàng hóa xuất..."
                        className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Nhóm: Dropdown 1 trong 3 loại bắt buộc (Hình 2) */}
                    <td className="p-1 border-r border-slate-200">
                      <select
                        value={row.group}
                        onChange={(e) => handleRowChange(idx, 'group', e.target.value as GeneralItemGroup)}
                        className="w-full px-1 py-1 text-xs font-bold text-indigo-900 bg-indigo-50/60 border border-indigo-200 rounded focus:bg-white focus:ring-1 focus:ring-sky-500 cursor-pointer"
                      >
                        <option value="Công cụ dụng cụ">Công cụ dụng cụ</option>
                        <option value="Vật tư sản xuất">Vật tư sản xuất</option>
                        <option value="Thiết bị máy móc">Thiết bị máy móc</option>
                      </select>
                    </td>

                    {/* ĐVT */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                        placeholder="Cái, Đôi..."
                        className="w-full px-1 py-1 text-xs text-center border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Số lượng xuất */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.quantity === 0 ? '' : row.quantity}
                        onChange={(e) => handleRowChange(idx, 'quantity', Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-1.5 py-1 text-xs text-right font-bold text-blue-900 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white font-mono"
                      />
                    </td>

                    {/* Người nhận */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.receiver}
                        onChange={(e) => handleRowChange(idx, 'receiver', e.target.value)}
                        placeholder="Tên người nhận"
                        className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Bộ phận sử dụng */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.department}
                        onChange={(e) => handleRowChange(idx, 'department', e.target.value)}
                        placeholder="Chuyền 1, Tổ May..."
                        className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Mục đích sử dụng */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.purpose}
                        onChange={(e) => handleRowChange(idx, 'purpose', e.target.value)}
                        placeholder="Mục đích sử dụng..."
                        className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Ghi chú */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.note || ''}
                        onChange={(e) => handleRowChange(idx, 'note', e.target.value)}
                        placeholder="Ghi chú thêm..."
                        className="w-full px-1.5 py-1 text-xs text-slate-600 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Nút Xóa */}
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                        title="Xóa dòng xuất này"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Hàng Tổng Cộng */}
                <tr className="bg-blue-100/60 font-bold text-slate-900 border-t-2 border-blue-300">
                  <td colSpan={5} className="py-2 px-3 text-right uppercase tracking-wider text-[11px] text-slate-700">
                    TỔNG CỘNG SỐ LƯỢNG XUẤT:
                  </td>
                  <td className="py-2 px-2 text-right text-blue-950 font-mono text-xs font-bold">
                    {totalQty.toLocaleString('vi-VN')}
                  </td>
                  <td colSpan={5} className="py-2 px-3 text-slate-500 italic text-[11px]">
                    ({rows.length} dòng vật tư xuất)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Nút thêm dòng */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm dòng vật tư xuất kho</span>
            </button>

            <div className="text-xs text-slate-500 italic">
              * Cột Nhóm bắt buộc chọn 1 trong 3: Công cụ dụng cụ / Vật tư sản xuất / Thiết bị máy móc.
            </div>
          </div>
        </div>
      )}

      {/* CHẾ ĐỘ 2: SỔ NHẬT KÝ TỔNG HỢP CÁC PHIẾU XUẤT KHO ĐÃ LƯU */}
      {viewMode === 'LIST' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-600" />
                <span>SỔ NHẬT KÝ PHIẾU XUẤT KHO</span>
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp toàn bộ các phiếu xuất kho theo ngày. Bấm để xem lại, sửa đổi hoặc in lại bất cứ lúc nào.
              </p>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã phiếu, người nhận, tên hàng..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Bảng danh sách phiếu xuất */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 text-center w-12">STT</th>
                  <th className="p-2.5 min-w-[120px]">Mã Phiếu</th>
                  <th className="p-2.5 min-w-[90px]">Ngày Xuất</th>
                  <th className="p-2.5 text-center w-24">Số Dòng</th>
                  <th className="p-2.5 text-right w-28">Tổng SL Xuất</th>
                  <th className="p-2.5 min-w-[140px]">Người Nhận / Bộ Phận</th>
                  <th className="p-2.5 min-w-[160px]">Chi Tiết Mặt Hàng</th>
                  <th className="p-2.5 text-center w-36">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSlips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      Không tìm thấy phiếu xuất kho nào. Hãy bấm "Tạo Phiếu Xuất Mới" để ghi nhận lần xuất đầu tiên!
                    </td>
                  </tr>
                ) : (
                  filteredSlips.map((slip, idx) => (
                    <tr key={slip.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-blue-700 font-mono">{slip.slipNumber}</td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">{slip.date}</td>
                      <td className="p-2.5 text-center font-medium">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded-full text-[11px] font-bold">
                          {slip.items.length} dòng
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                        {slip.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {slip.items.map((it) => it.receiver ? `${it.receiver} (${it.department})` : it.department).filter(Boolean).slice(0, 2).join(', ')}
                      </td>
                      <td className="p-2.5 text-slate-600 text-[11px] max-w-xs truncate">
                        {slip.items.map((it) => it.itemName || it.itemCode).join(', ')}
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenSlip(slip)}
                            className="p-1.5 text-sky-600 hover:bg-sky-50 rounded transition cursor-pointer"
                            title="Mở phiếu để xem hoặc sửa"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSpecific(slip)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                            title="In lại phiếu xuất này ra giấy A4"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlip(slip)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Xóa phiếu xuất này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC VÀ IN PHIẾU XUẤT KHO KHỔ A4 */}
      {showPrintModal && printSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
            {/* Thanh tác vụ modal */}
            <div className="no-print p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Bản In Phiếu Xuất Kho A4 - {printSlip.slipNumber}
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

            {/* Vùng in giấy A4 */}
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
                  <div className="font-bold">Mẫu số: 02 - VT</div>
                  <div className="italic">(Ban hành theo TT 200/2014/TT-BTC)</div>
                </div>
              </div>

              {/* Tiêu đề phiếu */}
              <div className="text-center my-5">
                <h1 className="text-xl font-bold uppercase tracking-wider text-black">
                  PHIẾU XUẤT KHO
                </h1>
                <div className="text-xs italic text-slate-700 mt-1">
                  Ngày: <strong>{printSlip.date}</strong> &bull; Mã phiếu: <strong>{printSlip.slipNumber}</strong>
                </div>
              </div>

              {/* Bảng chi tiết */}
              <table className="w-full text-xs text-left border-collapse border border-black my-4">
                <thead>
                  <tr className="bg-slate-100 text-black font-bold uppercase text-[10px] text-center">
                    <th className="p-2 border border-black w-8">STT</th>
                    <th className="p-2 border border-black min-w-[90px]">Mã hàng</th>
                    <th className="p-2 border border-black min-w-[180px]">Tên hàng hóa</th>
                    <th className="p-2 border border-black min-w-[120px]">Nhóm</th>
                    <th className="p-2 border border-black w-14">ĐVT</th>
                    <th className="p-2 border border-black w-20 text-right">Số lượng</th>
                    <th className="p-2 border border-black min-w-[95px]">Người nhận</th>
                    <th className="p-2 border border-black min-w-[100px]">Bộ phận</th>
                    <th className="p-2 border border-black min-w-[120px]">Mục đích sử dụng</th>
                    <th className="p-2 border border-black min-w-[90px]">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {printSlip.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="p-1.5 border border-black text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-black font-mono font-semibold">{it.itemCode || '-'}</td>
                      <td className="p-1.5 border border-black font-semibold">{it.itemName}</td>
                      <td className="p-1.5 border border-black text-center font-medium">{it.group}</td>
                      <td className="p-1.5 border border-black text-center">{it.unit}</td>
                      <td className="p-1.5 border border-black text-right font-mono font-bold">
                        {it.quantity.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 border border-black">{it.receiver || '-'}</td>
                      <td className="p-1.5 border border-black">{it.department || '-'}</td>
                      <td className="p-1.5 border border-black">{it.purpose || '-'}</td>
                      <td className="p-1.5 border border-black text-slate-600 text-[10px]">{it.note || '-'}</td>
                    </tr>
                  ))}

                  {/* Tổng cộng */}
                  <tr className="bg-slate-200 text-black font-bold">
                    <td colSpan={5} className="p-2 border border-black text-right uppercase">
                      TỔNG CỘNG XUẤT:
                    </td>
                    <td className="p-2 border border-black text-right font-mono font-bold">
                      {printSlip.totalQty.toLocaleString('vi-VN')}
                    </td>
                    <td colSpan={4} className="p-2 border border-black text-center italic text-[10px]">
                      Đã giao nhận đúng quy cách
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Chữ ký 4 cột */}
              <div className="grid grid-cols-4 gap-4 text-center text-xs mt-10 pt-4 border-t border-slate-300">
                <div>
                  <div className="font-bold uppercase">Người Lập Phiếu</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">Vũ Minh Đức</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Người Nhận Hàng</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">{printSlip.items[0]?.receiver || 'Người nhận'}</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Thủ Kho Xuất</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">Nguyễn Văn Kho</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Kế Toán / Giám Đốc</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, đóng dấu)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">D&amp;D Long An</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
