import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Customer,
  PurchaseOrder,
  MaterialReceipt,
  ProductionDelivery,
  CompensationOrder,
  InventoryItem,
  InventoryMovementRecord,
  DashboardReportItem,
  SizeRun,
  PlanOrderRow,
  ActualReceiveRow,
  DiscrepancyRow,
  ProductionIssueRow,
  ProductionReportRow,
  CompensationRequestItem,
  RealtimeStockItem,
  FinishedGoodsDeliveryRow,
  FinishedGoodsStockItem,
} from '../types';
import {
  INITIAL_CUSTOMERS,
  INITIAL_POS,
  INITIAL_RECEIPTS,
  INITIAL_DELIVERIES,
  INITIAL_COMPENSATIONS,
  INITIAL_INVENTORIES,
  INITIAL_PLAN_ORDERS,
  INITIAL_ACTUAL_RECEIVES,
  INITIAL_PRODUCTION_ISSUES,
  INITIAL_PRODUCTION_REPORTS,
} from '../data/initialData';
import { isDateInRange } from '../utils/dateUtils';

interface InventoryContextType {
  customers: Customer[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  currentCustomer: Customer | undefined;
  activeSizeRun: SizeRun | undefined;
  setActiveSizeRun: (sizeRunId: string) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  updateCustomerSizeRuns: (customerId: string, sizeRuns: SizeRun[], activeId: string) => void;
  deleteSizeRun: (customerId: string, sizeRunId: string) => void;
  
  purchaseOrders: PurchaseOrder[];
  addPurchaseOrder: (po: PurchaseOrder) => void;
  updatePurchaseOrder: (po: PurchaseOrder) => void;
  deletePurchaseOrder: (id: string) => void;
  savePurchaseOrders: (pos: PurchaseOrder[]) => void;

  receipts: MaterialReceipt[];
  addReceipt: (receipt: MaterialReceipt) => void;
  updateReceipt: (receipt: MaterialReceipt) => void;
  deleteReceipt: (id: string) => void;

  deliveries: ProductionDelivery[];
  addDelivery: (delivery: ProductionDelivery) => void;
  updateDelivery: (delivery: ProductionDelivery) => void;
  deleteDelivery: (id: string) => void;

  compensations: CompensationOrder[];
  addCompensation: (comp: CompensationOrder) => void;
  updateCompensation: (comp: CompensationOrder) => void;
  updateCompensationStatus: (id: string, status: CompensationOrder['status'], completionDate?: string) => void;
  deleteCompensation: (id: string) => void;

  inventories: InventoryItem[];
  updateInventoryActual: (id: string, stockActual: number, auditDate: string, note?: string) => void;
  addInventoryItem: (item: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;

  // Global Date Range
  startDate: string;
  endDate: string;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;

  // Computed data
  currentCustomerPOs: PurchaseOrder[];
  currentCustomerReceipts: MaterialReceipt[];
  currentCustomerDeliveries: ProductionDelivery[];
  currentCustomerCompensations: CompensationOrder[];
  dashboardReportData: DashboardReportItem[];

  // ==========================================================================
  // PHÂN HỆ SRS: 7 TAB NGHIỆP VỤ LIÊN HOÀN
  // ==========================================================================
  planOrders: PlanOrderRow[];
  actualReceives: ActualReceiveRow[];
  productionIssues: ProductionIssueRow[];
  productionReports: ProductionReportRow[];
  compensationRequests: CompensationRequestItem[];

  // Dữ liệu lọc theo khách hàng đang chọn (Multi-tenancy)
  currentCustomerPlanOrders: PlanOrderRow[];
  currentCustomerActualReceives: ActualReceiveRow[];
  currentCustomerProductionIssues: ProductionIssueRow[];
  currentCustomerProductionReports: ProductionReportRow[];
  currentCustomerDiscrepancies: DiscrepancyRow[];
  currentCustomerCompensationItems: CompensationRequestItem[];
  currentCustomerRealtimeStock: RealtimeStockItem[];
  stockCompensations: Record<string, Record<string, number>>;
  updateStockCompensation: (poNumber: string, itemCode: string, size: string, qty: number | '') => void;

  // Handlers SRS
  addPlanOrder: (order: PlanOrderRow) => void;
  addPlanOrders: (orders: PlanOrderRow[]) => void;
  updatePlanOrder: (order: PlanOrderRow) => void;
  deletePlanOrder: (id: string) => void;
  saveActualReceive: (actual: ActualReceiveRow) => void;
  saveActualReceives: (actuals: ActualReceiveRow[]) => void;
  addProductionIssue: (issue: ProductionIssueRow) => void;
  addProductionIssues: (issues: ProductionIssueRow[]) => void;
  deleteProductionIssue: (id: string) => void;
  updateProductionIssue: (issue: ProductionIssueRow) => void;
  addProductionReport: (report: ProductionReportRow) => void;
  updateProductionReport: (report: ProductionReportRow) => void;
  deleteProductionReport: (id: string) => void;
  resetActualReceive: (planOrderId: string) => void;
  updateCompensationRequestStatus: (id: string, status: CompensationRequestItem['status']) => void;
  updateCompensationRequestDate: (id: string, requestDate: string) => void;
  updateCompensationRequest: (item: CompensationRequestItem) => void;
  addCompensationRequest: (item: CompensationRequestItem) => void;
  deleteCompensationRequest: (id: string) => void;

  // PHÂN HỆ THÀNH PHẨM (FINISHED GOODS)
  finishedGoodsDeliveries: FinishedGoodsDeliveryRow[];
  currentCustomerFinishedGoodsDeliveries: FinishedGoodsDeliveryRow[];
  currentCustomerFinishedGoodsStock: FinishedGoodsStockItem[];
  addFinishedGoodsDelivery: (delivery: FinishedGoodsDeliveryRow) => void;
  updateFinishedGoodsDelivery: (delivery: FinishedGoodsDeliveryRow) => void;
  deleteFinishedGoodsDelivery: (id: string) => void;

  // NHẬN VẬT TƯ GIAO BÙ
  receiveCompensationItem: (
    item: CompensationRequestItem,
    receivedQuantities: Record<string, number>,
    receivedDate?: string
  ) => void;
  resetCompensationReceive: (itemId: string) => void;

  resetAllData: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // LocalStorage initialization helper
  const loadStored = <T,>(key: string, defaultVal: T): T => {
    try {
      const item = localStorage.getItem(`dd_inventory_${key}`);
      return item ? JSON.parse(item) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [customers, setCustomers] = useState<Customer[]>(() => loadStored('customers', INITIAL_CUSTOMERS));
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    const saved = loadStored('selectedCustomerId', 'cust-deawoong');
    return customers.some(c => c.id === saved) ? saved : customers[0]?.id || 'cust-deawoong';
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => loadStored('pos', INITIAL_POS));
  const [receipts, setReceipts] = useState<MaterialReceipt[]>(() => loadStored('receipts', INITIAL_RECEIPTS));
  const [deliveries, setDeliveries] = useState<ProductionDelivery[]>(() => loadStored('deliveries', INITIAL_DELIVERIES));
  const [compensations, setCompensations] = useState<CompensationOrder[]>(() => loadStored('compensations', INITIAL_COMPENSATIONS));
  const [inventories, setInventories] = useState<InventoryItem[]>(() => loadStored('inventories', INITIAL_INVENTORIES));

  // SRS collections
  const [planOrders, setPlanOrders] = useState<PlanOrderRow[]>(() =>
    loadStored('planOrders', INITIAL_PLAN_ORDERS)
  );
  const [actualReceives, setActualReceives] = useState<ActualReceiveRow[]>(() =>
    loadStored('actualReceives', INITIAL_ACTUAL_RECEIVES)
  );
  const [productionIssues, setProductionIssues] = useState<ProductionIssueRow[]>(() =>
    loadStored('productionIssues', INITIAL_PRODUCTION_ISSUES)
  );
  const [productionReports, setProductionReports] = useState<ProductionReportRow[]>(() =>
    loadStored('productionReports', INITIAL_PRODUCTION_REPORTS)
  );
  const [customCompensationRequests, setCustomCompensationRequests] = useState<CompensationRequestItem[]>(() =>
    loadStored('compensationRequests', [])
  );
  const [stockCompensations, setStockCompensations] = useState<Record<string, Record<string, number>>>(() =>
    loadStored('stockCompensations', {})
  );
  const [compensationDateOverrides, setCompensationDateOverrides] = useState<Record<string, string>>(() =>
    loadStored('compensationDateOverrides', {})
  );
  const [hiddenCompensationItemIds, setHiddenCompensationItemIds] = useState<string[]>(() =>
    loadStored('hiddenCompensationItemIds', [])
  );
  const [finishedGoodsDeliveries, setFinishedGoodsDeliveries] = useState<FinishedGoodsDeliveryRow[]>(() =>
    loadStored('finishedGoodsDeliveries', [])
  );
  const [compensationReceivedQuantities, setCompensationReceivedQuantities] = useState<Record<string, Record<string, number>>>(() =>
    loadStored('compensationReceivedQuantities', {})
  );
  const [compensationStatusOverrides, setCompensationStatusOverrides] = useState<Record<string, CompensationRequestItem['status']>>(() =>
    loadStored('compensationStatusOverrides', {})
  );
  const [supplementalMaterialStock, setSupplementalMaterialStock] = useState<Record<string, Record<string, number>>>(() =>
    loadStored('supplementalMaterialStock', {})
  );

  // Date filters
  const [startDate, setStartDate] = useState<string>('01/09/2026');
  const [endDate, setEndDate] = useState<string>('30/09/2026');

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('dd_inventory_customers', JSON.stringify(customers));
  }, [customers]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_selectedCustomerId', JSON.stringify(selectedCustomerId));
  }, [selectedCustomerId]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_pos', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_receipts', JSON.stringify(receipts));
  }, [receipts]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_deliveries', JSON.stringify(deliveries));
  }, [deliveries]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_compensations', JSON.stringify(compensations));
  }, [compensations]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_inventories', JSON.stringify(inventories));
  }, [inventories]);

  // Sync SRS to local storage
  useEffect(() => {
    localStorage.setItem('dd_inventory_planOrders', JSON.stringify(planOrders));
  }, [planOrders]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_actualReceives', JSON.stringify(actualReceives));
  }, [actualReceives]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_productionIssues', JSON.stringify(productionIssues));
  }, [productionIssues]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_productionReports', JSON.stringify(productionReports));
  }, [productionReports]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_compensationRequests', JSON.stringify(customCompensationRequests));
  }, [customCompensationRequests]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_stockCompensations', JSON.stringify(stockCompensations));
  }, [stockCompensations]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_compensationDateOverrides', JSON.stringify(compensationDateOverrides));
  }, [compensationDateOverrides]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_hiddenCompensationItemIds', JSON.stringify(hiddenCompensationItemIds));
  }, [hiddenCompensationItemIds]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_finishedGoodsDeliveries', JSON.stringify(finishedGoodsDeliveries));
  }, [finishedGoodsDeliveries]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_compensationReceivedQuantities', JSON.stringify(compensationReceivedQuantities));
  }, [compensationReceivedQuantities]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_compensationStatusOverrides', JSON.stringify(compensationStatusOverrides));
  }, [compensationStatusOverrides]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_supplementalMaterialStock', JSON.stringify(supplementalMaterialStock));
  }, [supplementalMaterialStock]);

  // Helper gửi yêu cầu đồng bộ lên Cloudflare D1
  const syncToApi = async (action: string, payload?: any) => {
    try {
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
    } catch (err) {
      console.warn('D1 sync warning (working in fallback mode):', err);
    }
  };

  // Tự động tải dữ liệu từ Cloudflare D1 khi vào web
  useEffect(() => {
    fetch('/api/inventory')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.success) return;

        // Nếu database mới tạo và hoàn toàn trống, ta nạp dữ liệu khởi tạo mặc định lên D1
        if (data.isEmpty) {
          syncToApi('SEED_ALL', {
            customers: INITIAL_CUSTOMERS,
            planOrders: INITIAL_PLAN_ORDERS,
            actualReceives: INITIAL_ACTUAL_RECEIVES,
            productionIssues: INITIAL_PRODUCTION_ISSUES,
            productionReports: INITIAL_PRODUCTION_REPORTS,
            compensationRequests: [],
            stockCompensations: {},
            purchaseOrders: INITIAL_POS,
            receipts: INITIAL_RECEIPTS,
            deliveries: INITIAL_DELIVERIES,
            compensations: INITIAL_COMPENSATIONS,
            inventories: INITIAL_INVENTORIES,
          });
          return;
        }

        // Database đã có dữ liệu -> Cập nhật vào state
        if (data.customers && data.customers.length > 0) setCustomers(data.customers);
        if (data.planOrders) setPlanOrders(data.planOrders);
        if (data.actualReceives) setActualReceives(data.actualReceives);
        if (data.productionIssues) setProductionIssues(data.productionIssues);
        if (data.productionReports) setProductionReports(data.productionReports);
        if (data.compensationRequests) setCustomCompensationRequests(data.compensationRequests);
        if (data.stockCompensations) setStockCompensations(data.stockCompensations);
        if (data.purchaseOrders) setPurchaseOrders(data.purchaseOrders);
        if (data.receipts) setReceipts(data.receipts);
        if (data.deliveries) setDeliveries(data.deliveries);
        if (data.compensations) setCompensations(data.compensations);
        if (data.inventories) setInventories(data.inventories);
      })
      .catch((err) => console.log('Using local data (D1 not reachable or offline):', err));
  }, []);

  const currentCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || customers[0],
    [customers, selectedCustomerId]
  );

  const activeSizeRun = useMemo(() => {
    if (!currentCustomer) return undefined;
    return (
      currentCustomer.sizeRuns.find((sr) => sr.id === currentCustomer.activeSizeRunId) ||
      currentCustomer.sizeRuns[0]
    );
  }, [currentCustomer]);

  const setActiveSizeRun = (sizeRunId: string) => {
    if (!currentCustomer) return;
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === currentCustomer.id ? { ...c, activeSizeRunId: sizeRunId } : c
      )
    );
  };

  // Customers CRUD
  const addCustomer = (newCustomer: Customer) => {
    setCustomers((prev) => [...prev, newCustomer]);
    setSelectedCustomerId(newCustomer.id);
    syncToApi('SAVE_CUSTOMER', newCustomer);
  };

  const updateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    syncToApi('SAVE_CUSTOMER', updated);
  };

  const deleteCustomer = (id: string) => {
    if (customers.length <= 1) {
      alert('Hệ thống phải có ít nhất 1 khách hàng.');
      return;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (selectedCustomerId === id) {
      const remaining = customers.filter((c) => c.id !== id);
      setSelectedCustomerId(remaining[0]?.id || '');
    }
    syncToApi('DELETE_CUSTOMER', { id });
  };

  const updateCustomerSizeRuns = (customerId: string, sizeRuns: SizeRun[], activeId: string) => {
    setCustomers((prev) => {
      const updated = prev.map((c) => (c.id === customerId ? { ...c, sizeRuns, activeSizeRunId: activeId } : c));
      const target = updated.find((c) => c.id === customerId);
      if (target) syncToApi('SAVE_CUSTOMER', target);
      return updated;
    });
  };

  const deleteSizeRun = (customerId: string, sizeRunId: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        if (c.sizeRuns.length <= 1) {
          alert('Khách hàng phải có ít nhất một dải size.');
          return c;
        }
        const newRuns = c.sizeRuns.filter((sr) => sr.id !== sizeRunId);
        const newActive = c.activeSizeRunId === sizeRunId ? newRuns[0].id : c.activeSizeRunId;
        return { ...c, sizeRuns: newRuns, activeSizeRunId: newActive };
      })
    );
  };

  // POs CRUD
  const addPurchaseOrder = (po: PurchaseOrder) => {
    setPurchaseOrders((prev) => [po, ...prev]);
  };

  const updatePurchaseOrder = (po: PurchaseOrder) => {
    setPurchaseOrders((prev) => prev.map((p) => (p.id === po.id ? po : p)));
  };

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
  };

  const savePurchaseOrders = (pos: PurchaseOrder[]) => {
    setPurchaseOrders((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      pos.forEach((p) => map.set(p.id, p));
      return Array.from(map.values());
    });
  };

  // Receipts CRUD
  const addReceipt = (rec: MaterialReceipt) => {
    setReceipts((prev) => [rec, ...prev]);
  };

  const updateReceipt = (rec: MaterialReceipt) => {
    setReceipts((prev) => prev.map((r) => (r.id === rec.id ? rec : r)));
  };

  const deleteReceipt = (id: string) => {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  // Deliveries CRUD
  const addDelivery = (del: ProductionDelivery) => {
    setDeliveries((prev) => [del, ...prev]);
  };

  const updateDelivery = (del: ProductionDelivery) => {
    setDeliveries((prev) => prev.map((d) => (d.id === del.id ? del : d)));
  };

  const deleteDelivery = (id: string) => {
    setDeliveries((prev) => prev.filter((d) => d.id !== id));
  };

  // Compensations CRUD
  const addCompensation = (comp: CompensationOrder) => {
    setCompensations((prev) => [comp, ...prev]);
  };

  const updateCompensation = (comp: CompensationOrder) => {
    setCompensations((prev) => prev.map((c) => (c.id === comp.id ? comp : c)));
  };

  const updateCompensationStatus = (id: string, status: CompensationOrder['status'], completionDate?: string) => {
    setCompensations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, completionDate: completionDate || c.completionDate } : c))
    );
  };

  const deleteCompensation = (id: string) => {
    setCompensations((prev) => prev.filter((c) => c.id !== id));
  };

  // Inventories CRUD
  const updateInventoryActual = (id: string, stockActual: number, auditDate: string, note?: string) => {
    setInventories((prev) => {
      const exists = prev.some((i) => i.id === id);
      if (exists) {
        return prev.map((i) => (i.id === id ? { ...i, stockActual, auditDate, note: note ?? i.note } : i));
      }
      return [
        ...prev,
        {
          id,
          customerId: selectedCustomerId,
          poId: 'N/A',
          originalName: 'Item',
          vnName: 'Vật tư',
          size: 'F',
          unit: 'cái',
          stockActual,
          auditDate,
          note,
        },
      ];
    });
  };

  const addInventoryItem = (item: InventoryItem) => {
    setInventories((prev) => [...prev, item]);
  };

  const deleteInventoryItem = (id: string) => {
    setInventories((prev) => prev.filter((i) => i.id !== id));
  };

  const resetAllData = () => {
    setCustomers(INITIAL_CUSTOMERS);
    setSelectedCustomerId('cust-deawoong');
    setPurchaseOrders(INITIAL_POS);
    setReceipts(INITIAL_RECEIPTS);
    setDeliveries(INITIAL_DELIVERIES);
    setCompensations(INITIAL_COMPENSATIONS);
    setInventories(INITIAL_INVENTORIES);
    setPlanOrders(INITIAL_PLAN_ORDERS);
    setActualReceives(INITIAL_ACTUAL_RECEIVES);
    setProductionIssues(INITIAL_PRODUCTION_ISSUES);
    setProductionReports(INITIAL_PRODUCTION_REPORTS);
    setCustomCompensationRequests([]);
    setStockCompensations({});
    setFinishedGoodsDeliveries([]);
    setCompensationReceivedQuantities({});
    setCompensationStatusOverrides({});
    setSupplementalMaterialStock({});
    localStorage.clear();
    syncToApi('RESET_ALL');
  };

  // Filtered by Selected Customer
  const currentCustomerPOs = useMemo(
    () => purchaseOrders.filter((po) => po.customerId === selectedCustomerId),
    [purchaseOrders, selectedCustomerId]
  );

  const currentCustomerReceipts = useMemo(
    () => receipts.filter((r) => r.customerId === selectedCustomerId),
    [receipts, selectedCustomerId]
  );

  const currentCustomerDeliveries = useMemo(
    () => deliveries.filter((d) => d.customerId === selectedCustomerId),
    [deliveries, selectedCustomerId]
  );

  const currentCustomerCompensations = useMemo(
    () => compensations.filter((c) => c.customerId === selectedCustomerId),
    [compensations, selectedCustomerId]
  );

  // Tab 6: Bảng Thống Kê Tổng Hợp Nhập - Xuất - Tồn (N-X-T)
  const inventoryMovementData = useMemo<InventoryMovementRecord[]>(() => {
    const recordsMap: Record<string, InventoryMovementRecord> = {};

    // Gather distinct items by PO + Material Name + Size for this customer
    currentCustomerReceipts.forEach((r) => {
      const inRange = isDateInRange(r.receiptDate, startDate, endDate);
      const key = `${r.poId}_${r.originalName}_${r.size}`;
      const po = currentCustomerPOs.find((p) => p.id === r.poId);

      if (!recordsMap[key]) {
        recordsMap[key] = {
          id: key,
          poNumber: po?.poNumber || 'N/A',
          style: po?.style || 'N/A',
          originalName: r.originalName,
          vnName: r.vnName,
          unit: r.unit || 'đôi',
          size: r.size,
          openingStock: 0,
          inboundQty: 0,
          outboundBatch1: 0,
          outboundComp: 0,
          totalOutbound: 0,
          closingStock: 0,
          statusText: 'Đang theo dõi',
        };
      }

      if (inRange) {
        recordsMap[key].inboundQty += r.qtyActual;
      }
    });

    // Add outbound from deliveries
    currentCustomerDeliveries.forEach((d) => {
      const inRange = isDateInRange(d.deliveryDate, startDate, endDate);
      const matchedKey = Object.keys(recordsMap).find((k) => k.startsWith(`${d.poId}_`) && k.endsWith(`_${d.size}`));
      const targetKey = matchedKey || `${d.poId}_${d.originalName}_${d.size}`;

      if (recordsMap[targetKey]) {
        if (inRange) {
          recordsMap[targetKey].outboundBatch1 += d.qtyBatch1;
        }
      }
    });

    // Add outbound from compensations
    currentCustomerCompensations.forEach((c) => {
      const inRange = isDateInRange(c.requestDate, startDate, endDate);
      const matchedKey = Object.keys(recordsMap).find((k) => k.startsWith(`${c.poId}_`) && k.endsWith(`_${c.size}`));
      const targetKey = matchedKey || `${c.poId}_${c.originalName}_${c.size}`;

      if (recordsMap[targetKey]) {
        if (inRange) {
          recordsMap[targetKey].outboundComp += c.qtyCompensation;
        }
      }
    });

    // Compute totals & statuses
    return Object.values(recordsMap).map((item) => {
      const totalOut = item.outboundBatch1 + item.outboundComp;
      const closing = item.openingStock + item.inboundQty - totalOut;
      let statusText = 'Khả dụng';
      if (closing <= 0) {
        statusText = 'Đã hết vật tư';
      } else if (closing < 5) {
        statusText = 'Cảnh báo tồn thấp';
      }

      return {
        ...item,
        totalOutbound: totalOut,
        closingStock: closing,
        statusText,
      };
    });
  }, [
    currentCustomerReceipts,
    currentCustomerDeliveries,
    currentCustomerCompensations,
    currentCustomerPOs,
    startDate,
    endDate,
  ]);

  // Tab 7: Dashboard Báo Cáo Đối Soát Đơn Hàng
  const dashboardReportData = useMemo<DashboardReportItem[]>(() => {
    return currentCustomerPOs.map((po) => {
      const poReceipts = currentCustomerReceipts.filter((r) => r.poId === po.id);
      const poDeliveries = currentCustomerDeliveries.filter((d) => d.poId === po.id);
      const poComps = currentCustomerCompensations.filter((c) => c.poId === po.id);

      const primaryReceipt = poReceipts[0];
      const originalName = primaryReceipt?.originalName || 'Oxford Standard Item';
      const vnName = primaryReceipt?.vnName || 'Nguyên phụ liệu giày';
      const size = primaryReceipt?.size || '8';

      const totalDoc = poReceipts.reduce((sum, r) => sum + r.qtyDoc, 0);
      const totalActual = poReceipts.reduce((sum, r) => sum + r.qtyActual, 0);
      const totalBatch1 = poDeliveries.reduce((sum, d) => sum + d.qtyBatch1, 0);
      const totalComp = poComps.reduce((sum, c) => sum + c.qtyCompensation, 0);
      const totalDelivered = totalBatch1 + totalComp;
      const remainingStock = Math.max(0, totalActual - totalDelivered);

      const isCompleted = totalDelivered >= po.targetQty;

      return {
        poId: po.id,
        poNumber: po.poNumber,
        originalName,
        vnName,
        size,
        qtyDoc: totalDoc,
        qtyActual: totalActual,
        qtyBatch1: totalBatch1,
        qtyComp: totalComp,
        totalDelivered,
        remainingStock,
        status: isCompleted ? 'Hoàn thành' : 'Chưa hoàn thành đơn gốc',
      };
    });
  }, [currentCustomerPOs, currentCustomerReceipts, currentCustomerDeliveries, currentCustomerCompensations]);

  // ==========================================================================
  // PHÂN HỆ SRS: LỌC DỮ LIỆU CÔ LẬP THEO KHÁCH HÀNG (MULTI-TENANCY)
  // ==========================================================================
  const currentCustomerPlanOrders = useMemo(
    () => planOrders.filter((p) => p.customerId === selectedCustomerId),
    [planOrders, selectedCustomerId]
  );

  const currentCustomerActualReceives = useMemo(
    () => actualReceives.filter((a) => a.customerId === selectedCustomerId),
    [actualReceives, selectedCustomerId]
  );

  const currentCustomerProductionIssues = useMemo(
    () => productionIssues.filter((i) => i.customerId === selectedCustomerId),
    [productionIssues, selectedCustomerId]
  );

  const currentCustomerProductionReports = useMemo(
    () => productionReports.filter((r) => r.customerId === selectedCustomerId),
    [productionReports, selectedCustomerId]
  );

  const currentCustomerFinishedGoodsDeliveries = useMemo(
    () => finishedGoodsDeliveries.filter((d) => d.customerId === selectedCustomerId),
    [finishedGoodsDeliveries, selectedCustomerId]
  );

  // TAB 3: TỰ ĐỘNG TÍNH CHÊNH LỆCH = SỐ THỰC NHẬN (TAB 2) - SỐ TRÊN PHIẾU (TAB 1)
  const currentCustomerDiscrepancies: DiscrepancyRow[] = useMemo(() => {
    return currentCustomerPlanOrders.map((plan) => {
      const actual = currentCustomerActualReceives.find((a) => a.planOrderId === plan.id);
      const actualSizes = actual?.sizeQuantities || {};
      const planSizes = plan.sizeQuantities || {};

      const allSizes = Array.from(new Set([...Object.keys(planSizes), ...Object.keys(actualSizes)]));
      const diffSizes: Record<string, number> = {};
      let hasNeg = false;
      let totalActual = 0;

      allSizes.forEach((s) => {
        const pQty = Number(planSizes[s]) || 0;
        const aQty = Number(actualSizes[s]) || 0;
        const diff = aQty - pQty;
        diffSizes[s] = diff;
        totalActual += aQty;
        if (diff < 0) {
          hasNeg = true;
        }
      });

      const totalPlan = plan.totalQty;
      const totalDiff = totalActual - totalPlan;

      return {
        planOrderId: plan.id,
        customerId: plan.customerId,
        receiptDate: plan.receiptDate,
        poNumber: plan.poNumber,
        itemCode: plan.itemCode,
        voucherCode: plan.voucherCode,
        description: plan.description,
        unit: plan.unit,
        planSizes,
        actualSizes,
        diffSizes,
        totalPlan,
        totalActual,
        totalDiff,
        hasNegative: hasNeg || totalDiff < 0,
        needsCompensation: hasNeg || totalDiff < 0,
      };
    });
  }, [currentCustomerPlanOrders, currentCustomerActualReceives]);

  // TAB 4: NGUỒN DỮ LIỆU CẤP BÙ (GIAO THIẾU TỪ TAB 3 + HỎNG HẾT KHO TỪ TAB 7)
  const currentCustomerCompensationItems: CompensationRequestItem[] = useMemo(() => {
    const items: CompensationRequestItem[] = [];

    // Nguồn 1: Chênh lệch âm từ Tab 3
    currentCustomerDiscrepancies.forEach((disc) => {
      if (disc.hasNegative) {
        const missingSizes: Record<string, number> = {};
        let totalMissing = 0;
        Object.entries(disc.diffSizes).forEach(([size, diff]) => {
          if (diff < 0) {
            const absDiff = Math.abs(diff);
            missingSizes[size] = absDiff;
            totalMissing += absDiff;
          }
        });

        if (totalMissing > 0) {
          items.push({
            id: `comp-tab3-${disc.planOrderId}`,
            customerId: disc.customerId,
            source: 'DISCREPANCY_TAB3',
            sourceLabel: 'Giao thiếu (Tab 3)',
            poNumber: disc.poNumber,
            itemCode: disc.itemCode,
            voucherCode: disc.voucherCode,
            reason: `Khách hàng giao thiếu so với phiếu ${disc.voucherCode || ''}`,
            sizeQuantities: missingSizes,
            totalQty: totalMissing,
            requestDate: disc.receiptDate,
            status: 'Chờ gửi KH',
          });
        }
      }
    });

    // Nguồn 2: Sự cố hỏng hàng nhưng kho hết hàng từ Tab 7
    currentCustomerProductionReports.forEach((rep) => {
      const fromCust = rep.compensationFromCustomer || {};
      const missingSizes: Record<string, number> = {};
      let totalMissing = 0;
      Object.entries(fromCust).forEach(([s, q]) => {
        if (Number(q) > 0) {
          missingSizes[s] = Number(q);
          totalMissing += Number(q);
        }
      });

      if (totalMissing > 0) {
        items.push({
          id: `comp-tab7-${rep.id}`,
          customerId: rep.customerId,
          source: 'DAMAGE_OUT_OF_STOCK_TAB7',
          sourceLabel: 'Hỏng hết kho (Tab 7)',
          poNumber: rep.poNumber,
          itemCode: rep.itemCode,
          lineId: rep.lineId,
          reason: `Hư hỏng tại ${rep.lineId} - Kho hết tồn để bù`,
          sizeQuantities: missingSizes,
          totalQty: totalMissing,
          requestDate: rep.reportDate,
          status: 'Chờ gửi KH',
        });
      }
    });

    // Nguồn 3: Hàng hư hỏng phát sinh trong sản xuất (Tab 7)
    currentCustomerProductionReports.forEach((rep) => {
      const damaged = rep.damagedQuantities || {};
      const damagedSizes: Record<string, number> = {};
      let totalDamaged = 0;
      Object.entries(damaged).forEach(([s, q]) => {
        if (Number(q) > 0) {
          damagedSizes[s] = Number(q);
          totalDamaged += Number(q);
        }
      });

      const fromCust = rep.compensationFromCustomer || {};
      const hasFromCust = Object.values(fromCust).some((v) => Number(v) > 0);

      // Nếu có hư hỏng và chưa bị gom vào phiếu 'Hỏng hết kho'
      if (totalDamaged > 0 && !hasFromCust) {
        items.push({
          id: `comp-damage-${rep.id}`,
          customerId: rep.customerId,
          source: 'DAMAGED_GOODS',
          sourceLabel: 'Hàng hư hỏng',
          poNumber: rep.poNumber,
          itemCode: rep.itemCode,
          lineId: rep.lineId,
          reason: `Hàng hư hỏng trong quá trình sản xuất tại ${rep.lineId}`,
          sizeQuantities: damagedSizes,
          totalQty: totalDamaged,
          requestDate: rep.reportDate,
          status: 'Chờ gửi KH',
        });
      }
    });

    const customItems = customCompensationRequests.filter((c) => c.customerId === selectedCustomerId);
    const all = [...items, ...customItems];
    return all
      .filter((item) => !hiddenCompensationItemIds.includes(item.id))
      .map((item) => {
        const receivedQuantities = compensationReceivedQuantities[item.id] || {};
        const totalReceived = Object.values(receivedQuantities).reduce((s, v) => s + (Number(v) || 0), 0);
        const isFullyReceived = totalReceived >= item.totalQty && item.totalQty > 0;
        const currentStatus = compensationStatusOverrides[item.id] || (isFullyReceived ? 'Đã nhận bù' : item.status);

        return {
          ...item,
          requestDate: compensationDateOverrides[item.id] || item.requestDate,
          status: currentStatus,
          receivedQuantities,
          isFullyReceived,
        };
      });
  }, [
    currentCustomerDiscrepancies,
    currentCustomerProductionReports,
    customCompensationRequests,
    selectedCustomerId,
    hiddenCompensationItemIds,
    compensationDateOverrides,
    compensationReceivedQuantities,
    compensationStatusOverrides,
  ]);

  // TAB 6: TỒN KHO THỜI GIAN THỰC = THỰC NHẬN (TAB 2) - XUẤT SX (TAB 5) - XUẤT BÙ (TAB 7)
  const currentCustomerRealtimeStock: RealtimeStockItem[] = useMemo(() => {
    const groups: Record<
      string,
      {
        poNumber: string;
        itemCode: string;
        description: string;
        unit: string;
        received: Record<string, number>;
        issued: Record<string, number>;
        comp: Record<string, number>;
      }
    > = {};

    currentCustomerPlanOrders.forEach((plan) => {
      const key = `${plan.poNumber.trim().toUpperCase()}__${plan.itemCode.trim().toUpperCase()}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: plan.poNumber,
          itemCode: plan.itemCode,
          description: plan.description,
          unit: plan.unit,
          received: {},
          issued: {},
          comp: {},
        };
      }
    });

    // Cộng dồn toàn bộ các lượt nhận thực tế từ Tab 2 (kể cả nhiều ngày, nhiều lần, hàng đơn, hàng bù)
    currentCustomerActualReceives.forEach((act) => {
      const plan = currentCustomerPlanOrders.find((p) => p.id === act.planOrderId);
      const poNum = (act.poNumber || plan?.poNumber || '').trim().toUpperCase();
      const itemCd = (act.itemCode || plan?.itemCode || '').trim().toUpperCase();
      if (!poNum) return;
      const key = `${poNum}__${itemCd}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: poNum,
          itemCode: itemCd,
          description: act.description || plan?.description || `Vật tư ${itemCd}`,
          unit: act.unit || plan?.unit || 'PRS',
          received: {},
          issued: {},
          comp: {},
        };
      }
      Object.entries(act.sizeQuantities || {}).forEach(([s, q]) => {
        groups[key].received[s] = (groups[key].received[s] || 0) + (Number(q) || 0);
      });
    });

    currentCustomerProductionIssues.forEach((issue) => {
      const key = `${issue.poNumber.trim().toUpperCase()}__${issue.itemCode.trim().toUpperCase()}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: issue.poNumber,
          itemCode: issue.itemCode,
          description: 'Vật tư sản xuất',
          unit: issue.unit,
          received: {},
          issued: {},
          comp: {},
        };
      }
      Object.entries(issue.sizeQuantities || {}).forEach(([s, q]) => {
        groups[key].issued[s] = (groups[key].issued[s] || 0) + (Number(q) || 0);
      });
    });

    currentCustomerProductionReports.forEach((rep) => {
      const key = `${rep.poNumber.trim().toUpperCase()}__${rep.itemCode.trim().toUpperCase()}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: rep.poNumber,
          itemCode: rep.itemCode,
          description: 'Vật tư sản xuất',
          unit: rep.unit,
          received: {},
          issued: {},
          comp: {},
        };
      }
      Object.entries(rep.compensationFromStock || {}).forEach(([s, q]) => {
        groups[key].comp[s] = (groups[key].comp[s] || 0) + (Number(q) || 0);
      });
    });

    // Ghi nhận xuất bù nhập tay trực tiếp từ Tab 5
    Object.entries(stockCompensations).forEach(([key, sizeMap]) => {
      if (!groups[key]) {
        const plan = currentCustomerPlanOrders.find(
          (p) => `${p.poNumber.trim().toUpperCase()}__${p.itemCode.trim().toUpperCase()}` === key
        );
        if (plan) {
          groups[key] = {
            poNumber: plan.poNumber,
            itemCode: plan.itemCode,
            description: plan.description,
            unit: plan.unit,
            received: {},
            issued: {},
            comp: {},
          };
        }
      }
      if (groups[key]) {
        Object.entries(sizeMap).forEach(([s, q]) => {
          groups[key].comp[s] = (groups[key].comp[s] || 0) + (Number(q) || 0);
        });
      }
    });

    // Ghi nhận vật tư bổ sung bù từ khách hàng vào tồn kho
    Object.entries(supplementalMaterialStock).forEach(([key, sizeMap]) => {
      if (groups[key]) {
        Object.entries(sizeMap).forEach(([s, q]) => {
          groups[key].received[s] = (groups[key].received[s] || 0) + (Number(q) || 0);
        });
      }
    });

    return Object.entries(groups).map(([key, g]) => {
      const allSizes = Array.from(
        new Set([
          ...Object.keys(g.received),
          ...Object.keys(g.issued),
          ...Object.keys(g.comp),
        ])
      );

      const currentStockSizes: Record<string, number> = {};
      let totalReceived = 0;
      let totalProductionIssued = 0;
      let totalDamagedComp = 0;
      let totalCurrentStock = 0;

      allSizes.forEach((s) => {
        const r = g.received[s] || 0;
        const i = g.issued[s] || 0;
        const c = g.comp[s] || 0;
        const stock = r - i - c;

        currentStockSizes[s] = stock;
        totalReceived += r;
        totalProductionIssued += i;
        totalDamagedComp += c;
        totalCurrentStock += stock;
      });

      return {
        key,
        customerId: selectedCustomerId,
        poNumber: g.poNumber,
        itemCode: g.itemCode,
        description: g.description,
        unit: g.unit,
        receivedSizes: g.received,
        productionIssuedSizes: g.issued,
        damagedCompSizes: g.comp,
        currentStockSizes,
        totalReceived,
        totalProductionIssued,
        totalDamagedComp,
        totalCurrentStock,
      };
    });
  }, [
    currentCustomerPlanOrders,
    currentCustomerActualReceives,
    currentCustomerProductionIssues,
    currentCustomerProductionReports,
    stockCompensations,
    supplementalMaterialStock,
    selectedCustomerId,
  ]);

  // TAB 8: TỒN KHO THÀNH PHẨM (Tự động đọc từ Báo Cáo Nghiệm Thu Tab 7)
  const currentCustomerFinishedGoodsStock: FinishedGoodsStockItem[] = useMemo(() => {
    const groups: Record<
      string,
      {
        poNumber: string;
        itemCode: string;
        itemType?: 'Bán TP' | 'Thành Phẩm';
        materialName?: string;
        unit: string;
        inbound: Record<string, number>;
        delivered: Record<string, number>;
      }
    > = {};

    // 1. Tự động đọc dữ liệu nhập kho từ Tab 7 (completedQuantities của các chuyền 1, 2, 3...)
    currentCustomerProductionReports.forEach((rep) => {
      const key = `${rep.poNumber.trim().toUpperCase()}__${rep.itemCode.trim().toUpperCase()}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: rep.poNumber,
          itemCode: rep.itemCode,
          itemType: 'Thành Phẩm',
          materialName: rep.detailName || '',
          unit: rep.unit || 'PRS',
          inbound: {},
          delivered: {},
        };
      }
      Object.entries(rep.completedQuantities || {}).forEach(([s, q]) => {
        const num = Number(q) || 0;
        groups[key].inbound[s] = (groups[key].inbound[s] || 0) + num;
      });
    });

    // 2. Trừ sản lượng đã xuất giao thành phẩm cho khách hàng
    currentCustomerFinishedGoodsDeliveries.forEach((del) => {
      const key = `${del.poNumber.trim().toUpperCase()}__${del.itemCode.trim().toUpperCase()}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: del.poNumber,
          itemCode: del.itemCode,
          itemType: del.itemType || 'Thành Phẩm',
          materialName: del.materialName || '',
          unit: del.unit || 'PRS',
          inbound: {},
          delivered: {},
        };
      } else {
        if (del.itemType) groups[key].itemType = del.itemType;
        if (del.materialName) groups[key].materialName = del.materialName;
      }
      Object.entries(del.sizeQuantities || {}).forEach(([s, q]) => {
        const num = Number(q) || 0;
        groups[key].delivered[s] = (groups[key].delivered[s] || 0) + num;
      });
    });

    return Object.entries(groups).map(([key, g]) => {
      const allSizes = Array.from(new Set([...Object.keys(g.inbound), ...Object.keys(g.delivered)]));
      const stockSizes: Record<string, number> = {};
      let totalInbound = 0;
      let totalDelivered = 0;
      let totalStock = 0;

      allSizes.forEach((s) => {
        const inQ = g.inbound[s] || 0;
        const outQ = g.delivered[s] || 0;
        const st = inQ - outQ;
        stockSizes[s] = st;
        totalInbound += inQ;
        totalDelivered += outQ;
        totalStock += st;
      });

      return {
        key,
        customerId: selectedCustomerId,
        poNumber: g.poNumber,
        itemCode: g.itemCode,
        itemType: g.itemType,
        materialName: g.materialName,
        unit: g.unit,
        inboundSizes: g.inbound,
        totalInbound,
        deliveredSizes: g.delivered,
        totalDelivered,
        stockSizes,
        totalStock,
      };
    });
  }, [currentCustomerProductionReports, currentCustomerFinishedGoodsDeliveries, selectedCustomerId]);

  // Handlers SRS
  const addPlanOrder = (order: PlanOrderRow) => {
    setPlanOrders((prev) => [...prev, order]);
    syncToApi('SAVE_PLAN_ORDERS', [order]);
  };

  const addPlanOrders = (orders: PlanOrderRow[]) => {
    setPlanOrders((prev) => [...prev, ...orders]);
    syncToApi('SAVE_PLAN_ORDERS', orders);
  };

  const updatePlanOrder = (order: PlanOrderRow) => {
    setPlanOrders((prev) => prev.map((p) => (p.id === order.id ? order : p)));
    syncToApi('SAVE_PLAN_ORDERS', [order]);
  };

  const deletePlanOrder = (id: string) => {
    setPlanOrders((prev) => prev.filter((p) => p.id !== id));
    setActualReceives((prev) => prev.filter((a) => a.planOrderId !== id));
    syncToApi('DELETE_PLAN_ORDER', { id });
  };

  const saveActualReceive = (actual: ActualReceiveRow) => {
    setActualReceives((prev) => {
      const idx = prev.findIndex((a) => a.planOrderId === actual.planOrderId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = actual;
        return next;
      }
      return [...prev, actual];
    });
    syncToApi('SAVE_ACTUAL_RECEIVES', [actual]);
  };

  const saveActualReceives = (actuals: ActualReceiveRow[]) => {
    setActualReceives((prev) => {
      const map = new Map(prev.map((a) => [a.planOrderId, a]));
      actuals.forEach((act) => {
        map.set(act.planOrderId, act);
      });
      return Array.from(map.values());
    });
    syncToApi('SAVE_ACTUAL_RECEIVES', actuals);
  };

  const addProductionIssue = (issue: ProductionIssueRow) => {
    setProductionIssues((prev) => [...prev, issue]);
    syncToApi('SAVE_PRODUCTION_ISSUES', [issue]);
  };

  const addProductionIssues = (issues: ProductionIssueRow[]) => {
    setProductionIssues((prev) => [...prev, ...issues]);
    syncToApi('SAVE_PRODUCTION_ISSUES', issues);
  };

  const deleteProductionIssue = (id: string) => {
    setProductionIssues((prev) => prev.filter((i) => i.id !== id));
    syncToApi('DELETE_PRODUCTION_ISSUE', { id });
  };

  const updateProductionIssue = (issue: ProductionIssueRow) => {
    setProductionIssues((prev) => prev.map((i) => (i.id === issue.id ? issue : i)));
    syncToApi('SAVE_PRODUCTION_ISSUES', [issue]);
  };

  const addProductionReport = (report: ProductionReportRow) => {
    setProductionReports((prev) => [...prev, report]);
    syncToApi('SAVE_PRODUCTION_REPORT', report);
  };

  const updateProductionReport = (report: ProductionReportRow) => {
    setProductionReports((prev) => prev.map((r) => (r.id === report.id ? report : r)));
    syncToApi('SAVE_PRODUCTION_REPORT', report);
  };

  const deleteProductionReport = (id: string) => {
    setProductionReports((prev) => prev.filter((r) => r.id !== id));
    syncToApi('DELETE_PRODUCTION_REPORT', { id });
  };

  const resetActualReceive = (planOrderId: string) => {
    setActualReceives((prev) => prev.filter((a) => a.planOrderId !== planOrderId));
    syncToApi('DELETE_ACTUAL_RECEIVE', { planOrderId });
  };

  const updateCompensationRequestStatus = (
    id: string,
    status: CompensationRequestItem['status']
  ) => {
    setCustomCompensationRequests((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    syncToApi('UPDATE_COMPENSATION_STATUS', { id, status });
  };

  const updateCompensationRequestDate = (id: string, requestDate: string) => {
    setCompensationDateOverrides((prev) => ({ ...prev, [id]: requestDate }));
    setCustomCompensationRequests((prev) =>
      prev.map((c) => (c.id === id ? { ...c, requestDate } : c))
    );
    syncToApi('UPDATE_COMPENSATION_DATE', { id, requestDate });
  };

  const updateCompensationRequest = (item: CompensationRequestItem) => {
    setCustomCompensationRequests((prev) => {
      const exists = prev.some((c) => c.id === item.id);
      if (exists) {
        return prev.map((c) => (c.id === item.id ? item : c));
      } else {
        return [item, ...prev];
      }
    });
    if (item.requestDate) {
      setCompensationDateOverrides((prev) => ({ ...prev, [item.id]: item.requestDate }));
    }
    syncToApi('SAVE_COMPENSATION_REQUESTS', [item]);
  };

  const addCompensationRequest = (item: CompensationRequestItem) => {
    setCustomCompensationRequests((prev) => [item, ...prev]);
    syncToApi('SAVE_COMPENSATION_REQUESTS', [item]);
  };

  const deleteCompensationRequest = (id: string) => {
    setCustomCompensationRequests((prev) => prev.filter((c) => c.id !== id));
    setHiddenCompensationItemIds((prev) => [...prev, id]);
    syncToApi('DELETE_COMPENSATION_REQUEST', { id });
  };

  const updateStockCompensation = (
    poNumber: string,
    itemCode: string,
    size: string,
    qty: number | ''
  ) => {
    const key = `${poNumber.trim().toUpperCase()}__${itemCode.trim().toUpperCase()}`;
    const num = qty === '' ? 0 : Math.max(0, Number(qty) || 0);
    setStockCompensations((prev) => {
      const prevMap = prev[key] || {};
      const newMap = { ...prevMap, [size]: num };
      if (num === 0) {
        delete newMap[size];
      }
      const updated = {
        ...prev,
        [key]: newMap,
      };
      syncToApi('SAVE_STOCK_COMPENSATIONS', updated);
      return updated;
    });
  };

  // NHẬN VẬT TƯ GIAO BÙ: Ghi nhận số bù theo Size và tự động cập nhật Tab 2 & Tồn kho
  const receiveCompensationItem = (
    item: CompensationRequestItem,
    receivedQuantities: Record<string, number>,
    receivedDate?: string
  ) => {
    const cleanDate = receivedDate || new Date().toLocaleDateString('vi-VN');

    // Lưu lịch sử số lượng nhận bù cho item này
    setCompensationReceivedQuantities((prev) => ({
      ...prev,
      [item.id]: receivedQuantities,
    }));
    setCompensationStatusOverrides((prev) => ({
      ...prev,
      [item.id]: 'Đã nhận bù',
    }));

    // Trường hợp 1: Hàng giao thiếu ban đầu (Nguồn Tab 3)
    // Tự động cộng dồn số lượng nhận bù vào Số Thực Nhận (Tab 2) của đơn hàng đó
    if (item.source === 'DISCREPANCY_TAB3') {
      const planOrderId = item.id.startsWith('comp-tab3-')
        ? item.id.replace('comp-tab3-', '')
        : currentCustomerPlanOrders.find(
            (p) =>
              p.poNumber.toUpperCase() === item.poNumber.toUpperCase() &&
              p.itemCode.toUpperCase() === item.itemCode.toUpperCase()
          )?.id;

      if (planOrderId) {
        setActualReceives((prev) => {
          const existing = prev.find((a) => a.planOrderId === planOrderId);
          const currentSizes = { ...(existing?.sizeQuantities || {}) };

          // Cộng dồn số lượng nhận bù vào từng size của Tab 2
          Object.entries(receivedQuantities).forEach(([s, q]) => {
            currentSizes[s] = (Number(currentSizes[s]) || 0) + (Number(q) || 0);
          });

          const totalQty = Object.values(currentSizes).reduce((acc, v) => acc + (Number(v) || 0), 0);

          const updatedActual: ActualReceiveRow = {
            id: existing?.id || `act-${Date.now()}`,
            planOrderId,
            customerId: item.customerId,
            sizeQuantities: currentSizes,
            totalQty,
            note: existing?.note
              ? `${existing.note} (Đã nhận bù đợt 2: ${cleanDate})`
              : `Nhận bù đợt 2: ${cleanDate}`,
            updatedAt: cleanDate,
          };

          const idx = prev.findIndex((a) => a.planOrderId === planOrderId);
          const next = idx >= 0 ? prev.map((a, i) => (i === idx ? updatedActual : a)) : [updatedActual, ...prev];
          syncToApi('SAVE_ACTUAL_RECEIVES', [updatedActual]);
          return next;
        });
      }
    } else {
      // Trường hợp 2: Hàng hỏng hết kho từ Chuyền (Tab 7 hoặc Hàng hư hỏng)
      // Tự động nạp vật tư bổ sung vào kho vật tư để Chuyền tiếp tục sản xuất
      const stockKey = `${item.poNumber.trim().toUpperCase()}__${item.itemCode.trim().toUpperCase()}`;
      setSupplementalMaterialStock((prev) => {
        const prevSizes = { ...(prev[stockKey] || {}) };
        Object.entries(receivedQuantities).forEach(([s, q]) => {
          prevSizes[s] = (Number(prevSizes[s]) || 0) + (Number(q) || 0);
        });
        const updated = {
          ...prev,
          [stockKey]: prevSizes,
        };
        syncToApi('SAVE_SUPPLEMENTAL_STOCK', updated);
        return updated;
      });
    }

    syncToApi('RECEIVE_COMPENSATION', {
      itemId: item.id,
      receivedQuantities,
      receivedDate: cleanDate,
    });
  };

  const resetCompensationReceive = (itemId: string) => {
    setCompensationReceivedQuantities((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setCompensationStatusOverrides((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // PHÂN HỆ THÀNH PHẨM (FINISHED GOODS) HANDLERS
  const addFinishedGoodsDelivery = (delivery: FinishedGoodsDeliveryRow) => {
    setFinishedGoodsDeliveries((prev) => [...prev, delivery]);
    syncToApi('SAVE_FINISHED_GOODS_DELIVERY', delivery);
  };

  const updateFinishedGoodsDelivery = (delivery: FinishedGoodsDeliveryRow) => {
    setFinishedGoodsDeliveries((prev) =>
      prev.map((d) => (d.id === delivery.id ? delivery : d))
    );
    syncToApi('SAVE_FINISHED_GOODS_DELIVERY', delivery);
  };

  const deleteFinishedGoodsDelivery = (id: string) => {
    setFinishedGoodsDeliveries((prev) => prev.filter((d) => d.id !== id));
    syncToApi('DELETE_FINISHED_GOODS_DELIVERY', { id });
  };

  return (
    <InventoryContext.Provider
      value={{
        customers,
        selectedCustomerId,
        setSelectedCustomerId,
        currentCustomer,
        activeSizeRun,
        setActiveSizeRun,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        updateCustomerSizeRuns,
        deleteSizeRun,
        purchaseOrders,
        addPurchaseOrder,
        updatePurchaseOrder,
        deletePurchaseOrder,
        savePurchaseOrders,
        receipts,
        addReceipt,
        updateReceipt,
        deleteReceipt,
        deliveries,
        addDelivery,
        updateDelivery,
        deleteDelivery,
        compensations,
        addCompensation,
        updateCompensation,
        updateCompensationStatus,
        deleteCompensation,
        inventories,
        updateInventoryActual,
        addInventoryItem,
        deleteInventoryItem,
        startDate,
        endDate,
        setStartDate,
        setEndDate,
        currentCustomerPOs,
        currentCustomerReceipts,
        currentCustomerDeliveries,
        currentCustomerCompensations,
        inventoryMovementData,
        dashboardReportData,

        // SRS exports
        planOrders,
        actualReceives,
        productionIssues,
        productionReports,
        compensationRequests: customCompensationRequests,
        currentCustomerPlanOrders,
        currentCustomerActualReceives,
        currentCustomerProductionIssues,
        currentCustomerProductionReports,
        currentCustomerDiscrepancies,
        currentCustomerCompensationItems,
        currentCustomerRealtimeStock,
        stockCompensations,
        updateStockCompensation,
        addPlanOrder,
        addPlanOrders,
        updatePlanOrder,
        deletePlanOrder,
        saveActualReceive,
        saveActualReceives,
        addProductionIssue,
        addProductionIssues,
        deleteProductionIssue,
        updateProductionIssue,
        addProductionReport,
        updateProductionReport,
        deleteProductionReport,
        resetActualReceive,
        updateCompensationRequestStatus,
        updateCompensationRequestDate,
        updateCompensationRequest,
        addCompensationRequest,
        deleteCompensationRequest,

        // Finished Goods
        finishedGoodsDeliveries,
        currentCustomerFinishedGoodsDeliveries,
        currentCustomerFinishedGoodsStock,
        addFinishedGoodsDelivery,
        updateFinishedGoodsDelivery,
        deleteFinishedGoodsDelivery,

        // Compensation receiving
        receiveCompensationItem,
        resetCompensationReceive,

        resetAllData,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
