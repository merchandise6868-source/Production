import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Customer, PurchaseOrder } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Package,
  Calendar,
  X,
  Download,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { exportCustomersAndPOsToExcel } from '../../utils/excelExport';

export const CustomerTab: React.FC = () => {
  const {
    customers,
    selectedCustomerId,
    setSelectedCustomerId,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    currentCustomerPOs,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
  } = useInventory();

  // Active customer selection
  const [activeCustId, setActiveCustId] = useState<string>(selectedCustomerId);
  const currentCust = customers.find((c) => c.id === activeCustId) || customers[0];

  // Unified Customer + Size Modal State (Thêm / Sửa Công Ty & Dải Size)
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formSizes, setFormSizes] = useState('');
  const [formNote, setFormNote] = useState('');

  // PO Modal State
  const [showPoModal, setShowPoModal] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [poStyle, setPoStyle] = useState('');
  const [poDate, setPoDate] = useState(getCurrentDateFormatted());
  const [poTargetQty, setPoTargetQty] = useState<number | ''>(10);
  const [poUnit, setPoUnit] = useState('đôi');
  const [poNote, setPoNote] = useState('');

  // Helper to extract active sizes from customer
  const getCustomerSizes = (cust: Customer): string[] => {
    const activeRun =
      cust.sizeRuns.find((sr) => sr.id === cust.activeSizeRunId) ||
      cust.sizeRuns[0];
    return activeRun?.sizes || ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  };

  // Open Modal to Add New Customer
  const handleOpenAddCustomer = () => {
    setEditingCust(null);
    setFormName('');
    setFormCode('');
    setFormSizes('4, 5, 6, 7, 8, 9, 10, 11, 12');
    setFormNote('');
    setShowCustModal(true);
  };

  // Open Modal to Edit Customer & Size
  const handleOpenEditCustomer = (cust: Customer) => {
    setEditingCust(cust);
    setFormName(cust.name);
    setFormCode(cust.code);
    setFormSizes(getCustomerSizes(cust).join(', '));
    setFormNote(cust.note || '');
    setShowCustModal(true);
  };

  // Save Customer & Size (Tên Công Ty + Dải Size)
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Vui lòng nhập tên công ty / đối tác.');
      return;
    }

    const sizesArr = formSizes
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sizesArr.length === 0) {
      alert('Vui lòng nhập ít nhất một size cho công ty.');
      return;
    }

    const generatedCode = formCode.trim().toUpperCase() || formName.trim().slice(0, 3).toUpperCase();
    const sizeRunId = editingCust?.activeSizeRunId || `sr-${Date.now()}`;

    if (editingCust) {
      // Update
      const updatedCust: Customer = {
        ...editingCust,
        name: formName.trim(),
        code: generatedCode,
        note: formNote.trim(),
        sizeRuns: [
          {
            id: sizeRunId,
            name: `Dải size (${sizesArr[0]} - ${sizesArr[sizesArr.length - 1]})`,
            sizes: sizesArr,
          },
        ],
        activeSizeRunId: sizeRunId,
      };

      updateCustomer(updatedCust);
      alert('Đã cập nhật thông tin công ty và dải size thành công!');
    } else {
      // Create new
      const newCustId = `cust-${Date.now()}`;
      const newCust: Customer = {
        id: newCustId,
        name: formName.trim(),
        code: generatedCode,
        note: formNote.trim(),
        sizeRuns: [
          {
            id: sizeRunId,
            name: `Dải size (${sizesArr[0]} - ${sizesArr[sizesArr.length - 1]})`,
            sizes: sizesArr,
          },
        ],
        activeSizeRunId: sizeRunId,
      };

      addCustomer(newCust);
      setActiveCustId(newCust.id);
      setSelectedCustomerId(newCust.id);
      alert('Đã thêm đối tác và cấu hình dải size thành công!');
    }

    setShowCustModal(false);
  };

  // Delete Customer
  const handleDeleteCustomer = (cust: Customer) => {
    if (customers.length <= 1) {
      alert('Hệ thống cần ít nhất 1 khách hàng. Không thể xóa khách hàng duy nhất!');
      return;
    }
    if (
      window.confirm(
        `Bạn có chắc chắn muốn XÓA đối tác "${cust.name}"? Dữ liệu dải size và đơn PO của đối tác này sẽ bị xóa.`
      )
    ) {
      deleteCustomer(cust.id);
      const remaining = customers.filter((c) => c.id !== cust.id);
      if (remaining.length > 0) {
        setActiveCustId(remaining[0].id);
        setSelectedCustomerId(remaining[0].id);
      }
    }
  };

  // PO Handlers
  const handleOpenAddPo = () => {
    setEditingPo(null);
    setPoNumber(`PO-${Date.now().toString().slice(-4)}`);
    setPoStyle('');
    setPoDate(getCurrentDateFormatted());
    setPoTargetQty(10);
    setPoUnit('đôi');
    setPoNote('');
    setShowPoModal(true);
  };

  const handleOpenEditPo = (po: PurchaseOrder) => {
    setEditingPo(po);
    setPoNumber(po.poNumber);
    setPoStyle(po.style);
    setPoDate(po.orderDate);
    setPoTargetQty(po.targetQty);
    setPoUnit(po.unit);
    setPoNote(po.note || '');
    setShowPoModal(true);
  };

  const handleSavePo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCust) return;
    const qty = typeof poTargetQty === 'number' ? poTargetQty : 1;

    if (editingPo) {
      updatePurchaseOrder({
        ...editingPo,
        poNumber: poNumber.trim(),
        style: poStyle.trim(),
        orderDate: poDate.trim(),
        targetQty: qty,
        unit: poUnit.trim(),
        note: poNote.trim(),
      });
      alert('Đã cập nhật đơn PO thành công!');
    } else {
      addPurchaseOrder({
        id: `po-${Date.now()}`,
        customerId: currentCust.id,
        poNumber: poNumber.trim(),
        style: poStyle.trim() || 'Sneaker Standard',
        orderDate: poDate.trim() || getCurrentDateFormatted(),
        targetQty: qty,
        unit: poUnit.trim() || 'đôi',
        note: poNote.trim(),
      });
      alert('Đã tạo đơn PO mới thành công!');
    }
    setShowPoModal(false);
  };

  // Parse preview sizes in modal
  const previewSizesArr = formSizes
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold text-slate-900">
              Quản Lý Khách Hàng & Dải Size Áp Dụng
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập nhanh tên công ty và dải size gia công. Chỉ cần 1 nút bấm chỉnh sửa hoặc thêm mới, không rườm rà.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCustomersAndPOsToExcel(currentCust, currentCustomerPOs)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition"
            title="In / Xuất thông tin đối tác & đơn hàng PO ra file Excel"
          >
            <Download className="w-4 h-4" />
            <span>In / Xuất Excel</span>
          </button>
          <button
            onClick={handleOpenAddCustomer}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Thêm Đối Tác / Khách Hàng</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PHẦN 1: BẢNG DANH SÁCH CÔNG TY & DẢI SIZE (TINH GỌN, TRỰC QUAN)            */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <span>Danh Sách Đối Tác & Dải Size ({customers.length} công ty)</span>
          </h3>
          <span className="text-xs text-slate-500">
            Bấm <strong>Chọn làm việc</strong> để kích hoạt dải size cho toàn hệ thống
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">#</th>
                <th className="p-3.5 min-w-[220px]">Tên Công Ty / Khách Hàng</th>
                <th className="p-3.5 w-24 text-center">Mã Viết Tắt</th>
                <th className="p-3.5 min-w-[320px]">Dải Size Áp Dụng (Chiều Ngang)</th>
                <th className="p-3.5 w-32 text-center">Trạng Thái</th>
                <th className="p-3.5 w-28 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c, idx) => {
                const isSelected = c.id === activeCustId;
                const isGlobalCurrent = c.id === selectedCustomerId;
                const custSizes = getCustomerSizes(c);

                return (
                  <tr
                    key={c.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-sky-50/50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* STT */}
                    <td className="p-3.5 text-center text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>

                    {/* Tên công ty */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                      {c.note && (
                        <div className="text-xs text-slate-500 mt-0.5 italic">{c.note}</div>
                      )}
                    </td>

                    {/* Mã viết tắt */}
                    <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                      <span className="px-2 py-1 bg-slate-100 border border-slate-200 rounded">
                        {c.code}
                      </span>
                    </td>

                    {/* DẢI SIZE ÁP DỤNG HIỂN THỊ TRỰC TIẾP */}
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {custSizes.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center justify-center min-w-7 h-6 px-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-bold text-xs rounded shadow-2xs"
                          >
                            {s}
                          </span>
                        ))}
                        <span className="text-[11px] text-slate-400 ml-1">
                          ({custSizes.length} size)
                        </span>
                      </div>
                    </td>

                    {/* Trạng thái chọn làm việc */}
                    <td className="p-3.5 text-center">
                      {isGlobalCurrent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Đang chọn
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveCustId(c.id);
                            setSelectedCustomerId(c.id);
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-sky-700 hover:bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-lg transition"
                        >
                          Chọn làm việc
                        </button>
                      )}
                    </td>

                    {/* Nút Sửa & Xóa duy nhất - đúng yêu cầu */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditCustomer(c)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition"
                          title="Sửa Tên Công Ty và Dải Size"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(c)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa công ty này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PHẦN 2: DANH SÁCH ĐƠN HÀNG PO CỦA ĐỐI TÁC ĐANG CHỌN                       */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Danh Sách Đơn Hàng Hợp Đồng (PO) - Đối Tác:{' '}
                <span className="text-sky-600">{currentCust?.name}</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi các hợp đồng PO, Style giày, kế hoạch sản lượng và tiến độ gia công.
            </p>
          </div>
          <button
            onClick={handleOpenAddPo}
            className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Tạo Đơn PO Mới</span>
          </button>
        </div>

        {/* PO Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-3">Mã PO</th>
                <th className="p-3">Mã Style / Kiểu Dáng</th>
                <th className="p-3">Ngày Nhận Đơn</th>
                <th className="p-3 text-right">SL Kế Hoạch</th>
                <th className="p-3">Ghi Chú</th>
                <th className="p-3 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentCustomerPOs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400 text-xs">
                    Chưa có đơn PO nào cho đối tác này. Bấm "+ Tạo Đơn PO Mới" để thêm!
                  </td>
                </tr>
              ) : (
                currentCustomerPOs.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 font-mono font-bold text-sky-700">{po.poNumber}</td>
                    <td className="p-3 font-medium text-slate-900">{po.style}</td>
                    <td className="p-3 text-slate-600">{po.orderDate}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {po.targetQty.toLocaleString('vi-VN')} {po.unit}
                    </td>
                    <td className="p-3 text-slate-500 max-w-xs truncate text-[11px]">
                      {po.note || '-'}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEditPo(po)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                          title="Sửa PO"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc muốn xóa PO "${po.poNumber}"?`)) {
                              deletePurchaseOrder(po.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa PO"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* MODAL DUY NHẤT: THÊM / SỬA CÔNG TY & DẢI SIZE (CỰC KỲ ĐƠN GIẢN, TINH GỌN)   */}
      {/* ========================================================================= */}
      {showCustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingCust ? 'Chỉnh Sửa Công Ty & Dải Size' : 'Thêm Công Ty & Dải Size Mới'}
                </h3>
              </div>
              <button
                onClick={() => setShowCustModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-4 text-xs">
              {/* Tên Công Ty */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Tên Công Ty / Khách Hàng *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: CÔNG TY TNHH DAE WOONG VIỆT NAM"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Mã Viết Tắt */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Mã Viết Tắt (Ký Hiệu)
                </label>
                <input
                  type="text"
                  placeholder="VD: DW, LT, CS..."
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:outline-none uppercase"
                />
              </div>

              {/* Dải Size Áp Dụng */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Dải Size Áp Dụng *
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Cách nhau bởi dấu phẩy (,)
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="VD: 4, 5, 6, 7, 8, 9, 10, 11, 12 hoặc S, M, L, XL"
                  value={formSizes}
                  onChange={(e) => setFormSizes(e.target.value)}
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />

                {/* Các nút bấm chọn nhanh mẫu dải size */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500">Mẫu nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setFormSizes('4, 5, 6, 7, 8, 9, 10, 11, 12')}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition"
                  >
                    Size 4-12
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSizes('35, 36, 37, 38, 39, 40, 41, 42, 43, 44')}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition"
                  >
                    Size 35-44
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSizes('S, M, L, XL, XXL')}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 transition"
                  >
                    Size S-XXL
                  </button>
                </div>

                {/* Xem trước dải size */}
                {previewSizesArr.length > 0 && (
                  <div className="mt-2 p-2.5 bg-indigo-50/50 border border-indigo-200 rounded-lg space-y-1">
                    <span className="text-[11px] font-semibold text-indigo-900 block">
                      Xem trước ({previewSizesArr.length} size):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {previewSizesArr.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white border border-indigo-300 text-indigo-900 font-mono font-bold text-[11px] rounded"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ghi chú */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Ghi Chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm về đối tác..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-xs transition"
                >
                  {editingCust ? 'Lưu Thay Đổi' : 'Thêm Công Ty'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  {editingPo ? 'Chỉnh Sửa Đơn Hàng PO' : `Tạo Đơn Hàng PO: ${currentCust?.name}`}
                </h3>
              </div>
              <button
                onClick={() => setShowPoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePo} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã PO *</label>
                  <input
                    type="text"
                    required
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã Style / Kiểu</label>
                  <input
                    type="text"
                    required
                    value={poStyle}
                    onChange={(e) => setPoStyle(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày Đặt Hàng *</label>
                <input
                  type="text"
                  required
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SL Kế Hoạch *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={poTargetQty}
                    onChange={(e) =>
                      setPoTargetQty(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đơn Vị Tính</label>
                  <input
                    type="text"
                    value={poUnit}
                    onChange={(e) => setPoUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi Chú</label>
                <input
                  type="text"
                  value={poNote}
                  onChange={(e) => setPoNote(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold shadow-xs transition"
                >
                  Lưu Đơn PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
