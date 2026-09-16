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
} from 'lucide-react';
import { useInventory } from '../../../context/InventoryContext';
import { GeneralInboundSlip, GeneralInboundItem } from '../../../types';
import { useMessageBox } from '../../common/MessageBox';

export const GeneralInboundTab: React.FC = () => {
  const { generalInboundSlips, saveGeneralInboundSlip, deleteGeneralInboundSlip } = useInventory();
  const { toast, confirm } = useMessageBox();

  // Chế độ hiển thị: 'FORM' (Lập / Sửa phiếu) hoặc 'LIST' (Sổ nhật ký phiếu đã lưu)
  const [viewMode, setViewMode] = useState<'FORM' | 'LIST'>('FORM');

  // State phiếu hiện tại trên form
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
  const [rows, setRows] = useState<GeneralInboundItem[]>([
    {
      id: 'row-1',
      itemCode: '',
      itemName: '',
      unit: 'Cái',
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      receiver: 'Hà',
      department: 'Kho',
      note: '',
    },
  ]);

  // Modal in ấn A4
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printSlip, setPrintSlip] = useState<GeneralInboundSlip | null>(null);

  // Tìm kiếm trong Sổ nhật ký
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Tự động sinh mã phiếu gợi ý
  const generateSlipNumber = () => {
    const todayNum = getTodayStr().replace(/\//g, '').slice(0, 4); // DDMM
    const count = generalInboundSlips.length + 1;
    const code = `PNK-${todayNum}-${String(count).padStart(2, '0')}`;
    setSlipNumber(code);
  };

  // Thêm dòng mới
  const handleAddRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        itemCode: '',
        itemName: '',
        unit: 'Cái',
        quantity: 1,
        unitPrice: 0,
        totalAmount: 0,
        receiver: 'Hà',
        department: 'Kho',
        note: '',
      },
    ]);
  };

  // Cập nhật ô dữ liệu trên dòng
  const handleRowChange = (index: number, field: keyof GeneralInboundItem, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const target = { ...next[index], [field]: value };

      // Tự động tính Thành tiền = Số lượng * Đơn giá
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) || 0 : Number(target.quantity) || 0;
        const price = field === 'unitPrice' ? Number(value) || 0 : Number(target.unitPrice) || 0;
        target.totalAmount = qty * price;
      }

      next[index] = target;
      return next;
    });
  };

  // Xóa dòng
  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) {
      toast('Phiếu phải có ít nhất 1 dòng vật tư.', 'warning');
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Tính tổng
  const totalQty = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalAmount = rows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);

  // Lập phiếu mới hoàn toàn
  const handleNewSlip = () => {
    setCurrentSlipId('');
    setSlipDate(getTodayStr());
    setSlipNumber('');
    setRows([
      {
        id: `row-${Date.now()}`,
        itemCode: '',
        itemName: '',
        unit: 'Cái',
        quantity: 1,
        unitPrice: 0,
        totalAmount: 0,
        receiver: 'Hà',
        department: 'Kho',
        note: '',
      },
    ]);
    setViewMode('FORM');
  };

  // Lưu phiếu
  const handleSaveSlip = () => {
    if (!slipDate.trim()) {
      toast('Vui lòng nhập Ngày lập phiếu!', 'error');
      return;
    }
    if (!slipNumber.trim()) {
      toast('Vui lòng nhập Mã số phiếu nhập kho!', 'error');
      return;
    }

    const validRows = rows.filter((r) => r.itemName.trim() || r.itemCode.trim());
    if (validRows.length === 0) {
      toast('Vui lòng nhập ít nhất một mặt hàng có Tên hoặc Mã hàng!', 'error');
      return;
    }

    const slipId = currentSlipId || `gen-in-${Date.now()}`;
    const timestamp = new Date().toLocaleString('vi-VN');

    const slipData: GeneralInboundSlip = {
      id: slipId,
      slipNumber: slipNumber.trim().toUpperCase(),
      date: slipDate.trim(),
      items: validRows,
      totalQty,
      totalAmount,
      createdAt: currentSlipId ? (generalInboundSlips.find((s) => s.id === currentSlipId)?.createdAt || timestamp) : timestamp,
      updatedAt: timestamp,
    };

    saveGeneralInboundSlip(slipData);
    setCurrentSlipId(slipId);
    toast(`Đã lưu Phiếu Nhập Kho "${slipData.slipNumber}" thành công!`, 'success');
  };

  // Xem / Sửa phiếu từ danh sách
  const handleOpenSlip = (slip: GeneralInboundSlip) => {
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
  const handleDeleteSlip = (slip: GeneralInboundSlip) => {
    confirm(`Bạn có chắc chắn muốn xóa Phiếu Nhập Kho "${slip.slipNumber}"? Tồn kho liên quan sẽ được điều chỉnh lại.`, () => {
      deleteGeneralInboundSlip(slip.id);
      if (currentSlipId === slip.id) {
        handleNewSlip();
      }
      toast(`Đã xóa Phiếu Nhập Kho "${slip.slipNumber}".`, 'success');
    });
  };

  // Mở in phiếu hiện tại
  const handlePrintCurrent = () => {
    if (!slipNumber.trim()) {
      toast('Vui lòng điền mã số phiếu trước khi in!', 'warning');
      return;
    }
    const slipData: GeneralInboundSlip = {
      id: currentSlipId || 'temp',
      slipNumber: slipNumber.trim().toUpperCase(),
      date: slipDate.trim(),
      items: rows.filter((r) => r.itemName.trim() || r.itemCode.trim()),
      totalQty,
      totalAmount,
      createdAt: '',
      updatedAt: '',
    };
    setPrintSlip(slipData);
    setShowPrintModal(true);
  };

  // Mở in một phiếu từ danh sách
  const handlePrintSpecific = (slip: GeneralInboundSlip) => {
    setPrintSlip(slip);
    setShowPrintModal(true);
  };

  // Lọc danh sách phiếu theo tìm kiếm
  const filteredSlips = generalInboundSlips.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.slipNumber.toLowerCase().includes(term) ||
      s.date.includes(term) ||
      s.items.some((it) => it.itemName.toLowerCase().includes(term) || it.itemCode.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Thanh điều hướng chế độ (Lập Phiếu vs Sổ Nhật Ký) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('FORM')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'FORM'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mẫu Phiếu Nhập Kho (Hình 1)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              viewMode === 'LIST'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Sổ Nhật Ký Phiếu Đã Lưu ({generalInboundSlips.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewSlip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition"
            title="Lập phiếu nhập kho trắng mới"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo Phiếu Mới</span>
          </button>

          {viewMode === 'FORM' && (
            <>
              <button
                type="button"
                onClick={handleSaveSlip}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition cursor-pointer"
                title="Lưu phiếu vào hệ thống và cập nhật tồn kho"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Phiếu</span>
              </button>

              <button
                type="button"
                onClick={handlePrintCurrent}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition cursor-pointer"
                title="In phiếu khổ A4"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>In Phiếu (A4)</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CHẾ ĐỘ 1: FORM LẬP PHIẾU NHẬP KHO (ĐÚNG 100% THEO HÌNH 1) */}
      {viewMode === 'FORM' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
          {/* Header công ty góc trái (như Hình 1) */}
          <div className="text-left leading-tight text-xs text-slate-800">
            <div className="font-bold text-sm tracking-wide text-slate-900 uppercase">
              CÔNG TY TNHH GIA CÔNG THƯƠNG MẠI D&amp;D LONG AN
            </div>
            <div className="text-slate-600 mt-0.5">
              Địa chỉ: A8/21C, Bông Văn Dĩa, Xã Tân Nhựt, TP HCM
            </div>
          </div>

          {/* Banner Tiêu đề: PHIẾU NHẬP KHO (nền xanh đậm chữ trắng như Hình 1) */}
          <div className="bg-[#1f4e78] text-white py-2.5 px-4 text-center rounded-sm shadow-xs">
            <h2 className="text-base sm:text-lg font-bold tracking-wider uppercase">
              PHIẾU NHẬP KHO
            </h2>
          </div>

          {/* Hàng thông tin Ngày và Mã số phiếu (Bắt buộc) */}
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
              <label className="font-bold text-slate-700 w-28 shrink-0 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-sky-600" />
                <span>Mã số phiếu:</span>
                <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                <input
                  type="text"
                  value={slipNumber}
                  onChange={(e) => setSlipNumber(e.target.value)}
                  placeholder="Ví dụ: PNK-2609-01"
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

          {/* Bảng nhập liệu lưới (Header Màu Cam Chuẩn Hình 1) */}
          <div className="overflow-x-auto border border-slate-300 rounded-sm">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#ed7d31] text-white font-bold text-[11px] text-center border-b border-[#ed7d31]">
                  <th className="py-2 px-2 border-r border-orange-400 w-10">STT</th>
                  <th className="py-2 px-2 border-r border-orange-400 min-w-[110px]">Mã hàng</th>
                  <th className="py-2 px-2 border-r border-orange-400 min-w-[180px]">Tên hàng hóa</th>
                  <th className="py-2 px-2 border-r border-orange-400 w-20">ĐVT</th>
                  <th className="py-2 px-2 border-r border-orange-400 w-24">Số lượng</th>
                  <th className="py-2 px-2 border-r border-orange-400 w-28">Đơn giá</th>
                  <th className="py-2 px-2 border-r border-orange-400 w-32">Thành tiền</th>
                  <th className="py-2 px-2 border-r border-orange-400 min-w-[110px]">Người nhập</th>
                  <th className="py-2 px-2 border-r border-orange-400 min-w-[120px]">Bộ phận nhập kho</th>
                  <th className="py-2 px-2 border-r border-orange-400 min-w-[130px]">Ghi chú</th>
                  <th className="py-2 px-1 w-10">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-amber-50/40 border-b border-slate-200">
                    {/* STT */}
                    <td className="p-1 text-center font-bold text-slate-700 border-r border-slate-200">
                      {idx + 1}
                    </td>

                    {/* Mã hàng */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.itemCode}
                        onChange={(e) => handleRowChange(idx, 'itemCode', e.target.value)}
                        placeholder="Mã hàng"
                        className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white font-mono uppercase"
                      />
                    </td>

                    {/* Tên hàng hóa */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.itemName}
                        onChange={(e) => handleRowChange(idx, 'itemName', e.target.value)}
                        placeholder="Tên hàng hóa, quy cách..."
                        className="w-full px-1.5 py-1 text-xs font-semibold text-slate-800 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
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

                    {/* Số lượng */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.quantity === 0 ? '' : row.quantity}
                        onChange={(e) => handleRowChange(idx, 'quantity', Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-1.5 py-1 text-xs text-right font-bold text-sky-800 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white font-mono"
                      />
                    </td>

                    {/* Đơn giá */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="number"
                        min="0"
                        value={row.unitPrice === 0 ? '' : row.unitPrice}
                        onChange={(e) => handleRowChange(idx, 'unitPrice', Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-1.5 py-1 text-xs text-right font-medium text-slate-700 border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white font-mono"
                      />
                    </td>

                    {/* Thành tiền (Tự động tính = Số lượng * Đơn giá) */}
                    <td className="p-1 text-right font-bold text-slate-900 border-r border-slate-200 bg-slate-50/70 font-mono">
                      {row.totalAmount.toLocaleString('vi-VN')}
                    </td>

                    {/* Người nhập (mặc định "Hà" như Hình 1) */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.receiver}
                        onChange={(e) => handleRowChange(idx, 'receiver', e.target.value)}
                        placeholder="Hà"
                        className="w-full px-1.5 py-1 text-xs border border-transparent hover:border-slate-300 focus:border-sky-500 rounded focus:bg-white"
                      />
                    </td>

                    {/* Bộ phận nhập kho (mặc định "Kho" như Hình 1) */}
                    <td className="p-1 border-r border-slate-200">
                      <input
                        type="text"
                        value={row.department}
                        onChange={(e) => handleRowChange(idx, 'department', e.target.value)}
                        placeholder="Kho"
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
                        title="Xóa dòng này"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Hàng Tổng Cộng */}
                <tr className="bg-amber-100/60 font-bold text-slate-900 border-t-2 border-orange-300">
                  <td colSpan={4} className="py-2 px-3 text-right uppercase tracking-wider text-[11px] text-slate-700">
                    TỔNG CỘNG:
                  </td>
                  <td className="py-2 px-2 text-right text-sky-900 font-mono text-xs">
                    {totalQty.toLocaleString('vi-VN')}
                  </td>
                  <td></td>
                  <td className="py-2 px-2 text-right text-rose-700 font-mono text-xs">
                    {totalAmount.toLocaleString('vi-VN')} đ
                  </td>
                  <td colSpan={4} className="py-2 px-2 text-slate-500 italic text-[11px]">
                    ({rows.length} dòng hàng hóa)
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
              <span>Thêm dòng hàng hóa mới</span>
            </button>

            <div className="text-xs text-slate-500 italic">
              * Mẹo: Thành tiền được tự động tính (Số lượng &times; Đơn giá).
            </div>
          </div>
        </div>
      )}

      {/* CHẾ ĐỘ 2: SỔ NHẬT KÝ TỔNG HỢP CÁC PHIẾU NHẬP KHO ĐÃ LƯU */}
      {viewMode === 'LIST' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                <span>SỔ NHẬT KÝ PHIẾU NHẬP KHO</span>
              </h3>
              <p className="text-xs text-slate-500">
                Tổng hợp toàn bộ các phiếu nhập kho đã lưu. Bấm để xem lại, sửa đổi hoặc in lại bất cứ lúc nào.
              </p>
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm mã phiếu, ngày, tên hàng..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Bảng danh sách phiếu */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 text-center w-12">STT</th>
                  <th className="p-2.5 min-w-[120px]">Mã Phiếu</th>
                  <th className="p-2.5 min-w-[90px]">Ngày Nhập</th>
                  <th className="p-2.5 text-center w-24">Số Mặt Hàng</th>
                  <th className="p-2.5 text-right w-28">Tổng Số Lượng</th>
                  <th className="p-2.5 text-right w-36">Tổng Thành Tiền</th>
                  <th className="p-2.5 min-w-[150px]">Chi Tiết Mặt Hàng</th>
                  <th className="p-2.5 text-center w-36">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSlips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                      Không tìm thấy phiếu nhập kho nào. Hãy bấm "Tạo Phiếu Mới" để lập phiếu nhập kho đầu tiên!
                    </td>
                  </tr>
                ) : (
                  filteredSlips.map((slip, idx) => (
                    <tr key={slip.id} className="hover:bg-slate-50 transition">
                      <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-sky-700 font-mono">{slip.slipNumber}</td>
                      <td className="p-2.5 text-slate-700 whitespace-nowrap">{slip.date}</td>
                      <td className="p-2.5 text-center font-medium">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-full text-[11px]">
                          {slip.items.length} món
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                        {slip.totalQty.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-2.5 text-right font-bold text-rose-700 font-mono">
                        {slip.totalAmount.toLocaleString('vi-VN')} đ
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
                            title="In lại phiếu này ra giấy A4"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlip(slip)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Xóa phiếu này"
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

      {/* MODAL XEM TRƯỚC VÀ IN PHIẾU NHẬP KHO KHỔ A4 */}
      {showPrintModal && printSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden">
            {/* Thanh tác vụ modal */}
            <div className="no-print p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase">
                  Bản In Phiếu Nhập Kho A4 - {printSlip.slipNumber}
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
                  <div className="font-bold">Mẫu số: 01 - VT</div>
                  <div className="italic">(Ban hành theo TT 200/2014/TT-BTC)</div>
                </div>
              </div>

              {/* Tiêu đề phiếu */}
              <div className="text-center my-5">
                <h1 className="text-xl font-bold uppercase tracking-wider text-black">
                  PHIẾU NHẬP KHO
                </h1>
                <div className="text-xs italic text-slate-700 mt-1">
                  Ngày: <strong>{printSlip.date}</strong> &bull; Mã số phiếu: <strong>{printSlip.slipNumber}</strong>
                </div>
              </div>

              {/* Bảng chi tiết */}
              <table className="w-full text-xs text-left border-collapse border border-black my-4">
                <thead>
                  <tr className="bg-slate-100 text-black font-bold uppercase text-[10px] text-center">
                    <th className="p-2 border border-black w-8">STT</th>
                    <th className="p-2 border border-black min-w-[90px]">Mã hàng</th>
                    <th className="p-2 border border-black min-w-[180px]">Tên hàng hóa</th>
                    <th className="p-2 border border-black w-14">ĐVT</th>
                    <th className="p-2 border border-black w-20 text-right">Số lượng</th>
                    <th className="p-2 border border-black w-24 text-right">Đơn giá</th>
                    <th className="p-2 border border-black w-28 text-right">Thành tiền</th>
                    <th className="p-2 border border-black min-w-[90px]">Người nhập</th>
                    <th className="p-2 border border-black min-w-[100px]">Bộ phận</th>
                    <th className="p-2 border border-black min-w-[100px]">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {printSlip.items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="p-1.5 border border-black text-center font-mono">{idx + 1}</td>
                      <td className="p-1.5 border border-black font-mono font-semibold">{it.itemCode || '-'}</td>
                      <td className="p-1.5 border border-black font-semibold">{it.itemName}</td>
                      <td className="p-1.5 border border-black text-center">{it.unit}</td>
                      <td className="p-1.5 border border-black text-right font-mono font-bold">
                        {it.quantity.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 border border-black text-right font-mono">
                        {it.unitPrice > 0 ? it.unitPrice.toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="p-1.5 border border-black text-right font-mono font-bold">
                        {it.totalAmount.toLocaleString('vi-VN')}
                      </td>
                      <td className="p-1.5 border border-black">{it.receiver || 'Hà'}</td>
                      <td className="p-1.5 border border-black">{it.department || 'Kho'}</td>
                      <td className="p-1.5 border border-black text-slate-600 text-[10px]">{it.note || '-'}</td>
                    </tr>
                  ))}

                  {/* Tổng cộng */}
                  <tr className="bg-slate-200 text-black font-bold">
                    <td colSpan={4} className="p-2 border border-black text-right uppercase">
                      TỔNG CỘNG:
                    </td>
                    <td className="p-2 border border-black text-right font-mono font-bold">
                      {printSlip.totalQty.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-2 border border-black"></td>
                    <td className="p-2 border border-black text-right font-mono font-bold">
                      {printSlip.totalAmount.toLocaleString('vi-VN')} đ
                    </td>
                    <td colSpan={3} className="p-2 border border-black text-center italic text-[10px]">
                      Đã kiểm đủ
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
                  <div className="font-semibold text-slate-700">{printSlip.items[0]?.receiver || 'Hà'}</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Người Giao Hàng</div>
                  <div className="italic text-[10px] text-slate-500">(Ký, họ tên)</div>
                  <div className="h-16"></div>
                  <div className="font-semibold text-slate-700">Đơn vị cung cấp</div>
                </div>

                <div>
                  <div className="font-bold uppercase">Thủ Kho Nhận</div>
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
