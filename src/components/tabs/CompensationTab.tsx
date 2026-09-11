import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CompensationOrder, CompensationCase } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Wrench,
  Plus,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Calendar,
  Edit,
  X,
  ArrowDownToLine,
  Truck,
  HelpCircle,
  FileText,
  Filter,
  Download,
} from 'lucide-react';
import { exportCompensationsToExcel } from '../../utils/excelExport';

export const CompensationTab: React.FC = () => {
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPOs,
    currentCustomerDeliveries,
    currentCustomerCompensations,
    addCompensation,
    updateCompensation,
    updateCompensationStatus,
    deleteCompensation,
    addReceipt,
  } = useInventory();

  // Filter state
  const [selectedCaseFilter, setSelectedCaseFilter] = useState<'ALL' | CompensationCase>('ALL');

  // Modal Create / Edit State
  const [showModal, setShowModal] = useState(false);
  const [editingComp, setEditingComp] = useState<CompensationOrder | null>(null);

  // Form Fields
  const [compCase, setCompCase] = useState<CompensationCase>('A');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [originalName, setOriginalName] = useState<string>('');
  const [vnName, setVnName] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [qtyComp, setQtyComp] = useState<number | ''>(2);
  const [unit, setUnit] = useState<string>('đôi');
  const [requestDate, setRequestDate] = useState<string>(getCurrentDateFormatted());
  const [completionDate, setCompletionDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [liability, setLiability] = useState<'Xưởng chịu (Vượt định mức)' | 'Khách hàng cấp bù'>(
    'Xưởng chịu (Vượt định mức)'
  );
  const [status, setStatus] = useState<CompensationOrder['status']>('Chờ xử lý');
  const [note, setNote] = useState<string>('');

  // Selected PO calculation
  const selectedPO = currentCustomerPOs.find((p) => p.id === selectedPoId);
  const totalDeliveredBatch1 = currentCustomerDeliveries
    .filter((d) => d.poId === selectedPoId)
    .reduce((sum, d) => sum + d.qtyBatch1, 0);
  const pendingShortage = selectedPO ? Math.max(0, selectedPO.targetQty - totalDeliveredBatch1) : 0;

  const handleOpenCreateModal = (defaultCase: CompensationCase = 'A') => {
    setEditingComp(null);
    setCompCase(defaultCase);
    setVoucherCode(`PB-${defaultCase}-${Date.now().toString().slice(-4)}`);
    setSelectedPoId(currentCustomerPOs[0]?.id || '');
    const p = currentCustomerPOs[0];
    if (p) {
      setOriginalName(`${p.style} Shoes`);
      setVnName(`Giày ${p.style}`);
      setUnit(p.unit);
    }
    setSize(activeSizeRun?.sizes[0] || '8');
    setQtyComp(2);
    setRequestDate(getCurrentDateFormatted());
    setCompletionDate('');
    setStatus('Chờ xử lý');
    setNote('');

    if (defaultCase === 'A') {
      setReason('Hỏng NVL do lỗi thao tác / máy móc kẹt chuyền may. Quản xưởng đề xuất cấp bù NVL.');
      setLiability('Xưởng chịu (Vượt định mức)');
      setUnit('bộ');
    } else if (defaultCase === 'B') {
      setReason('Khách hàng giao thiếu hoặc NVL ẩn lỗi phát hiện khi sản xuất. Đề nghị KH cấp bù.');
      setLiability('Khách hàng cấp bù');
      setUnit('đôi');
    } else {
      setReason('Sản xuất bù thành phẩm để giao đủ số lượng hợp đồng gốc.');
      setLiability('Xưởng chịu (Vượt định mức)');
      setUnit('đôi');
    }

    setShowModal(true);
  };

  const handleOpenEditModal = (comp: CompensationOrder) => {
    setEditingComp(comp);
    setCompCase(comp.compCase);
    setVoucherCode(comp.voucherCode);
    setSelectedPoId(comp.poId);
    setOriginalName(comp.originalName);
    setVnName(comp.vnName);
    setSize(comp.size);
    setQtyComp(comp.qtyCompensation);
    setUnit(comp.unit);
    setRequestDate(comp.requestDate);
    setCompletionDate(comp.completionDate || '');
    setReason(comp.reason);
    setLiability(comp.liability);
    setStatus(comp.status);
    setNote(comp.note || '');
    setShowModal(true);
  };

  const handleCaseChange = (newCase: CompensationCase) => {
    setCompCase(newCase);
    setVoucherCode(`PB-${newCase}-${Date.now().toString().slice(-4)}`);
    if (newCase === 'A') {
      setReason('Hỏng NVL do lỗi thao tác / máy móc kẹt chuyền may. Quản xưởng đề xuất cấp bù NVL.');
      setLiability('Xưởng chịu (Vượt định mức)');
    } else if (newCase === 'B') {
      setReason('Khách hàng giao thiếu hoặc NVL ẩn lỗi phát hiện khi sản xuất. Đề nghị KH cấp bù.');
      setLiability('Khách hàng cấp bù');
    } else {
      setReason('Sản xuất bù thành phẩm để giao đủ số lượng hợp đồng gốc.');
      setLiability('Xưởng chịu (Vượt định mức)');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer || !selectedPoId) {
      alert('Vui lòng chọn đơn PO cần bù.');
      return;
    }

    const qty = typeof qtyComp === 'number' ? qtyComp : 1;
    const caseLabels: Record<CompensationCase, string> = {
      A: 'Trường hợp A: Bù do NLGC bị hỏng trong SX (Lỗi thao tác/Máy móc)',
      B: 'Trường hợp B: Bù do Khách hàng giao thiếu / NLGC ẩn lỗi',
      C: 'Trường hợp C: Sản xuất bù Thành phẩm (Đủ sản lượng giao)',
    };

    if (editingComp) {
      updateCompensation({
        ...editingComp,
        compCase,
        caseLabel: caseLabels[compCase],
        voucherCode: voucherCode.trim(),
        poId: selectedPoId,
        originalName: originalName.trim(),
        vnName: vnName.trim(),
        size,
        qtyCompensation: qty,
        unit,
        requestDate: requestDate.trim(),
        completionDate: status === 'Đã hoàn tất' ? completionDate || getCurrentDateFormatted() : completionDate,
        reason: reason.trim(),
        liability,
        status,
        note: note.trim(),
      });
      alert('Đã cập nhật phiếu bù thành công!');
    } else {
      const newOrder: CompensationOrder = {
        id: `comp-${Date.now()}`,
        voucherCode: voucherCode.trim() || `PB-${Date.now().toString().slice(-4)}`,
        compCase,
        caseLabel: caseLabels[compCase],
        poId: selectedPoId,
        customerId: currentCustomer.id,
        originalName: originalName.trim() || 'Vật tư / Thành phẩm',
        vnName: vnName.trim() || 'NVL bù',
        size: size || (activeSizeRun?.sizes[0] || '8'),
        qtyCompensation: qty,
        unit,
        requestDate: requestDate.trim() || getCurrentDateFormatted(),
        completionDate: status === 'Đã hoàn tất' ? getCurrentDateFormatted() : '',
        reason: reason.trim(),
        liability,
        status,
        note: note.trim(),
      };
      addCompensation(newOrder);
      alert('Đã lập phiếu bù thành công!');
    }
    setShowModal(false);
  };

  // Case B helper: Receive Material from Buyer directly into Tab 2 (Receipts)
  const handleReceiveMaterialCaseB = (comp: CompensationOrder) => {
    const po = currentCustomerPOs.find((p) => p.id === comp.poId);
    const confirmed = window.confirm(
      `Tiếp nhận lô NLGC do Khách Hàng cấp bù (${comp.qtyCompensation} ${comp.unit} ${comp.originalName}) và ghi nhận nhập kho cho ${po?.poNumber}?`
    );
    if (!confirmed) return;

    addReceipt({
      id: `rec-b-${Date.now()}`,
      receiptDate: getCurrentDateFormatted(),
      poId: comp.poId,
      customerId: comp.customerId,
      originalName: comp.originalName,
      vnName: `${comp.vnName} (KH cấp bù)`,
      size: comp.size,
      qtyDoc: comp.qtyCompensation,
      qtyActual: comp.qtyCompensation,
      discrepancy: 0,
      unit: comp.unit,
      isCompensationReceipt: true,
      note: `Nhập bù cho ${po?.poNumber} theo phiếu đề nghị ${comp.voucherCode}`,
    });

    updateCompensationStatus(comp.id, 'Đã hoàn tất', getCurrentDateFormatted());
    alert(`Đã tạo phiếu Nhập Kho bù cho ${po?.poNumber} và chuyển phiếu bù sang trạng thái "Đã hoàn tất"!`);
  };

  // Filtered List
  const filteredList = currentCustomerCompensations.filter((c) => {
    if (selectedCaseFilter !== 'ALL' && c.compCase !== selectedCaseFilter) {
      return false;
    }
    return true;
  });

  const countA = currentCustomerCompensations.filter((c) => c.compCase === 'A').length;
  const countB = currentCustomerCompensations.filter((c) => c.compCase === 'B').length;
  const countC = currentCustomerCompensations.filter((c) => c.compCase === 'C').length;

  return (
    <div className="space-y-5">
      {/* Header Banner - Clean & Compact */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <Wrench className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Quản Lý Phiếu Bù (3 Trường Hợp: A - B - C)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi phân loại bù nguyên liệu hỏng, khách hàng cấp bù và sản xuất bù thành phẩm cho: <strong className="text-sky-700">{currentCustomer?.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportCompensationsToExcel(
                filteredList,
                currentCustomer?.name || 'Chung',
                currentCustomerPOs
              )
            }
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition"
            title="In / Xuất bảng tổng hợp phiếu bù (A-B-C) ra file Excel"
          >
            <Download className="w-4 h-4" />
            <span>In / Xuất Excel</span>
          </button>
          <button
            onClick={() => handleOpenCreateModal('A')}
            className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Lập Phiếu Bù Mới</span>
          </button>
        </div>
      </div>

      {/* 3 Quick Cards summarizing the 3 Cases */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Case A card */}
        <div
          onClick={() => setSelectedCaseFilter(selectedCaseFilter === 'A' ? 'ALL' : 'A')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedCaseFilter === 'A'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
              Trường hợp A
            </span>
            <span className="text-xs font-bold text-slate-700">{countA} phiếu</span>
          </div>
          <div className="text-xs font-bold text-slate-900 mt-2">
            NLGC Hỏng Trong Sản Xuất
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Lỗi thao tác / máy móc xưởng &rarr; Quản xưởng lập yêu cầu cấp bù &rarr; Tính vào <strong>chi phí hao hụt vượt định mức</strong> của xưởng.
          </p>
        </div>

        {/* Case B card */}
        <div
          onClick={() => setSelectedCaseFilter(selectedCaseFilter === 'B' ? 'ALL' : 'B')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedCaseFilter === 'B'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
              Trường hợp B
            </span>
            <span className="text-xs font-bold text-slate-700">{countB} phiếu</span>
          </div>
          <div className="text-xs font-bold text-slate-900 mt-2">
            Khách Giao Thiếu / NL Ẩn Lỗi
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Lỗi nguyên liệu &rarr; Lập báo cáo đề nghị <strong>Khách hàng cấp bù NLGC</strong> &rarr; Kho tiếp nhận nhập bù ghi rõ: Nhập bù cho PO.
          </p>
        </div>

        {/* Case C card */}
        <div
          onClick={() => setSelectedCaseFilter(selectedCaseFilter === 'C' ? 'ALL' : 'C')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedCaseFilter === 'C'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
              Trường hợp C
            </span>
            <span className="text-xs font-bold text-slate-700">{countC} phiếu</span>
          </div>
          <div className="text-xs font-bold text-slate-900 mt-2">
            Sản Xuất Bù Thành Phẩm
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Xưởng nhận NLGC cấp bù &rarr; Tiếp tục sản xuất phần TP thiếu &rarr; Nhập kho & <strong>Giao bù đủ sản lượng PO gốc</strong>.
          </p>
        </div>
      </div>

      {/* Filter Tabs / Filter Bar */}
      <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Lọc:
          </span>
          <button
            onClick={() => setSelectedCaseFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              selectedCaseFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả ({currentCustomerCompensations.length})
          </button>
          <button
            onClick={() => setSelectedCaseFilter('A')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              selectedCaseFilter === 'A'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            TH A: Hỏng Trong SX ({countA})
          </button>
          <button
            onClick={() => setSelectedCaseFilter('B')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              selectedCaseFilter === 'B'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            TH B: Khách Cấp Bù ({countB})
          </button>
          <button
            onClick={() => setSelectedCaseFilter('C')}
            className={`px-3 py-1 rounded-lg font-semibold transition ${
              selectedCaseFilter === 'C'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            TH C: SX Bù Thành Phẩm ({countC})
          </button>
        </div>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          Hiển thị {filteredList.length} phiếu
        </div>
      </div>

      {/* Voucher List - Clean Card View */}
      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white p-10 rounded-xl border border-slate-200 text-center text-slate-400 italic">
            Không có phiếu bù nào phù hợp với bộ lọc.
          </div>
        ) : (
          filteredList.map((comp) => {
            const po = currentCustomerPOs.find((p) => p.id === comp.poId);
            const isDone = comp.status === 'Đã hoàn tất';

            const caseBadgeColor =
              comp.compCase === 'A'
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : comp.compCase === 'B'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200';

            return (
              <div
                key={comp.id}
                className={`bg-white p-4 rounded-xl border transition shadow-2xs ${
                  isDone ? 'border-slate-200 bg-slate-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                      {comp.voucherCode}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${caseBadgeColor}`}>
                      {comp.compCase === 'A'
                        ? 'TH A: Hỏng Trong SX'
                        : comp.compCase === 'B'
                        ? 'TH B: Khách Cấp Bù NLGC'
                        : 'TH C: SX Bù Thành Phẩm'}
                    </span>
                    <span className="text-xs font-bold text-sky-700">
                      PO: {po?.poNumber || 'N/A'} ({po?.style})
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                      Size {comp.size}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Lập: <strong className="text-slate-700">{comp.requestDate}</strong></span>
                    </span>
                    {comp.completionDate && (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hoàn tất: <strong>{comp.completionDate}</strong></span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                  <div className="md:col-span-2 space-y-1.5">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>{comp.originalName}</span>
                      <span className="text-slate-400 font-normal">|</span>
                      <span className="text-slate-600 font-medium">{comp.vnName}</span>
                    </div>

                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      <strong>Lý do & Quy trình:</strong> {comp.reason}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Trách nhiệm / Chi phí:{' '}
                        <strong className={comp.liability.includes('Xưởng') ? 'text-rose-700' : 'text-amber-800'}>
                          {comp.liability}
                        </strong>
                      </span>
                      {comp.note && (
                        <span className="text-[10px] text-slate-500 italic">
                          Ghi chú: {comp.note}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-1 flex flex-col md:items-end gap-2">
                    <div className="text-right">
                      <span className="text-xs text-slate-500">Số lượng bù:</span>{' '}
                      <strong className="text-sm font-extrabold text-amber-800 font-mono">
                        {comp.qtyCompensation} {comp.unit}
                      </strong>
                    </div>

                    {/* Actions & Status */}
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {/* Special Action for Case B */}
                      {comp.compCase === 'B' && comp.status !== 'Đã hoàn tất' && (
                        <button
                          onClick={() => handleReceiveMaterialCaseB(comp)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-300 transition"
                          title="Tiếp nhận hàng bù từ khách và đưa vào phiếu nhập kho Tab 2"
                        >
                          <ArrowDownToLine className="w-3 h-3 text-amber-600" />
                          <span>Nhập Kho Bù</span>
                        </button>
                      )}

                      {/* Status Selector */}
                      <select
                        value={comp.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as CompensationOrder['status'];
                          const compDate = newStatus === 'Đã hoàn tất' ? getCurrentDateFormatted() : undefined;
                          updateCompensationStatus(comp.id, newStatus, compDate);
                        }}
                        className={`text-xs font-bold rounded-lg px-2 py-1 border transition cursor-pointer ${
                          comp.status === 'Đã hoàn tất'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : comp.status === 'Đang thực hiện'
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        <option value="Chờ xử lý">Chờ xử lý</option>
                        <option value="Đang thực hiện">Đang thực hiện</option>
                        <option value="Đã hoàn tất">Đã hoàn tất</option>
                      </select>

                      <button
                        onClick={() => handleOpenEditModal(comp)}
                        className="p-1 text-slate-400 hover:text-sky-600 transition"
                        title="Sửa phiếu bù"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm('Bạn có chắc chắn muốn XÓA phiếu bù này?')) {
                            deleteCompensation(comp.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition"
                        title="Xóa phiếu bù"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Compensation Voucher */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingComp ? 'Sửa Phiếu Bù Sản Xuất' : 'Lập Phiếu Bù Mới'}
                </h3>
                <p className="text-xs text-slate-500">
                  Khách hàng: <strong>{currentCustomer?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Chọn 1 trong 3 Trường Hợp A - B - C */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Phân Loại Trường Hợp Bù *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCaseChange('A')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      compCase === 'A'
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-rose-800">Trường Hợp A</div>
                    <div className="text-xs font-semibold text-slate-900 mt-0.5">Hỏng Trong SX</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Lỗi máy/thao tác xưởng</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCaseChange('B')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      compCase === 'B'
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-amber-800">Trường Hợp B</div>
                    <div className="text-xs font-semibold text-slate-900 mt-0.5">Khách Giao Thiếu</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Đề nghị KH cấp bù</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCaseChange('C')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      compCase === 'C'
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-emerald-800">Trường Hợp C</div>
                    <div className="text-xs font-semibold text-slate-900 mt-0.5">SX Bù Thành Phẩm</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Đủ sản lượng giao PO</div>
                  </button>
                </div>
              </div>

              {/* Thông tin phiếu & PO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã Phiếu Bù *
                  </label>
                  <input
                    type="text"
                    required
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày Lập Phiếu *
                  </label>
                  <input
                    type="text"
                    required
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn Đơn PO Liên Quan *
                </label>
                <select
                  required
                  value={selectedPoId}
                  onChange={(e) => {
                    setSelectedPoId(e.target.value);
                    const p = currentCustomerPOs.find((item) => item.id === e.target.value);
                    if (p) {
                      setOriginalName(`${p.style} Shoes`);
                      setVnName(`Giày ${p.style}`);
                    }
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white"
                >
                  <option value="">-- Chọn đơn PO --</option>
                  {currentCustomerPOs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.poNumber} ({p.style}) - Kế hoạch: {p.targetQty} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tên hàng song ngữ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên Gốc (Anh/Trung) *
                  </label>
                  <input
                    type="text"
                    required
                    value={originalName}
                    onChange={(e) => setOriginalName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên Dịch (Tiếng Việt) *
                  </label>
                  <input
                    type="text"
                    required
                    value={vnName}
                    onChange={(e) => setVnName(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {/* Size & Số lượng */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Size *</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-mono font-bold"
                  >
                    {activeSizeRun?.sizes.map((s) => (
                      <option key={s} value={s}>
                        Size {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số Lượng Bù *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qtyComp}
                    onChange={(e) => setQtyComp(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 font-bold text-amber-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ĐVT</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              {/* Trách nhiệm & Chi phí */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trách Nhiệm / Chi Phí *
                  </label>
                  <select
                    value={liability}
                    onChange={(e) => setLiability(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    <option value="Xưởng chịu (Vượt định mức)">Xưởng chịu (Vượt định mức)</option>
                    <option value="Khách hàng cấp bù">Khách hàng cấp bù</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trạng Thái Phiếu
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-semibold"
                  >
                    <option value="Chờ xử lý">Chờ xử lý</option>
                    <option value="Đang thực hiện">Đang thực hiện</option>
                    <option value="Đã hoàn tất">Đã hoàn tất</option>
                  </select>
                </div>
              </div>

              {/* Lý do & giải pháp */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý Do Chi Tiết & Hướng Xử Lý *
                </label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ghi Chú</label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  {editingComp ? 'Lưu Thay Đổi' : 'Tạo Phiếu Bù'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
