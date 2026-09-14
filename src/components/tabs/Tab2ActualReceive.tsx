import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ActualReceiveRow, PlanOrderRow } from '../../types';
import { getCurrentDateFormatted } from '../../utils/dateUtils';
import {
  Printer,
  Download,
  Plus,
  Save,
  RotateCcw,
  Search,
  Clipboard,
  PackageCheck,
  Copy,
  Edit,
  Trash2,
} from 'lucide-react';
import { ExcelPasteModal } from '../common/ExcelPasteModal';
import { PrintHtmlModal, PrintTableRow } from '../common/PrintHtmlModal';
import { useMessageBox } from '../common/MessageBox';
import * as XLSX from 'xlsx';

export interface Tab2WorkingRow {
  id: string;
  isNew?: boolean;
  receiptDate: string;
  poNumber: string;
  itemCode: string;
  voucherCode: string;
  description: string;
  unit: string;
  planTotalQty: number;
  planSizeQuantities: Record<string, number>;
  sizeQuantities: Record<string, number | ''>;
  note: string;
}

const createNewTab2RowHelper = (
  idx: number,
  sizesList: string[],
  defDate: string
): Tab2WorkingRow => {
  const rowId = `draft-act-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
  const sq: Record<string, number | ''> = {};
  sizesList.forEach((s) => {
    sq[s] = '';
  });
  const rowNum = idx + 1;
  return {
    id: rowId,
    isNew: true,
    receiptDate: defDate,
    poNumber: `PO-${String(rowNum).padStart(2, '0')}`,
    itemCode: `VT-${String(rowNum).padStart(2, '0')}`,
    voucherCode: '',
    description: '',
    unit: 'PRS',
    planTotalQty: 0,
    planSizeQuantities: {},
    sizeQuantities: sq,
    note: '',
  };
};

const buildInitialWorkingRows = (
  planOrders: PlanOrderRow[],
  actualReceives: ActualReceiveRow[],
  sizesList: string[],
  defDate: string
): Tab2WorkingRow[] => {
  if (planOrders.length === 0) {
    return [
      createNewTab2RowHelper(0, sizesList, defDate),
      createNewTab2RowHelper(1, sizesList, defDate),
    ];
  }
  return planOrders.map((plan) => {
    const existing = actualReceives.find((a) => a.planOrderId === plan.id);
    const sq: Record<string, number | ''> = {};
    sizesList.forEach((s) => {
      if (existing && typeof existing.sizeQuantities[s] === 'number') {
        sq[s] = existing.sizeQuantities[s];
      } else {
        sq[s] = '';
      }
    });
    return {
      id: plan.id,
      isNew: false,
      receiptDate: plan.receiptDate,
      poNumber: plan.poNumber,
      itemCode: plan.itemCode,
      voucherCode: plan.voucherCode || '',
      description: plan.description || '',
      unit: plan.unit || 'PRS',
      planTotalQty: plan.totalQty || 0,
      planSizeQuantities: plan.sizeQuantities || {},
      sizeQuantities: sq,
      note: existing?.note || '',
    };
  });
};

export const Tab2ActualReceive: React.FC = () => {
  const { alert, confirm, toast } = useMessageBox();
  const {
    currentCustomer,
    activeSizeRun,
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    addPlanOrders,
    updatePlanOrder,
    saveActualReceives,
    resetActualReceive,
  } = useInventory();

  const defaultDate = getCurrentDateFormatted();
  const sizes = useMemo(() => {
    if (activeSizeRun?.sizes && activeSizeRun.sizes.length > 0) {
      return activeSizeRun.sizes;
    }
    return ['4', '5', '6', '7', '8', '9', '10', '11', '12'];
  }, [activeSizeRun]);

  const [workingRows, setWorkingRows] = useState<Tab2WorkingRow[]>(() =>
    buildInitialWorkingRows(currentCustomerPlanOrders, currentCustomerActualReceives, sizes, defaultDate)
  );

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const lastCustomerIdRef = useRef<string | undefined>(currentCustomer?.id);

  // Synchronize when customer changes or new plan orders are added from Tab 1
  useEffect(() => {
    if (lastCustomerIdRef.current !== currentCustomer?.id) {
      lastCustomerIdRef.current = currentCustomer?.id;
      setWorkingRows(
        buildInitialWorkingRows(currentCustomerPlanOrders, currentCustomerActualReceives, sizes, defaultDate)
      );
      return;
    }

    setWorkingRows((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const missingPlans = currentCustomerPlanOrders.filter((p) => !existingIds.has(p.id));

      if (missingPlans.length === 0) {
        return prev;
      }

      const newRowsFromPlans: Tab2WorkingRow[] = missingPlans.map((plan) => {
        const existingAct = currentCustomerActualReceives.find((a) => a.planOrderId === plan.id);
        const sq: Record<string, number | ''> = {};
        sizes.forEach((s) => {
          if (existingAct && typeof existingAct.sizeQuantities[s] === 'number') {
            sq[s] = existingAct.sizeQuantities[s];
          } else {
            sq[s] = '';
          }
        });
        return {
          id: plan.id,
          isNew: false,
          receiptDate: plan.receiptDate,
          poNumber: plan.poNumber,
          itemCode: plan.itemCode,
          voucherCode: plan.voucherCode || '',
          description: plan.description || '',
          unit: plan.unit || 'PRS',
          planTotalQty: plan.totalQty || 0,
          planSizeQuantities: plan.sizeQuantities || {},
          sizeQuantities: sq,
          note: existingAct?.note || '',
        };
      });

      const onlyHasEmptyNewRows = prev.every(
        (r) => r.isNew && getRowActualTotal(r) === 0 && !r.poNumber.trim()
      );
      if (onlyHasEmptyNewRows) {
        return newRowsFromPlans;
      }

      return [...prev, ...newRowsFromPlans];
    });
  }, [currentCustomer?.id, currentCustomerPlanOrders, currentCustomerActualReceives, sizes, defaultDate]);

  // Add 1 or 5 rows manually
  const handleAddRows = (count: number = 1) => {
    setWorkingRows((prev) => {
      const next = [...prev];
      for (let i = 0; i < count; i++) {
        next.push(createNewTab2RowHelper(next.length, sizes, defaultDate));
      }
      return next;
    });
    toast(`Đã thêm ${count} dòng thực nhận.`);
  };

  // Update field of a row
  const handleUpdateRowField = (id: string, field: keyof Tab2WorkingRow, value: any) => {
    setWorkingRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'itemCode' && !r.description) {
          updated.description = `Vật tư ${value}`;
        }
        return updated;
      })
    );
  };

  // Update actual size quantity for a specific row
  const handleUpdateSizeQty = (id: string, size: string, val: string) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setWorkingRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        return {
          ...r,
          sizeQuantities: {
            ...r.sizeQuantities,
            [size]: num,
          },
        };
      })
    );
  };

  // Quick populate 100% from Plan order
  const handleCopyFromPlan = (rowId?: string) => {
    if (rowId) {
      setWorkingRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const newSizes: Record<string, number | ''> = {};
          sizes.forEach((s) => {
            const planQ = r.planSizeQuantities[s];
            newSizes[s] = typeof planQ === 'number' && planQ > 0 ? planQ : '';
          });
          return { ...r, sizeQuantities: newSizes };
        })
      );
      toast('Đã sao chép số lượng từ phiếu sang dòng thực nhận!');
    } else {
      confirm('Sao chép toàn bộ số lượng từ phiếu sang thực nhận cho tất cả các đơn?', () => {
        setWorkingRows((prev) =>
          prev.map((r) => {
            const newSizes: Record<string, number | ''> = {};
            sizes.forEach((s) => {
              const planQ = r.planSizeQuantities[s];
              newSizes[s] = typeof planQ === 'number' && planQ > 0 ? planQ : '';
            });
            return { ...r, sizeQuantities: newSizes };
          })
        );
        toast('Đã sao chép toàn bộ số lượng từ phiếu sang thực nhận!');
      });
    }
  };

  // Calculate row total actual
  const getRowActualTotal = (row: Tab2WorkingRow): number => {
    return sizes.reduce((sum, s) => {
      const q = row.sizeQuantities[s];
      return sum + (typeof q === 'number' ? q : 0);
    }, 0);
  };

  // Reset or delete a row
  const handleResetRow = (row: Tab2WorkingRow) => {
    if (row.isNew) {
      if (workingRows.length <= 1) {
        setWorkingRows([createNewTab2RowHelper(0, sizes, defaultDate)]);
      } else {
        setWorkingRows((prev) => prev.filter((r) => r.id !== row.id));
      }
      toast(`Đã xóa dòng PO ${row.poNumber}`);
      return;
    }

    confirm(`Bạn có chắc muốn đặt lại số lượng thực nhận của PO ${row.poNumber} về 0?`, () => {
      setWorkingRows((prev) =>
        prev.map((r) => {
          if (r.id !== row.id) return r;
          const emptySizes: Record<string, number | ''> = {};
          sizes.forEach((s) => {
            emptySizes[s] = '';
          });
          return { ...r, sizeQuantities: emptySizes, note: '' };
        })
      );
      resetActualReceive(row.id);
      toast(`✅ Đã đặt lại số thực nhận PO ${row.poNumber} về 0`);
    });
  };

  // Reset all actual quantities
  const handleClearAllRows = () => {
    confirm('Bạn có muốn đặt lại toàn bộ số lượng thực nhận về trống?', () => {
      setWorkingRows((prev) =>
        prev.map((r) => {
          const emptySizes: Record<string, number | ''> = {};
          sizes.forEach((s) => {
            emptySizes[s] = '';
          });
          return { ...r, sizeQuantities: emptySizes, note: '' };
        })
      );
      toast('Đã đặt lại toàn bộ số lượng thực nhận.');
    });
  };

  // Filtered rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return workingRows;
    const q = searchQuery.toLowerCase();
    return workingRows.filter(
      (p) =>
        p.poNumber.toLowerCase().includes(q) ||
        p.itemCode.toLowerCase().includes(q) ||
        p.voucherCode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [workingRows, searchQuery]);

  // Column totals
  const actualSizeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    sizes.forEach((s) => {
      totals[s] = filteredRows.reduce((sum, r) => {
        const q = r.sizeQuantities[s];
        return sum + (typeof q === 'number' ? q : 0);
      }, 0);
    });
    return totals;
  }, [filteredRows, sizes]);

  const actualGrandTotal = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + getRowActualTotal(r), 0);
  }, [filteredRows, sizes]);

  // Save all actual receives to Context (Flow to Tab 1, 3, 5, 6)
  const handleSaveAllActuals = () => {
    if (!currentCustomer) {
      alert('Chưa chọn Khách Hàng.', 'Chưa chọn đối tác', 'warning');
      return;
    }

    const actualRowsToSave: ActualReceiveRow[] = [];
    const newPlanOrdersToCreate: PlanOrderRow[] = [];
    const planOrdersToUpdate: PlanOrderRow[] = [];

    const validRows = workingRows.filter((r) => {
      const tot = getRowActualTotal(r);
      return r.poNumber.trim().length > 0 || r.itemCode.trim().length > 0 || tot > 0;
    });

    if (validRows.length === 0) {
      alert('Chưa có dữ liệu thực nhận nào để lưu!', 'Dữ liệu trống', 'warning');
      return;
    }

    validRows.forEach((row, idx) => {
      const sizeQ: Record<string, number> = {};
      let totalActual = 0;
      sizes.forEach((s) => {
        const q = row.sizeQuantities[s];
        const num = typeof q === 'number' ? q : 0;
        sizeQ[s] = num;
        totalActual += num;
      });

      const existingPlan = currentCustomerPlanOrders.find((p) => p.id === row.id);

      if (!existingPlan) {
        // Dòng mới thêm từ Tab 2 (chưa có ở Tab 1) -> Khởi tạo PlanOrderRow tương ứng
        const planSizes: Record<string, number> = {};
        sizes.forEach((s) => {
          planSizes[s] = sizeQ[s];
        });

        const newPlan: PlanOrderRow = {
          id: row.id,
          customerId: currentCustomer.id,
          receiptDate: row.receiptDate || defaultDate,
          poNumber: row.poNumber.trim() || `PO-${String(idx + 1).padStart(2, '0')}`,
          itemCode: row.itemCode.trim() || `VT-${String(idx + 1).padStart(2, '0')}`,
          voucherCode: row.voucherCode.trim(),
          description: row.description.trim() || `Vật tư ${row.itemCode.trim()}`,
          unit: row.unit || 'PRS',
          sizeQuantities: planSizes,
          totalQty: totalActual,
          note: row.note || 'Khởi tạo từ Tab 2 Thực Nhận',
          createdAt: row.receiptDate || defaultDate,
        };
        newPlanOrdersToCreate.push(newPlan);
      } else {
        // Nếu có sửa đổi thông tin định danh
        if (
          existingPlan.poNumber !== row.poNumber ||
          existingPlan.itemCode !== row.itemCode ||
          existingPlan.receiptDate !== row.receiptDate ||
          existingPlan.voucherCode !== row.voucherCode ||
          existingPlan.description !== row.description ||
          existingPlan.unit !== row.unit
        ) {
          planOrdersToUpdate.push({
            ...existingPlan,
            poNumber: row.poNumber.trim() || existingPlan.poNumber,
            itemCode: row.itemCode.trim() || existingPlan.itemCode,
            receiptDate: row.receiptDate || existingPlan.receiptDate,
            voucherCode: row.voucherCode,
            description: row.description,
            unit: row.unit || existingPlan.unit,
          });
        }
      }

      actualRowsToSave.push({
        id: `act-${row.id}`,
        planOrderId: row.id,
        customerId: currentCustomer.id,
        sizeQuantities: sizeQ,
        totalQty: totalActual,
        note: row.note.trim() || undefined,
        updatedAt: new Date().toLocaleString('vi-VN'),
      });
    });

    if (newPlanOrdersToCreate.length > 0) {
      addPlanOrders(newPlanOrdersToCreate);
    }
    planOrdersToUpdate.forEach((p) => {
      updatePlanOrder(p);
    });

    saveActualReceives(actualRowsToSave);

    // Đánh dấu các dòng đã lưu thành công
    setWorkingRows((prev) =>
      prev.map((r) => {
        if (validRows.some((v) => v.id === r.id)) {
          const tot = getRowActualTotal(r);
          return {
            ...r,
            isNew: false,
            planTotalQty: r.planTotalQty > 0 ? r.planTotalQty : tot,
          };
        }
        return r;
      })
    );

    toast(`✅ Đã lưu ${actualRowsToSave.length} dòng thực nhận vào hệ thống (đồng bộ Tab 1, 3, 5, 6)!`);
  };

  // Keyboard shortcut: Enter saves all actuals
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveAllActuals();
    }
  };

  // Columns definition for cell-aware 2D pasting
  const tab2Columns = useMemo(
    () => [
      { key: 'receiptDate', type: 'date' as const },
      { key: 'poNumber', type: 'text' as const },
      { key: 'itemCode', type: 'text' as const },
      { key: 'voucherCode', type: 'text' as const },
      { key: 'description', type: 'text' as const },
      { key: 'unit', type: 'unit' as const },
      ...sizes.map((s) => ({ key: `size_${s}`, type: 'size' as const, size: s })),
      { key: 'note', type: 'note' as const },
    ],
    [sizes]
  );

  // Container-level paste: 2D grid cell-aware paste with auto-expansion (matching Tab 1)
  const handleContainerPaste = (e: React.ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA') return;

    // Không can thiệp nếu đang dán vào ô tìm kiếm hoặc ô bên ngoài bảng
    const targetInput = target.closest('[data-row-idx]') as HTMLElement | null;
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

    // Nếu chỉ là 1 ô đơn lẻ không có tab/newline và đang gõ bình thường thì để trình duyệt dán tự nhiên
    if (!isMultiCell && targetInput && !clipText.includes('\t') && !clipText.includes('\n')) {
      return;
    }

    // Xác định ô bắt đầu paste (dòng và cột)
    let startRowIdx = 0;
    let startColIdx = 0;

    if (targetInput) {
      const rIdxStr = targetInput.getAttribute('data-row-idx');
      const colKeyStr = targetInput.getAttribute('data-col-key') || '';
      if (rIdxStr !== null) {
        startRowIdx = Math.max(0, parseInt(rIdxStr, 10));
      }
      const foundColIdx = tab2Columns.findIndex((c) => c.key === colKeyStr);
      if (foundColIdx >= 0) {
        startColIdx = foundColIdx;
      }
    } else {
      const firstEmptyIdx = workingRows.findIndex((r) => getRowActualTotal(r) === 0);
      startRowIdx = firstEmptyIdx >= 0 ? firstEmptyIdx : workingRows.length;
      startColIdx = 0;
    }

    e.preventDefault();

    // Bỏ qua dòng tiêu đề nếu người dùng copy cả header từ Excel
    let dataMatrix = matrix;
    if (
      dataMatrix.length > 1 &&
      dataMatrix[0].some((c) =>
        /^(size\s*\d+|ngày(\s*nhập)?|mã\s*po|mã\s*hàng|tt\s*code|số\s*phiếu(\s*kh)?|diễn\s*giải|đvt|stt)$/i.test(
          c.trim().toLowerCase()
        )
      )
    ) {
      dataMatrix = dataMatrix.slice(1);
    }

    const newWorkingRows = workingRows.map((r) => ({
      ...r,
      sizeQuantities: { ...r.sizeQuantities },
    }));

    dataMatrix.forEach((rowCells, rOffset) => {
      const targetRowIdx = startRowIdx + rOffset;

      // TỰ ĐỘNG THÊM DÒNG NẾU VƯỢT QUÁ SỐ DÒNG HIỆN CÓ (Y HỆT TAB 1!)
      while (targetRowIdx >= newWorkingRows.length) {
        newWorkingRows.push(createNewTab2RowHelper(newWorkingRows.length, sizes, defaultDate));
      }

      const rowObj = newWorkingRows[targetRowIdx];

      rowCells.forEach((cellRaw, cOffset) => {
        const targetColIdx = startColIdx + cOffset;
        if (targetColIdx >= tab2Columns.length) return;

        const colDef = tab2Columns[targetColIdx];
        const val = cellRaw.trim();

        if (colDef.type === 'size' && colDef.size) {
          if (!val || val === '-' || val === '0') {
            rowObj.sizeQuantities[colDef.size] = '';
          } else {
            const num = parseFloat(val.replace(/,/g, ''));
            rowObj.sizeQuantities[colDef.size] = isNaN(num) ? '' : Math.max(0, num);
          }
        } else if (colDef.key === 'receiptDate') {
          if (val) rowObj.receiptDate = val;
        } else if (colDef.key === 'poNumber') {
          if (val) rowObj.poNumber = val.toUpperCase();
        } else if (colDef.key === 'itemCode') {
          if (val) rowObj.itemCode = val.toUpperCase();
        } else if (colDef.key === 'voucherCode') {
          rowObj.voucherCode = val;
        } else if (colDef.key === 'description') {
          rowObj.description = val;
        } else if (colDef.key === 'unit') {
          if (val) rowObj.unit = val;
        } else if (colDef.key === 'note') {
          rowObj.note = val;
        }
      });
    });

    setWorkingRows(newWorkingRows);
    toast(`📋 Đã dán thành công ${dataMatrix.length} dòng dữ liệu vào Tab 2!`);
  };

  // Excel paste modal handler with auto-expansion
  const handleExcelPaste = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const newWorkingRows = workingRows.map((r) => ({
      ...r,
      sizeQuantities: { ...r.sizeQuantities },
    }));

    let updatedCount = 0;
    let addedCount = 0;

    lines.forEach((line, idx) => {
      const cells = line.split('\t').map((c) => c.trim());
      if (cells.length === 0 || (idx === 0 && cells[0].toLowerCase().includes('ngày'))) {
        return; // header
      }

      // Column order: NGÀY -> MÃ PO -> MÃ HÀNG -> SỐ PHIẾU KH -> DIỄN GIẢI -> ĐVT -> SIZE 4 -> ... -> SIZE 12
      const date = cells[0] || defaultDate;
      const poNum = (cells[1] || '').toUpperCase();
      const itemCode = (cells[2] || '').toUpperCase();
      const voucherCode = cells[3] || '';
      const description = cells[4] || '';
      const unit = cells[5] || 'PRS';

      const sq: Record<string, number | ''> = {};
      sizes.forEach((s, sIdx) => {
        const valStr = cells[6 + sIdx];
        if (valStr !== undefined) {
          if (!valStr || valStr === '-' || valStr === '0') {
            sq[s] = '';
          } else {
            const num = parseFloat(valStr.replace(/,/g, ''));
            sq[s] = isNaN(num) ? '' : Math.max(0, num);
          }
        }
      });

      // Match existing row in table by PO + ItemCode
      const existingIdx = newWorkingRows.findIndex(
        (r) => r.poNumber.toUpperCase() === poNum && (!itemCode || r.itemCode.toUpperCase() === itemCode)
      );

      if (existingIdx >= 0) {
        newWorkingRows[existingIdx].sizeQuantities = {
          ...newWorkingRows[existingIdx].sizeQuantities,
          ...sq,
        };
        updatedCount++;
      } else if (poNum || itemCode || Object.values(sq).some((v) => typeof v === 'number' && v > 0)) {
        // Tự động thêm dòng mới nếu chưa có
        const newRow: Tab2WorkingRow = {
          id: `paste-act-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          isNew: true,
          receiptDate: date,
          poNumber: poNum || `PO-${String(newWorkingRows.length + 1).padStart(2, '0')}`,
          itemCode: itemCode || `VT-${String(newWorkingRows.length + 1).padStart(2, '0')}`,
          voucherCode,
          description: description || `Vật tư ${itemCode}`,
          unit,
          planTotalQty: 0,
          planSizeQuantities: {},
          sizeQuantities: sq,
          note: 'Dán từ Excel',
        };
        newWorkingRows.push(newRow);
        addedCount++;
      }
    });

    setWorkingRows(newWorkingRows);
    alert(`📋 Đã dán thành công: Cập nhật ${updatedCount} dòng, tự động thêm mới ${addedCount} dòng thực nhận!`);
  };

  // Export Excel
  const handleExportExcel = () => {
    const headers = [
      'STT',
      'Ngày Nhập',
      'Mã PO',
      'Mã Hàng (TT Code)',
      'Số Phiếu KH',
      'Diễn Giải',
      'ĐVT',
      ...sizes.map((s) => `Size ${s}`),
      'Tổng Thực Nhận',
      'SL Phiếu',
      'Ghi Chú',
    ];

    const dataRows = filteredRows.map((r, idx) => [
      idx + 1,
      r.receiptDate,
      r.poNumber,
      r.itemCode,
      r.voucherCode,
      r.description,
      r.unit,
      ...sizes.map((s) => (typeof r.sizeQuantities[s] === 'number' ? r.sizeQuantities[s] : 0)),
      getRowActualTotal(r),
      r.planTotalQty > 0 ? r.planTotalQty : 0,
      r.note || '',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SoThucNhan_Tab2');
    XLSX.writeFile(wb, `Tab2_SoThucNhan_${currentCustomer?.name || 'KhachHang'}.xlsx`);
  };

  // Print preparation
  const printRows: PrintTableRow[] = useMemo(() => {
    return filteredRows.map((r, idx) => {
      const sq: Record<string, number> = {};
      sizes.forEach((s) => {
        sq[s] = Number(r.sizeQuantities[s]) || 0;
      });
      return {
        stt: idx + 1,
        date: r.receiptDate,
        voucherCode: r.voucherCode,
        poNumber: r.poNumber,
        code: r.itemCode,
        description: r.description,
        unit: r.unit,
        sizeQuantities: sq,
        totalQty: getRowActualTotal(r),
        note: r.note || '',
      };
    });
  }, [filteredRows, sizes]);

  return (
    <div
      className="space-y-4"
      ref={gridContainerRef}
      onKeyDown={handleKeyDown}
      onPaste={handleContainerPaste}
    >
      {/* Top Banner Notice */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 bg-[#f8fafc] border-b border-slate-300 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span>TAB 2: SỐ VẬT TƯ THỰC NHẬN (NHẬP THỰC TẾ & TỒN KHO BAN ĐẦU)</span>
            </h3>
            <span className="text-[11px] text-slate-500 hidden md:inline">
              | Tự động thêm dòng khi dán Excel • Nhấn Enter để lưu
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleAddRows(1)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
              title="Thêm 1 dòng nhập mới"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ 1 Dòng</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddRows(5)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
              title="Thêm 5 dòng nhập mới"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ 5 Dòng</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>In HTML</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPasteModal(true)}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dán Excel</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopyFromPlan()}
              className="inline-flex items-center gap-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
              title="Điền nhanh 100% số lượng từ phiếu nếu nhận đủ"
            >
              <Copy className="w-3.5 h-3.5 text-sky-600" />
              <span>Nhận Đủ (Copy P)</span>
            </button>

            <button
              type="button"
              onClick={handleClearAllRows}
              className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-rose-600 border border-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded transition shadow-2xs cursor-pointer"
              title="Đặt lại toàn bộ số lượng thực nhận về trống"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
              <span>Đặt lại</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAllActuals}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-xs transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>LƯU THỰC NHẬN (ENTER)</span>
            </button>
          </div>
        </div>

        {/* Search filter */}
        <div className="p-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Tìm PO, mã hàng, số phiếu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded p-1.5 pl-7 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          </div>

          <div className="text-[11px] text-slate-600 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Chọn bất kỳ ô nào (ví dụ ô Size 35) rồi Ctrl+V để dán trực tiếp từ Excel • Tự động nhảy thêm dòng tương ứng nếu paste nhiều dòng
            </span>
          </div>
        </div>

        {/* Grid Table */}
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#f4f6f8] text-slate-700 font-bold uppercase text-[11px] sticky top-0 z-10 select-none border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-8">#</th>
                <th className="p-2 border-r border-slate-300 min-w-[85px] bg-slate-100 text-slate-600">Ngày Nhập</th>
                <th className="p-2 border-r border-slate-300 min-w-[105px] bg-slate-100 text-slate-600">Mã PO</th>
                <th className="p-2 border-r border-slate-300 min-w-[120px] bg-slate-100 text-slate-600">Mã Hàng (TT)</th>
                <th className="p-2 border-r border-slate-300 min-w-[115px] bg-slate-100 text-slate-600">Số Phiếu KH</th>
                <th className="p-2 border-r border-slate-300 min-w-[145px] bg-slate-100 text-slate-600">Diễn Giải</th>
                <th className="p-2 border-r border-slate-300 text-center w-14 bg-slate-100 text-slate-600">ĐVT</th>

                {sizes.map((s) => (
                  <th
                    key={s}
                    className="p-2 border-r border-slate-300 min-w-[48px] text-center font-mono font-bold bg-emerald-50 text-emerald-900"
                  >
                    Size {s}
                  </th>
                ))}

                <th className="p-2 border-r border-slate-300 min-w-[85px] text-right bg-emerald-100 text-emerald-950 font-bold">
                  THỰC NHẬN
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[70px] text-right bg-slate-100 text-slate-600">
                  SL PHIẾU
                </th>
                <th className="p-2 border-r border-slate-300 min-w-[110px]">Ghi Chú</th>
                <th className="p-2 text-center w-16">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-sans">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7 + sizes.length + 3} className="p-8 text-center text-slate-400 text-xs italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>Chưa có dòng dữ liệu thực nhận nào.</p>
                      <button
                        type="button"
                        onClick={() => handleAddRows(1)}
                        className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold text-xs mt-1 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm 1 dòng mới để nhập</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const actualTotal = getRowActualTotal(row);

                  return (
                    <tr
                      key={row.id}
                      onKeyDown={handleKeyDown}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-2 border-r border-slate-200 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Ngày nhập */}
                      <td className="p-0 border-r border-slate-200 bg-slate-50/50">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="receiptDate"
                          value={row.receiptDate}
                          onChange={(e) => handleUpdateRowField(row.id, 'receiptDate', e.target.value)}
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-700 whitespace-nowrap"
                        />
                      </td>

                      {/* Mã PO */}
                      <td className="p-0 border-r border-slate-200 bg-slate-50/50">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="poNumber"
                          value={row.poNumber}
                          onChange={(e) => handleUpdateRowField(row.id, 'poNumber', e.target.value.toUpperCase())}
                          placeholder="Mã PO..."
                          className="w-full h-8 px-2 text-xs font-mono font-bold bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-sky-700 uppercase"
                        />
                      </td>

                      {/* Mã Hàng */}
                      <td className="p-0 border-r border-slate-200 bg-slate-50/50">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="itemCode"
                          value={row.itemCode}
                          onChange={(e) => handleUpdateRowField(row.id, 'itemCode', e.target.value.toUpperCase())}
                          placeholder="Mã hàng..."
                          className="w-full h-8 px-2 text-xs font-mono font-bold bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-800 uppercase"
                        />
                      </td>

                      {/* Số phiếu KH */}
                      <td className="p-0 border-r border-slate-200 bg-slate-50/50">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="voucherCode"
                          value={row.voucherCode}
                          onChange={(e) => handleUpdateRowField(row.id, 'voucherCode', e.target.value)}
                          placeholder="Số phiếu..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-600"
                        />
                      </td>

                      {/* Diễn giải */}
                      <td className="p-0 border-r border-slate-200 bg-slate-50/50 max-w-[150px]">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="description"
                          value={row.description}
                          onChange={(e) => handleUpdateRowField(row.id, 'description', e.target.value)}
                          placeholder="Diễn giải..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-600 truncate"
                        />
                      </td>

                      {/* ĐVT */}
                      <td className="p-0 border-r border-slate-200 bg-slate-50/50 w-14">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="unit"
                          value={row.unit}
                          onChange={(e) => handleUpdateRowField(row.id, 'unit', e.target.value)}
                          className="w-full h-8 px-1 text-center text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white text-slate-600 font-medium"
                        />
                      </td>

                      {/* Editable Actual Quantities per Size */}
                      {sizes.map((s) => {
                        const val = row.sizeQuantities[s];
                        return (
                          <td key={s} className="p-0 border-r border-slate-200">
                            <input
                              id={`act-input-${row.id}-${s}`}
                              data-row-id={row.id}
                              data-row-idx={idx}
                              data-col-key={`size_${s}`}
                              data-plan-id={row.id}
                              data-plan-idx={idx}
                              data-size={s}
                              type="number"
                              min="0"
                              value={val !== undefined ? val : ''}
                              onChange={(e) => handleUpdateSizeQty(row.id, s, e.target.value)}
                              placeholder="-"
                              className="w-full h-8 px-1 text-center font-mono font-bold text-xs bg-white text-slate-900 border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        );
                      })}

                      {/* Total Actual */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-xs bg-emerald-50/60 text-emerald-900">
                        {actualTotal > 0 ? actualTotal.toLocaleString('vi-VN') : '-'}
                      </td>

                      {/* Total Plan (for comparison) */}
                      <td className="p-2 border-r border-slate-200 text-right font-mono text-xs bg-slate-50 text-slate-500">
                        {row.planTotalQty > 0 ? row.planTotalQty.toLocaleString('vi-VN') : (row.isNew ? '-' : '0')}
                      </td>

                      {/* Note */}
                      <td className="p-0 border-r border-slate-200">
                        <input
                          type="text"
                          data-row-id={row.id}
                          data-row-idx={idx}
                          data-col-key="note"
                          value={row.note}
                          onChange={(e) => handleUpdateRowField(row.id, 'note', e.target.value)}
                          placeholder="Ghi chú thực nhận..."
                          className="w-full h-8 px-2 text-xs bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white"
                        />
                      </td>

                      {/* Actions: Nhận đủ, Sửa, Xóa */}
                      <td className="p-1 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCopyFromPlan(row.id)}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-slate-200 transition cursor-pointer"
                            title="Chép 100% SL từ trên phiếu sang dòng này"
                          >
                            Nhận đủ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`act-input-${row.id}-${sizes[0]}`);
                              if (el) el.focus();
                            }}
                            className="p-1 text-slate-400 hover:text-sky-600 rounded hover:bg-sky-50 transition cursor-pointer"
                            title="Chỉnh sửa số lượng thực nhận"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetRow(row)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                            title={row.isNew ? 'Xóa dòng này' : 'Đặt lại số lượng thực nhận về 0'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Total Summary Row */}
              <tr className="bg-[#e9ecf0] text-slate-900 font-bold border-t-2 border-slate-300">
                <td colSpan={7} className="p-2 border-r border-slate-300 text-right uppercase tracking-wider text-[11px]">
                  TỔNG THỰC NHẬN TOÀN BỘ:
                </td>
                {sizes.map((s) => (
                  <td key={s} className="p-2 border-r border-slate-300 text-center font-mono font-bold text-xs text-emerald-950">
                    {actualSizeTotals[s] > 0 ? actualSizeTotals[s].toLocaleString('vi-VN') : '-'}
                  </td>
                ))}
                <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-xs text-emerald-900">
                  {actualGrandTotal > 0 ? actualGrandTotal.toLocaleString('vi-VN') : '0'}
                </td>
                <td colSpan={3} className="p-2 text-slate-500 text-[11px] italic">
                  Đồng bộ sang Tab 5 & Tab 6 (Tồn đầu kỳ thực nhận)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-2 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 text-[11px]">
            <span>💡 <strong>Tab</strong> để nhảy ô • <strong>Ctrl + V</strong> dán từ Excel tự động thêm dòng • <strong>Enter</strong> để lưu toàn bộ thực nhận.</span>
          </div>
          <div className="text-[11px] text-slate-600">
            Tổng cộng: <strong>{filteredRows.length}</strong> dòng • Tổng SL thực nhận: <strong>{actualGrandTotal.toLocaleString('vi-VN')}</strong>
          </div>
        </div>
      </div>

      {/* Excel Paste Modal */}
      <ExcelPasteModal<any>
        isOpen={showPasteModal}
        onClose={() => setShowPasteModal(false)}
        title="Dán Số Lượng Thực Nhận Từ Excel (Tab 2)"
        description="Copy bảng thực nhận từ Excel (Ctrl+C), dán vào đây (Ctrl+V). Hệ thống tự động khớp Mã PO hoặc sinh thêm dòng mới tương ứng nếu chưa có."
        columnsSample={[
          'Ngày',
          'Mã PO',
          'Mã Hàng',
          'Số Phiếu',
          'Diễn Giải',
          'ĐVT',
          ...sizes.map((s) => `Size ${s}`),
        ]}
        parseFunction={(text) => {
          handleExcelPaste(text);
          return [];
        }}
        onApply={() => {
          setShowPasteModal(false);
        }}
      />

      {/* Print HTML Modal */}
      <PrintHtmlModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="PHIẾU GHI NHẬN SỐ LƯỢNG THỰC NHẬN (TAB 2)"
        customerName={currentCustomer?.name || 'Chung'}
        documentCode="02-TN/VT"
        sizes={sizes}
        rows={printRows}
      />
    </div>
  );
};
