import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Save,
  Clipboard,
} from 'lucide-react';
import { exportCustomersAndPOsToExcel } from '../../utils/excelExport';
import { useMessageBox } from '../common/MessageBox';
import { handleCellArrowNavigation } from '../../utils/tableNavigation';

interface EditablePoRow {
  id: string;
  poNumber: string;
  style: string;
  orderDate: string;
  unit: string;
  sizeQuantities: Record<string, number | ''>;
  note: string;
  isExisting?: boolean;
  isEditing?: boolean;
}

export const CustomerTab: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
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
    savePurchaseOrders,
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

  const customerSizes = useMemo(() => {
    if (!currentCust) return [];
    return getCustomerSizes(currentCust);
  }, [currentCust]);

  const createEmptyPoRow = (): EditablePoRow => ({
    id: `po-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    poNumber: '',
    style: '',
    orderDate: getCurrentDateFormatted(),
    unit: 'đôi',
    sizeQuantities: {},
    note: '',
    isExisting: false,
    isEditing: true, // Dòng mới đang soạn thì mở sẵn ô nhập
  });

  const [draftPoRows, setDraftPoRows] = useState<EditablePoRow[]>([]);
  const poGridRef = useRef<HTMLDivElement>(null);

  // Sync draft PO rows with customer POs
  useEffect(() => {
    if (currentCustomerPOs && currentCustomerPOs.length > 0) {
      const rows: EditablePoRow[] = currentCustomerPOs.map((po) => {
        const sq: Record<string, number | ''> = {};
        if (po.sizeQuantities) {
          Object.entries(po.sizeQuantities).forEach(([k, v]) => {
            sq[k] = v;
          });
        }
        return {
          id: po.id,
          poNumber: po.poNumber,
          style: po.style,
          orderDate: po.orderDate,
          unit: po.unit || 'đôi',
          sizeQuantities: sq,
          note: po.note || '',
          isExisting: true,
          isEditing: false, // Mặc định đã lưu từ trước -> khóa dòng, bấm cây viết để mở sửa
        };
      });
      // Always append 1 empty row at the bottom for quick entry
      rows.push(createEmptyPoRow());
      setDraftPoRows(rows);
    } else {
      setDraftPoRows([createEmptyPoRow(), createEmptyPoRow(), createEmptyPoRow()]);
    }
  }, [currentCust?.id, currentCustomerPOs]);

  const getPoRowTotal = (row: EditablePoRow) => {
    return customerSizes.reduce((sum, s) => {
      const val = row.sizeQuantities[s];
      return sum + (typeof val === 'number' ? val : 0);
    }, 0);
  };

  const poColumns = useMemo(() => {
    const cols: Array<{
      key: string;
      label: string;
      size?: string;
      isSize?: boolean;
      isCalculated?: boolean;
      minWidth: string;
    }> = [
      { key: 'poNumber', label: 'Mã PO', minWidth: '120px' },
      { key: 'style', label: 'Mã Style / Kiểu Dáng', minWidth: '150px' },
      { key: 'orderDate', label: 'Ngày Nhận Đơn', minWidth: '110px' },
      { key: 'unit', label: 'ĐVT', minWidth: '70px' },
      ...customerSizes.map((s) => ({
        key: `size_${s}`,
        label: `Size ${s}`,
        size: s,
        isSize: true,
        minWidth: '52px',
      })),
      { key: 'totalQty', label: 'Tổng SL Kế Hoạch', isCalculated: true, minWidth: '95px' },
      { key: 'note', label: 'Ghi Chú', minWidth: '130px' },
    ];
    return cols;
  }, [customerSizes]);

  const handlePoCellChange = (rIdx: number, field: string, value: any) => {
    setDraftPoRows((prev) => {
      const next = [...prev];
      const row = { ...next[rIdx], sizeQuantities: { ...next[rIdx].sizeQuantities } };
      if (field.startsWith('size_')) {
        const sizeKey = field.replace('size_', '');
        if (value === '' || value === '-' || value === null || value === undefined) {
          row.sizeQuantities[sizeKey] = '';
        } else {
          const num = parseFloat(String(value).replace(/,/g, ''));
          row.sizeQuantities[sizeKey] = isNaN(num) ? '' : Math.max(0, num);
        }
      } else if (field === 'poNumber') {
        row.poNumber = String(value).toUpperCase();
      } else {
        (row as any)[field] = value;
      }
      next[rIdx] = row;
      return next;
    });
  };

  const handlePoContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    const targetInput = target.closest('[data-po-idx]') as HTMLElement | null;
    if (target.tagName === 'INPUT' && !targetInput) {
      return;
    }

    const clipText = e.clipboardData.getData('text');
    if (!clipText) return;

    const rawLines = clipText.split(/\r?\n/);
    while (rawLines.length > 0 && rawLines[rawLines.length - 1].trim() === '') {
      rawLines.pop();
    }
    if (rawLines.length === 0) return;

    const matrix = rawLines.map((line) => line.split('\t'));
    const isMultiCell = matrix.length > 1 || matrix[0].length > 1;

    if (!isMultiCell && targetInput && !clipText.includes('\t') && !clipText.includes('\n')) {
      return;
    }

    let startRowIdx = 0;
    let startColIdx = 0;

    if (targetInput) {
      const rIdxStr = targetInput.getAttribute('data-po-idx');
      const colKeyStr = targetInput.getAttribute('data-col-key') || '';
      if (rIdxStr !== null) {
        startRowIdx = Math.max(0, parseInt(rIdxStr, 10));
      }
      const foundColIdx = poColumns.findIndex((c) => c.key === colKeyStr);
      if (foundColIdx >= 0) {
        startColIdx = foundColIdx;
      }
    } else {
      const firstEmptyIdx = draftPoRows.findIndex(
        (r) => !r.poNumber.trim() && !r.style.trim() && getPoRowTotal(r) === 0
      );
      startRowIdx = firstEmptyIdx >= 0 ? firstEmptyIdx : draftPoRows.length;
      startColIdx = 0;
    }

    e.preventDefault();

    let dataMatrix = matrix;
    if (
      dataMatrix.length > 1 &&
      dataMatrix[0].some((c) =>
        /^(ngày(\s*nhận)?|mã\s*po|mã\s*style|kiểu\s*dáng|đvt|stt|size|sl\s*kế\s*hoạch)$/i.test(
          c.trim().toLowerCase()
        )
      )
    ) {
      dataMatrix = dataMatrix.slice(1);
    }

    const nextRows = draftPoRows.map((r) => ({
      ...r,
      sizeQuantities: { ...r.sizeQuantities },
    }));

    dataMatrix.forEach((rowCells, rOffset) => {
      const targetRowIdx = startRowIdx + rOffset;

      // Auto expand rows on paste!
      while (targetRowIdx >= nextRows.length) {
        nextRows.push(createEmptyPoRow());
      }

      const rowObj = nextRows[targetRowIdx];

      rowCells.forEach((cellRaw, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx >= poColumns.length) return;

        const colDef = poColumns[targetColIdx];
        const val = cellRaw.trim();

        if (colDef.isSize && colDef.size) {
          if (!val || val === '-' || val === '0') {
            rowObj.sizeQuantities[colDef.size] = '';
          } else {
            const num = parseFloat(val.replace(/,/g, ''));
            rowObj.sizeQuantities[colDef.size] = isNaN(num) ? '' : Math.max(0, num);
          }
        } else if (colDef.key === 'poNumber') {
          if (val) rowObj.poNumber = val.toUpperCase();
        } else if (colDef.key === 'style') {
          if (val) rowObj.style = val;
        } else if (colDef.key === 'orderDate') {
          if (val) rowObj.orderDate = val;
        } else if (colDef.key === 'unit') {
          if (val) rowObj.unit = val;
        } else if (colDef.key === 'note') {
          if (val) rowObj.note = val;
        }
      });
    });

    setDraftPoRows(nextRows);
    toast(`📋 Đã dán thành công ${dataMatrix.length} dòng đơn hàng PO từ Excel!`);
  };

  const handleStartEditPoRow = (rIdx: number) => {
    setDraftPoRows((prev) => {
      const next = [...prev];
      next[rIdx] = { ...next[rIdx], isEditing: true };
      return next;
    });
  };

  const handleCancelEditPoRow = (rIdx: number) => {
    const row = draftPoRows[rIdx];
    if (row.isExisting) {
      const orig = currentCustomerPOs.find((p) => p.id === row.id);
      if (orig) {
        const sq: Record<string, number | ''> = {};
        if (orig.sizeQuantities) {
          Object.entries(orig.sizeQuantities).forEach(([k, v]) => {
            sq[k] = v;
          });
        }
        setDraftPoRows((prev) => {
          const next = [...prev];
          next[rIdx] = {
            id: orig.id,
            poNumber: orig.poNumber,
            style: orig.style,
            orderDate: orig.orderDate,
            unit: orig.unit || 'đôi',
            sizeQuantities: sq,
            note: orig.note || '',
            isExisting: true,
            isEditing: false,
          };
          return next;
        });
        return;
      }
    }
    setDraftPoRows((prev) => {
      const next = [...prev];
      next[rIdx] = { ...next[rIdx], isEditing: false };
      return next;
    });
  };

  const handleSaveAllPOs = () => {
    if (!currentCust) return;
    const validRows = draftPoRows.filter((r) => r.poNumber.trim() !== '');

    if (validRows.length === 0) {
      alert('Vui lòng nhập ít nhất 1 dòng có Mã PO để lưu!');
      return;
    }

    const poMap = new Set<string>();
    for (const r of validRows) {
      const pCode = r.poNumber.trim().toUpperCase();
      if (poMap.has(pCode)) {
        alert(`Trùng mã PO "${pCode}". Mỗi mã PO chỉ được có 1 dòng duy nhất!`);
        return;
      }
      poMap.add(pCode);
    }

    const toSave: PurchaseOrder[] = validRows.map((r) => {
      const cleanSizes: Record<string, number> = {};
      let totalSum = 0;
      customerSizes.forEach((s) => {
        const v = r.sizeQuantities[s];
        if (typeof v === 'number' && v > 0) {
          cleanSizes[s] = v;
          totalSum += v;
        }
      });

      return {
        id: r.id,
        customerId: currentCust.id,
        poNumber: r.poNumber.trim().toUpperCase(),
        style: r.style.trim() || 'Sneaker Standard',
        orderDate: r.orderDate.trim() || getCurrentDateFormatted(),
        targetQty: totalSum,
        unit: r.unit.trim() || 'đôi',
        sizeQuantities: cleanSizes,
        note: r.note.trim(),
      };
    });

    savePurchaseOrders(toSave);

    // Sau khi lưu: Khóa tất cả các dòng đã có PO và thêm 1 dòng soạn mới ở dưới
    setDraftPoRows((prev) => {
      const next = prev.map((r) =>
        r.poNumber.trim() ? { ...r, isExisting: true, isEditing: false } : r
      );
      const hasEmpty = next.some((r) => !r.poNumber.trim());
      if (!hasEmpty) {
        next.push(createEmptyPoRow());
      }
      return next;
    });

    toast(`✅ Đã lưu thành công ${toSave.length} đơn hàng PO cho đối tác "${currentCust.name}"!`);
  };

  const handleSaveSinglePoRow = (rIdx: number) => {
    if (!currentCust) return;
    const row = draftPoRows[rIdx];
    const pCode = row.poNumber.trim().toUpperCase();
    if (!pCode) {
      alert('Vui lòng nhập Mã PO để lưu!');
      return;
    }

    const duplicate = draftPoRows.find(
      (r, i) => i !== rIdx && r.poNumber.trim().toUpperCase() === pCode
    );
    if (duplicate) {
      alert(`Trùng mã PO "${pCode}". Mỗi mã PO chỉ được có 1 dòng duy nhất!`);
      return;
    }

    handleSaveAllPOs();
  };

  const handlePoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && target.hasAttribute('data-po-idx')) {
        e.preventDefault();
        handleSaveAllPOs();
      }
    }
  };

  const handleAddPoRows = (count: number) => {
    setDraftPoRows((prev) => {
      const next = [...prev];
      for (let i = 0; i < count; i++) {
        next.push(createEmptyPoRow());
      }
      return next;
    });
    toast(`Đã thêm ${count} dòng PO mới!`);
  };

  const handleDeletePoRow = (idx: number) => {
    const row = draftPoRows[idx];
    if (row.poNumber.trim()) {
      confirm(`Bạn có chắc muốn xóa PO "${row.poNumber}"?`, () => {
        deletePurchaseOrder(row.id);
        setDraftPoRows((prev) => prev.filter((_, i) => i !== idx));
        toast(`Đã xóa PO "${row.poNumber}"!`);
      });
    } else {
      setDraftPoRows((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const handleExportPoExcel = () => {
    if (!currentCust) return;
    const validRows = draftPoRows.filter((r) => r.poNumber.trim() !== '');
    if (validRows.length === 0) {
      alert('Chưa có đơn PO nào để xuất Excel.');
      return;
    }

    const headers = [
      'STT',
      'Mã PO',
      'Mã Style / Kiểu Dáng',
      'Ngày Nhận Đơn',
      'ĐVT',
      ...customerSizes.map((s) => `Size ${s}`),
      'Tổng SL Kế Hoạch',
      'Ghi Chú',
    ];

    const dataRows = validRows.map((r, idx) => [
      idx + 1,
      r.poNumber,
      r.style,
      r.orderDate,
      r.unit,
      ...customerSizes.map((s) => (typeof r.sizeQuantities[s] === 'number' ? r.sizeQuantities[s] : 0)),
      getPoRowTotal(r),
      r.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DonHang_PO');
    XLSX.writeFile(wb, `DonHang_PO_${currentCust.code}_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
      alert('Hệ thống cần ít nhất 1 khách hàng. Không thể xóa khách hàng duy nhất!', 'Không thể xóa', 'warning');
      return;
    }
    confirm(
      `Bạn có chắc chắn muốn XÓA đối tác "${cust.name}"? Dữ liệu dải size và đơn PO của đối tác này sẽ bị xóa.`,
      () => {
        deleteCustomer(cust.id);
        const remaining = customers.filter((c) => c.id !== cust.id);
        if (remaining.length > 0) {
          setActiveCustId(remaining[0].id);
          setSelectedCustomerId(remaining[0].id);
        }
        toast(`Đã xóa đối tác "${cust.name}"!`);
      }
    );
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
      {/* PHẦN 2: QUẢN LÝ ĐƠN HÀNG PO VỚI DẢI SIZE (NỀN XANH DƯƠNG NHẠT, DÁN EXCEL)  */}
      {/* ========================================================================= */}
      <div
        ref={poGridRef}
        onKeyDown={handlePoKeyDown}
        onPaste={handlePoContainerPaste}
        className="bg-[#f0f7ff] border-2 border-sky-200/90 rounded-xl p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sky-200">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-bold text-sky-950 uppercase tracking-wide">
                Quản Lý Đơn Hàng PO &amp; Dải Size - Đối Tác:{' '}
                <span className="text-sky-700 underline underline-offset-2">{currentCust?.name}</span>
              </h3>
            </div>
            <p className="text-xs text-sky-800/80 mt-1">
              Bảng ma trận dải size cho từng PO. Hỗ trợ <strong>Dán trực tiếp từ Excel</strong> (tự động nhảy dòng) • Nhấn <strong>Enter</strong> để lưu ngay.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleAddPoRows(1)}
              className="inline-flex items-center gap-1 bg-white hover:bg-sky-100 text-sky-700 border border-sky-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
              title="Thêm 1 dòng PO mới"
            >
              <Plus className="w-3.5 h-3.5 text-sky-600" />
              <span>+ 1 Dòng</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddPoRows(5)}
              className="inline-flex items-center gap-1 bg-white hover:bg-sky-100 text-sky-700 border border-sky-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
              title="Thêm 5 dòng PO mới"
            >
              <Plus className="w-3.5 h-3.5 text-sky-600" />
              <span>+ 5 Dòng</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllPOs}
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
              title="Lưu tất cả đơn hàng PO đang nhập vào hệ thống (hoặc nhấn phím Enter)"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu Đơn Hàng PO (Enter)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPoExcel}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
              title="Xuất danh sách PO ra Excel kèm dải size"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Excel PO</span>
            </button>
          </div>
        </div>

        {/* PO Matrix Table */}
        <div className="overflow-x-auto border border-sky-200 rounded-lg bg-white shadow-2xs">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-sky-100/80 text-sky-950 uppercase font-bold text-[11px] border-b border-sky-200 select-none">
              <tr>
                <th className="p-2.5 border-r border-sky-200 text-center w-10">#</th>
                <th className="p-2.5 border-r border-sky-200 min-w-[120px]">Mã PO</th>
                <th className="p-2.5 border-r border-sky-200 min-w-[150px]">Mã Style / Kiểu Dáng</th>
                <th className="p-2.5 border-r border-sky-200 min-w-[110px]">Ngày Nhận Đơn</th>
                <th className="p-2.5 border-r border-sky-200 text-center min-w-[70px]">ĐVT</th>
                {customerSizes.map((s) => (
                  <th
                    key={s}
                    className="p-2.5 border-r border-sky-200 text-center font-mono font-bold min-w-[52px] bg-sky-200/50 text-sky-950"
                  >
                    Size {s}
                  </th>
                ))}
                <th className="p-2.5 border-r border-sky-200 text-right min-w-[95px] bg-sky-200/70 text-sky-950 font-bold">
                  Tổng SL KH
                </th>
                <th className="p-2.5 border-r border-sky-200 min-w-[130px]">Ghi Chú</th>
                <th className="p-2.5 text-center min-w-[85px]">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100 font-sans">
              {draftPoRows.map((row, rIdx) => {
                const rowTotal = getPoRowTotal(row);
                const isEditing = row.isEditing ?? !row.isExisting;

                // Dòng ĐÃ LƯU (Khóa dòng, có cây viết để mở sửa)
                if (!isEditing) {
                  return (
                    <tr key={row.id} className="hover:bg-sky-50/60 bg-white transition">
                      <td className="p-1.5 border-r border-sky-100 text-center font-mono text-slate-400 font-bold bg-sky-50/30">
                        {rIdx + 1}
                      </td>
                      <td className="p-1.5 border-r border-sky-100 font-mono font-bold text-sky-700">
                        <div className="px-1 py-0.5 truncate" title={row.poNumber}>
                          {row.poNumber}
                        </div>
                      </td>
                      <td className="p-1.5 border-r border-sky-100 font-semibold text-slate-800">
                        <div className="px-1 py-0.5 truncate" title={row.style}>
                          {row.style || '-'}
                        </div>
                      </td>
                      <td className="p-1.5 border-r border-sky-100 text-center font-mono text-slate-700">
                        <div className="px-1 py-0.5">{row.orderDate || '-'}</div>
                      </td>
                      <td className="p-1.5 border-r border-sky-100 text-center text-slate-600">
                        <div className="px-1 py-0.5">{row.unit || 'đôi'}</div>
                      </td>
                      {customerSizes.map((s) => {
                        const val = row.sizeQuantities[s];
                        const hasVal = typeof val === 'number' && val > 0;
                        return (
                          <td key={s} className="p-1 border-r border-sky-100 text-center font-mono">
                            <div
                              className={`px-1 py-1 font-bold text-xs ${
                                hasVal ? 'text-sky-950 bg-sky-100/60 rounded' : 'text-slate-300'
                              }`}
                            >
                              {hasVal ? val.toLocaleString('vi-VN') : '-'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-1.5 border-r border-sky-100 text-right font-mono font-bold text-sky-900 bg-sky-50/60">
                        {rowTotal > 0 ? rowTotal.toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="p-1.5 border-r border-sky-100 text-slate-600">
                        <div className="px-1 py-0.5 text-xs truncate max-w-[140px]" title={row.note}>
                          {row.note || '-'}
                        </div>
                      </td>
                      <td className="p-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* CÂY VIẾT ĐỂ CHỈNH SỬA TRỰC TIẾP */}
                          <button
                            type="button"
                            onClick={() => handleStartEditPoRow(rIdx)}
                            className="p-1 text-slate-500 hover:text-sky-600 hover:bg-sky-100 rounded transition cursor-pointer"
                            title={`Chỉnh sửa trực tiếp PO "${row.poNumber}"`}
                          >
                            <Edit className="w-3.5 h-3.5 text-sky-600" />
                          </button>
                          {/* Nút Xóa */}
                          <button
                            type="button"
                            onClick={() => handleDeletePoRow(rIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title={`Xóa PO "${row.poNumber}"`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Dòng ĐANG SỬA hoặc DÒNG MỚI ĐANG SOẠN
                return (
                  <tr
                    key={row.id}
                    className={`transition ${
                      row.isExisting ? 'bg-[#fffbeb] hover:bg-[#fef3c7]/60' : 'bg-[#f0fdf4] hover:bg-[#dcfce7]/60'
                    }`}
                  >
                    <td className="p-1.5 border-r border-sky-100 text-center font-mono text-slate-400 font-bold bg-sky-50/30">
                      {rIdx + 1}
                    </td>
                    <td className="p-1.5 border-r border-sky-100">
                      <input
                        type="text"
                        placeholder="VD: PO-101"
                        value={row.poNumber}
                        data-po-idx={rIdx}
                        data-row-idx={rIdx}
                        data-col-key="poNumber"
                        onChange={(e) => handlePoCellChange(rIdx, 'poNumber', e.target.value)}
                        onKeyDown={(e) => {
                          handleCellArrowNavigation(e, poGridRef);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSinglePoRow(rIdx);
                          }
                        }}
                        className="w-full text-xs font-mono font-bold text-sky-700 bg-white border border-sky-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-400 focus:outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5 border-r border-sky-100">
                      <input
                        type="text"
                        placeholder="VD: Sneaker Pro"
                        value={row.style}
                        data-po-idx={rIdx}
                        data-row-idx={rIdx}
                        data-col-key="style"
                        onChange={(e) => handlePoCellChange(rIdx, 'style', e.target.value)}
                        onKeyDown={(e) => {
                          handleCellArrowNavigation(e, poGridRef);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSinglePoRow(rIdx);
                          }
                        }}
                        className="w-full text-xs text-slate-900 bg-white border border-sky-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5 border-r border-sky-100">
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={row.orderDate}
                        data-po-idx={rIdx}
                        data-row-idx={rIdx}
                        data-col-key="orderDate"
                        onChange={(e) => handlePoCellChange(rIdx, 'orderDate', e.target.value)}
                        onKeyDown={(e) => {
                          handleCellArrowNavigation(e, poGridRef);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSinglePoRow(rIdx);
                          }
                        }}
                        className="w-full text-xs font-mono text-slate-700 bg-white border border-sky-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-400 focus:outline-none text-center"
                      />
                    </td>
                    <td className="p-1.5 border-r border-sky-100">
                      <input
                        type="text"
                        placeholder="đôi"
                        value={row.unit}
                        data-po-idx={rIdx}
                        data-row-idx={rIdx}
                        data-col-key="unit"
                        onChange={(e) => handlePoCellChange(rIdx, 'unit', e.target.value)}
                        onKeyDown={(e) => {
                          handleCellArrowNavigation(e, poGridRef);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSinglePoRow(rIdx);
                          }
                        }}
                        className="w-full text-xs text-slate-700 bg-white border border-sky-300 rounded px-1.5 py-1 focus:ring-2 focus:ring-sky-400 focus:outline-none text-center"
                      />
                    </td>
                    {customerSizes.map((s) => {
                      const val = row.sizeQuantities[s];
                      return (
                        <td key={s} className="p-1 border-r border-sky-100">
                          <input
                            type="text"
                            placeholder="-"
                            value={val !== undefined && val !== null ? val : ''}
                            data-po-idx={rIdx}
                            data-row-idx={rIdx}
                            data-col-key={`size_${s}`}
                            onChange={(e) => handlePoCellChange(rIdx, `size_${s}`, e.target.value)}
                            onKeyDown={(e) => {
                              handleCellArrowNavigation(e, poGridRef);
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveSinglePoRow(rIdx);
                              }
                            }}
                            className="w-full text-xs text-center font-mono font-semibold text-slate-800 bg-white border border-sky-300 rounded px-1 py-1 focus:ring-2 focus:ring-sky-400 focus:outline-none"
                          />
                        </td>
                      );
                    })}
                    <td className="p-1.5 border-r border-sky-100 text-right font-mono font-bold text-sky-900 bg-sky-50/60">
                      {rowTotal > 0 ? rowTotal.toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="p-1.5 border-r border-sky-100">
                      <input
                        type="text"
                        placeholder="Ghi chú đơn..."
                        value={row.note}
                        data-po-idx={rIdx}
                        data-row-idx={rIdx}
                        data-col-key="note"
                        onChange={(e) => handlePoCellChange(rIdx, 'note', e.target.value)}
                        onKeyDown={(e) => {
                          handleCellArrowNavigation(e, poGridRef);
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveSinglePoRow(rIdx);
                          }
                        }}
                        className="w-full text-xs text-slate-600 bg-white border border-sky-300 rounded px-2 py-1 focus:ring-2 focus:ring-sky-400 focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* Nút Lưu dòng này */}
                        <button
                          type="button"
                          onClick={() => handleSaveSinglePoRow(rIdx)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs transition cursor-pointer flex items-center gap-0.5"
                          title="Lưu PO này và khóa dòng (Enter)"
                        >
                          <Save className="w-3 h-3" />
                          <span>Lưu</span>
                        </button>
                        {/* Nút Hủy nếu sửa PO cũ, hoặc Xóa nếu dòng mới */}
                        {row.isExisting ? (
                          <button
                            type="button"
                            onClick={() => handleCancelEditPoRow(rIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Hủy bỏ thay đổi"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeletePoRow(rIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer with column totals */}
            <tfoot className="bg-sky-100/90 font-bold border-t-2 border-sky-300 text-sky-950">
              <tr>
                <td colSpan={5} className="p-2 border-r border-sky-200 text-right uppercase text-[11px] tracking-wider">
                  Tổng Cộng Kế Hoạch ({draftPoRows.filter((r) => r.poNumber.trim() !== '').length} PO):
                </td>
                {customerSizes.map((s) => {
                  const sizeSum = draftPoRows.reduce((sum, r) => {
                    const v = r.sizeQuantities[s];
                    return sum + (typeof v === 'number' ? v : 0);
                  }, 0);
                  return (
                    <td key={s} className="p-2 border-r border-sky-200 text-center font-mono font-bold text-xs text-sky-900">
                      {sizeSum > 0 ? sizeSum.toLocaleString('vi-VN') : '0'}
                    </td>
                  );
                })}
                <td className="p-2 border-r border-sky-200 text-right font-mono font-extrabold text-xs text-sky-950 bg-sky-200/80">
                  {draftPoRows
                    .reduce((sum, r) => sum + getPoRowTotal(r), 0)
                    .toLocaleString('vi-VN')}
                </td>
                <td colSpan={2} className="p-2 text-center text-xs text-sky-800">
                  Nhấn Enter để lưu
                </td>
              </tr>
            </tfoot>
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
