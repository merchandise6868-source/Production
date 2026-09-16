import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
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
  GeneralInboundSlip,
  GeneralOutboundSlip,
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
  INITIAL_GENERAL_INBOUND_SLIPS,
  INITIAL_GENERAL_OUTBOUND_SLIPS,
} from '../data/initialData';
import { isDateInRange } from '../utils/dateUtils';
import { buildCompanySheetsPayload, sendCompanyBackupToGoogleSheets } from '../utils/googleSheetsSync';

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
  inventoryMovementData: InventoryMovementRecord[];

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
  deleteActualReceive: (idOrPlanOrderId: string) => void;
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

  // GOOGLE SHEETS BACKUP
  googleSheetsWebhookUrl: string;
  setGoogleSheetsWebhookUrl: (url: string) => void;
  updateCustomerBackupInfo: (customerId: string, sheetUrl: string, timestamp: string) => void;

  // XÁC THỰC & GHI NHỚ THIẾT BỊ MÁY
  isAuthenticated: boolean;
  currentUser: string | null;
  login: (username: string) => void;
  logout: () => void;

  // TỰ ĐỘNG SAO LƯU 11:00 & 16:30
  isAutoBackupEnabled: boolean;
  setIsAutoBackupEnabled: (enabled: boolean) => void;
  lastAutoBackupTime: string | null;

  // PHÂN HỆ KHO CHUNG (NỘI BỘ D&D)
  generalInboundSlips: GeneralInboundSlip[];
  saveGeneralInboundSlip: (slip: GeneralInboundSlip) => void;
  deleteGeneralInboundSlip: (id: string) => void;
  generalOutboundSlips: GeneralOutboundSlip[];
  saveGeneralOutboundSlip: (slip: GeneralOutboundSlip) => void;
  deleteGeneralOutboundSlip: (id: string) => void;

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

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const loaded = loadStored<Customer[]>('customers', INITIAL_CUSTOMERS);
    const hasChung = loaded.some((c) => c.id === 'cust-chung');
    if (!hasChung) {
      const chungCust = INITIAL_CUSTOMERS.find((c) => c.id === 'cust-chung');
      if (chungCust) {
        return [...loaded, chungCust];
      }
    }
    return loaded;
  });
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

  // PHÂN HỆ KHO CHUNG (NỘI BỘ D&D)
  const [generalInboundSlips, setGeneralInboundSlips] = useState<GeneralInboundSlip[]>(() =>
    loadStored('general_inbound_slips', INITIAL_GENERAL_INBOUND_SLIPS)
  );
  const [generalOutboundSlips, setGeneralOutboundSlips] = useState<GeneralOutboundSlip[]>(() =>
    loadStored('general_outbound_slips', INITIAL_GENERAL_OUTBOUND_SLIPS)
  );

  // Google Sheets Backup Webhook URL state
  const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzWeoJsZGy7NgtENaZIXcMq1t00C6kYwI39M9AJvzsiu8IF0ZcNXnakMznRXr-XXx9_/exec';
  const [googleSheetsWebhookUrl, setGoogleSheetsWebhookUrlState] = useState<string>(() => {
    const stored = loadStored<string>('googleSheetsWebhookUrl', '');
    return stored && typeof stored === 'string' && stored.trim().length > 0 ? stored : DEFAULT_WEBHOOK_URL;
  });

  const setGoogleSheetsWebhookUrl = (url: string) => {
    setGoogleSheetsWebhookUrlState(url);
    localStorage.setItem('dd_inventory_googleSheetsWebhookUrl', JSON.stringify(url));
  };

  const updateCustomerBackupInfo = (customerId: string, sheetUrl: string, timestamp: string) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? { ...c, googleSheetUrl: sheetUrl, lastBackupAt: timestamp }
          : c
      )
    );
  };

  // ==========================================================================
  // XÁC THỰC NGƯỜI DÙNG & GHI NHỚ THIẾT BỊ MÁY
  // ==========================================================================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedSession = localStorage.getItem('DD_INVENTORY_AUTH_SESSION');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed?.username === 'tienkyosx') return true;
      }
      const sessionUser = sessionStorage.getItem('DD_INVENTORY_SESSION_USER');
      if (sessionUser === 'tienkyosx') return true;
    } catch {
      // Fallback
    }
    return false;
  });

  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    try {
      const savedSession = localStorage.getItem('DD_INVENTORY_AUTH_SESSION');
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        if (parsed?.username) return parsed.username;
      }
      return sessionStorage.getItem('DD_INVENTORY_SESSION_USER');
    } catch {
      return null;
    }
  });

  const login = (user: string) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem('DD_INVENTORY_AUTH_SESSION');
    sessionStorage.removeItem('DD_INVENTORY_SESSION_USER');
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // ==========================================================================
  // TỰ ĐỘNG SAO LƯU LÚC 11:00 TRƯA & 16:30 CHIỀU MỖI NGÀY
  // ==========================================================================
  const [isAutoBackupEnabled, setIsAutoBackupEnabledState] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('DD_AUTO_BACKUP_ENABLED');
      return val !== null ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  });

  const setIsAutoBackupEnabled = (enabled: boolean) => {
    setIsAutoBackupEnabledState(enabled);
    localStorage.setItem('DD_AUTO_BACKUP_ENABLED', JSON.stringify(enabled));
  };

  const [lastAutoBackupTime, setLastAutoBackupTime] = useState<string | null>(() => {
    return localStorage.getItem('DD_LAST_AUTO_BACKUP_TIME');
  });

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
  useEffect(() => {
    localStorage.setItem('dd_inventory_general_inbound_slips', JSON.stringify(generalInboundSlips));
  }, [generalInboundSlips]);
  useEffect(() => {
    localStorage.setItem('dd_inventory_general_outbound_slips', JSON.stringify(generalOutboundSlips));
  }, [generalOutboundSlips]);

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

        // Database đã có dữ liệu -> Cập nhật vào state có hợp nhất an toàn với trạng thái đã lưu trên máy
        if (data.customers && data.customers.length > 0) {
          const chungCust = INITIAL_CUSTOMERS.find((c) => c.id === 'cust-chung');
          const hasChung = data.customers.some((c: Customer) => c.id === 'cust-chung');
          if (!hasChung && chungCust) {
            setCustomers([...data.customers, chungCust]);
          } else {
            setCustomers(data.customers);
          }
        }
        if (data.planOrders) {
          setPlanOrders((prev) => {
            const prevMap = new Map(prev.map((p) => [p.id, p]));
            return data.planOrders.map((p: PlanOrderRow) => {
              const local = prevMap.get(p.id);
              return {
                ...p,
                status: p.status || local?.status || 'Hàng đơn',
                note: p.note !== undefined ? p.note : (local?.note || ''),
              };
            });
          });
        }
        if (data.actualReceives) {
          setActualReceives((prev) => {
            const prevMap = new Map(prev.map((a) => [a.planOrderId || a.id, a]));
            return data.actualReceives.map((a: ActualReceiveRow) => {
              const local = prevMap.get(a.planOrderId || a.id);
              return {
                ...a,
                status: a.status || local?.status || 'Hàng đơn',
                poNumber: a.poNumber || local?.poNumber || '',
                itemCode: a.itemCode || local?.itemCode || '',
                receiptDate: a.receiptDate || local?.receiptDate || '',
                voucherCode: a.voucherCode || local?.voucherCode || '',
                description: a.description || local?.description || '',
                unit: a.unit || local?.unit || 'PRS',
                note: a.note !== undefined ? a.note : (local?.note || ''),
              };
            });
          });
        }
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
    setGeneralInboundSlips(INITIAL_GENERAL_INBOUND_SLIPS);
    setGeneralOutboundSlips(INITIAL_GENERAL_OUTBOUND_SLIPS);
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

  // TAB 3: TỰ ĐỘNG TÍNH CHÊNH LỆCH = TỔNG THỰC NHẬN LŨY KẾ (TAB 2) - KẾ HOẠCH ĐƠN GỐC (TAB 1)
  // GROUP BY THEO MÃ PO (PO LÀ KHÓA CHÍNH DUY NHẤT)
  const currentCustomerDiscrepancies: DiscrepancyRow[] = useMemo(() => {
    // 1. Thu thập toàn bộ danh sách PO duy nhất từ Tab 1 (Kế hoạch) và Tab 2 (Thực nhận)
    const allPoNumbers = Array.from(
      new Set([
        ...currentCustomerPlanOrders.map((p) => (p.poNumber || '').trim().toUpperCase()),
        ...currentCustomerActualReceives.map((a) => (a.poNumber || '').trim().toUpperCase()),
      ])
    ).filter(Boolean);

    return allPoNumbers.map((poNum) => {
      // Gom tất cả dòng kế hoạch Tab 1 của PO này
      const matchingPlans = currentCustomerPlanOrders.filter(
        (p) => (p.poNumber || '').trim().toUpperCase() === poNum
      );
      // Gom tất cả dòng thực nhận Tab 2 của PO này
      const matchingPlanIds = new Set(matchingPlans.map((p) => p.id));
      const matchingActuals = currentCustomerActualReceives.filter(
        (a) =>
          (a.poNumber || '').trim().toUpperCase() === poNum ||
          (a.planOrderId && matchingPlanIds.has(a.planOrderId))
      );

      // Phân tách giữa Hàng đơn gốc và Hàng giao bù:
      // A. Tab 1: Kế hoạch đơn gốc (Mục tiêu của PO cần nhận đủ)
      const originalPlans = matchingPlans.filter((p) => (p.status || 'Hàng đơn') !== 'Hàng bù');
      const compPlans = matchingPlans.filter((p) => p.status === 'Hàng bù');

      // B. Tab 2: Thực nhận đơn gốc & Thực nhận hàng bù
      const originalActuals = matchingActuals.filter((a) => (a.status || 'Hàng đơn') !== 'Hàng bù');
      const compActuals = matchingActuals.filter((a) => a.status === 'Hàng bù');

      // 1. Tổng hợp size kế hoạch GỐC (Chỉ lấy các dòng Hàng đơn)
      const planSizes: Record<string, number> = {};
      let totalPlan = 0;
      originalPlans.forEach((plan) => {
        Object.entries(plan.sizeQuantities || {}).forEach(([s, q]) => {
          const num = Number(q) || 0;
          planSizes[s] = (planSizes[s] || 0) + num;
          totalPlan += num;
        });
      });
      if (totalPlan === 0 && originalPlans.length > 0) {
        totalPlan = originalPlans.reduce((sum, p) => sum + (Number(p.totalQty) || 0), 0);
      }

      // 2. Tổng hợp size phiếu bù (Tab 1 Hàng bù)
      let compensationPlanQty = 0;
      compPlans.forEach((plan) => {
        Object.entries(plan.sizeQuantities || {}).forEach(([, q]) => {
          compensationPlanQty += Number(q) || 0;
        });
      });
      if (compensationPlanQty === 0 && compPlans.length > 0) {
        compensationPlanQty = compPlans.reduce((sum, p) => sum + (Number(p.totalQty) || 0), 0);
      }

      // 3. Tổng hợp size thực nhận GỐC (Tab 2 Hàng đơn)
      let originalActualQty = 0;
      originalActuals.forEach((actual) => {
        Object.entries(actual.sizeQuantities || {}).forEach(([, q]) => {
          originalActualQty += Number(q) || 0;
        });
      });
      if (originalActualQty === 0 && originalActuals.length > 0) {
        originalActualQty = originalActuals.reduce((sum, a) => sum + (Number(a.totalQty) || 0), 0);
      }

      // 4. Tổng hợp size thực nhận BÙ (Tab 2 Hàng bù)
      let compensationActualQty = 0;
      compActuals.forEach((actual) => {
        Object.entries(actual.sizeQuantities || {}).forEach(([, q]) => {
          compensationActualQty += Number(q) || 0;
        });
      });
      if (compensationActualQty === 0 && compActuals.length > 0) {
        compensationActualQty = compActuals.reduce((sum, a) => sum + (Number(a.totalQty) || 0), 0);
      }

      // 5. TỔNG THỰC NHẬN LŨY KẾ = Thực nhận gốc + Thực nhận hàng bù
      const actualSizes: Record<string, number> = {};
      matchingActuals.forEach((actual) => {
        Object.entries(actual.sizeQuantities || {}).forEach(([s, q]) => {
          const num = Number(q) || 0;
          actualSizes[s] = (actualSizes[s] || 0) + num;
        });
      });
      let totalActual = matchingActuals.reduce((sum, a) => {
        const sqTot = Object.values(a.sizeQuantities || {}).reduce((s, v) => s + (Number(v) || 0), 0);
        return sum + (sqTot > 0 ? sqTot : Number(a.totalQty) || 0);
      }, 0);

      // Tập hợp tất cả các size xuất hiện
      const allSizes = Array.from(
        new Set([...Object.keys(planSizes), ...Object.keys(actualSizes)])
      );

      // 6. Tính chênh lệch từng Size = Thực nhận lũy kế (Size) - Kế hoạch gốc (Size)
      const diffSizes: Record<string, number> = {};
      let hasNeg = false;

      allSizes.forEach((s) => {
        const pQty = planSizes[s] || 0;
        const aQty = actualSizes[s] || 0;
        const diff = aQty - pQty;
        diffSizes[s] = diff;
        if (diff < 0) {
          hasNeg = true;
        }
      });

      const totalDiff = totalActual - totalPlan;
      if (totalDiff < 0) {
        hasNeg = true;
      }

      let statusText: 'Khớp đủ' | 'Thiếu cần bù' | 'Giao thừa' = 'Khớp đủ';
      if (hasNeg) {
        statusText = 'Thiếu cần bù';
      } else if (totalDiff > 0) {
        statusText = 'Giao thừa';
      } else {
        statusText = 'Khớp đủ';
      }

      const firstPlan = matchingPlans[0];
      const firstActual = matchingActuals[0];

      const voucherCodes = Array.from(
        new Set(
          [
            ...matchingPlans.map((p) => p.voucherCode),
            ...matchingActuals.map((a) => a.voucherCode),
          ].filter(Boolean)
        )
      ).join(', ');

      return {
        planOrderId: firstPlan?.id || `po-${poNum}`,
        customerId: firstPlan?.customerId || firstActual?.customerId || selectedCustomerId || '',
        receiptDate: firstPlan?.receiptDate || firstActual?.receiptDate || '',
        poNumber: poNum,
        itemCode: firstPlan?.itemCode || firstActual?.itemCode || '',
        voucherCode: voucherCodes,
        description: firstPlan?.description || firstActual?.description || `Vật tư PO ${poNum}`,
        unit: firstPlan?.unit || firstActual?.unit || 'PRS',
        planSizes,
        actualSizes,
        diffSizes,
        totalPlan,
        totalActual,
        totalDiff,
        hasNegative: hasNeg,
        needsCompensation: hasNeg,
        originalPlanQty: totalPlan,
        compensationPlanQty,
        originalActualQty,
        compensationActualQty,
        statusText,
        matchingPlans,
        matchingActuals,
      };
    });
  }, [currentCustomerPlanOrders, currentCustomerActualReceives, selectedCustomerId]);

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
      const poNum = plan.poNumber.trim().toUpperCase();
      if (!poNum) return;
      if (!groups[poNum]) {
        groups[poNum] = {
          poNumber: poNum,
          itemCode: plan.itemCode,
          description: plan.description,
          unit: plan.unit,
          received: {},
          issued: {},
          comp: {},
        };
      } else {
        if (!groups[poNum].itemCode && plan.itemCode) groups[poNum].itemCode = plan.itemCode;
        if (!groups[poNum].description && plan.description) groups[poNum].description = plan.description;
      }
    });

    // Cộng dồn toàn bộ các lượt nhận thực tế từ Tab 2 (kể cả nhiều ngày, nhiều lần, hàng đơn, hàng bù)
    currentCustomerActualReceives.forEach((act) => {
      const plan = currentCustomerPlanOrders.find((p) => p.id === act.planOrderId);
      const poNum = (act.poNumber || plan?.poNumber || '').trim().toUpperCase();
      const itemCd = (act.itemCode || plan?.itemCode || '').trim().toUpperCase();
      if (!poNum) return;
      if (!groups[poNum]) {
        groups[poNum] = {
          poNumber: poNum,
          itemCode: itemCd,
          description: act.description || plan?.description || `Vật tư ${itemCd}`,
          unit: act.unit || plan?.unit || 'PRS',
          received: {},
          issued: {},
          comp: {},
        };
      } else {
        if (!groups[poNum].itemCode && itemCd) groups[poNum].itemCode = itemCd;
      }
      Object.entries(act.sizeQuantities || {}).forEach(([s, q]) => {
        groups[poNum].received[s] = (groups[poNum].received[s] || 0) + (Number(q) || 0);
      });
    });

    currentCustomerProductionIssues.forEach((issue) => {
      const poNum = issue.poNumber.trim().toUpperCase();
      if (!poNum) return;
      if (!groups[poNum]) {
        groups[poNum] = {
          poNumber: poNum,
          itemCode: issue.itemCode,
          description: 'Vật tư sản xuất',
          unit: issue.unit,
          received: {},
          issued: {},
          comp: {},
        };
      }
      Object.entries(issue.sizeQuantities || {}).forEach(([s, q]) => {
        groups[poNum].issued[s] = (groups[poNum].issued[s] || 0) + (Number(q) || 0);
      });
    });

    currentCustomerProductionReports.forEach((rep) => {
      const poNum = rep.poNumber.trim().toUpperCase();
      if (!poNum) return;
      if (!groups[poNum]) {
        groups[poNum] = {
          poNumber: poNum,
          itemCode: rep.itemCode,
          description: 'Vật tư sản xuất',
          unit: rep.unit,
          received: {},
          issued: {},
          comp: {},
        };
      }
      Object.entries(rep.compensationFromStock || {}).forEach(([s, q]) => {
        groups[poNum].comp[s] = (groups[poNum].comp[s] || 0) + (Number(q) || 0);
      });
    });

    // Ghi nhận xuất bù nhập tay trực tiếp từ Tab 6
    Object.entries(stockCompensations).forEach(([k, sizeMap]) => {
      const poNum = (k.includes('__') ? k.split('__')[0] : k).trim().toUpperCase();
      if (!groups[poNum]) {
        const plan = currentCustomerPlanOrders.find(
          (p) => p.poNumber.trim().toUpperCase() === poNum
        );
        groups[poNum] = {
          poNumber: poNum,
          itemCode: plan?.itemCode || '',
          description: plan?.description || 'Vật tư sản xuất',
          unit: plan?.unit || 'PRS',
          received: {},
          issued: {},
          comp: {},
        };
      }
      if (groups[poNum]) {
        Object.entries(sizeMap).forEach(([s, q]) => {
          groups[poNum].comp[s] = (groups[poNum].comp[s] || 0) + (Number(q) || 0);
        });
      }
    });

    // Ghi nhận vật tư bổ sung bù từ khách hàng vào tồn kho
    Object.entries(supplementalMaterialStock).forEach(([k, sizeMap]) => {
      const poNum = (k.includes('__') ? k.split('__')[0] : k).trim().toUpperCase();
      if (groups[poNum]) {
        Object.entries(sizeMap).forEach(([s, q]) => {
          groups[poNum].received[s] = (groups[poNum].received[s] || 0) + (Number(q) || 0);
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

    // 0. Luôn khởi tạo sẵn dòng cho mọi mã PO từ Đơn hàng Tab 1 để Tab 8 luôn có sẵn dòng nhập xuất thành phẩm
    currentCustomerPlanOrders.forEach((plan) => {
      const key = `${plan.poNumber.trim().toUpperCase()}__${plan.itemCode.trim().toUpperCase()}`;
      if (!groups[key]) {
        groups[key] = {
          poNumber: plan.poNumber,
          itemCode: plan.itemCode,
          itemType: 'Thành Phẩm',
          materialName: plan.description || '',
          unit: plan.unit || 'PRS',
          inbound: {},
          delivered: {},
        };
      }
    });

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
  }, [currentCustomerPlanOrders, currentCustomerProductionReports, currentCustomerFinishedGoodsDeliveries, selectedCustomerId]);

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
    // Đồng bộ tức thời và chính xác sang actualReceives (giữ nguyên id của bản ghi thực nhận nếu đã có)
    setActualReceives((prev) =>
      prev.map((a) =>
        a.planOrderId === order.id || a.id === order.id
          ? {
              ...a,
              poNumber: order.poNumber,
              itemCode: order.itemCode,
              receiptDate: order.receiptDate,
              voucherCode: order.voucherCode,
              description: order.description,
              unit: order.unit,
              status: order.status || a.status || 'Hàng đơn',
            }
          : a
      )
    );
    syncToApi('SAVE_PLAN_ORDERS', [order]);
  };

  const deletePlanOrder = (id: string) => {
    setPlanOrders((prev) => prev.filter((p) => p.id !== id));
    setActualReceives((prev) => prev.filter((a) => a.planOrderId !== id && a.id !== id));
    syncToApi('DELETE_PLAN_ORDER', { id });
  };

  const saveActualReceive = (actual: ActualReceiveRow) => {
    const key = actual.planOrderId || actual.id;
    setActualReceives((prev) => {
      const idx = prev.findIndex((a) => (a.planOrderId || a.id) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...prev[idx],
          ...actual,
          id: prev[idx].id || actual.id,
          planOrderId: actual.planOrderId || prev[idx].planOrderId || prev[idx].id,
        };
        return next;
      }
      return [...prev, actual];
    });

    // Đồng bộ ngược lại sang planOrders nếu có mã kế hoạch tương ứng
    if (actual.planOrderId) {
      setPlanOrders((prev) =>
        prev.map((p) =>
          p.id === actual.planOrderId
            ? {
                ...p,
                status: actual.status || p.status || 'Hàng đơn',
                poNumber: actual.poNumber || p.poNumber,
                itemCode: actual.itemCode || p.itemCode,
                receiptDate: actual.receiptDate || p.receiptDate,
                voucherCode: actual.voucherCode !== undefined ? actual.voucherCode : p.voucherCode,
                description: actual.description || p.description,
                unit: actual.unit || p.unit,
              }
            : p
        )
      );
    }
    syncToApi('SAVE_ACTUAL_RECEIVES', [actual]);
  };

  const saveActualReceives = (actuals: ActualReceiveRow[]) => {
    setActualReceives((prev) => {
      const map = new Map<string, ActualReceiveRow>();
      // Nạp danh sách hiện có, ưu tiên key là planOrderId nếu có
      prev.forEach((a) => {
        const k = a.planOrderId ? `plan_${a.planOrderId}` : `id_${a.id}`;
        map.set(k, a);
      });
      // Cập nhật hoặc thêm mới các bản ghi mà không làm thay đổi hay mất ID cũ
      actuals.forEach((act) => {
        const k = act.planOrderId ? `plan_${act.planOrderId}` : `id_${act.id}`;
        const existing = map.get(k);
        map.set(k, {
          ...existing,
          ...act,
          id: existing?.id || act.id,
          planOrderId: act.planOrderId || existing?.planOrderId || (existing ? existing.id : undefined)!,
        });
      });
      return Array.from(map.values());
    });

    // Đồng bộ ngược lại sang planOrders cho tất cả các dòng vừa lưu
    setPlanOrders((prev) => {
      const actualMap = new Map(actuals.map((a) => [a.planOrderId || a.id, a]));
      return prev.map((p) => {
        const act = actualMap.get(p.id);
        if (act) {
          return {
            ...p,
            status: act.status || p.status || 'Hàng đơn',
            poNumber: act.poNumber || p.poNumber,
            itemCode: act.itemCode || p.itemCode,
            receiptDate: act.receiptDate || p.receiptDate,
            voucherCode: act.voucherCode !== undefined ? act.voucherCode : p.voucherCode,
            description: act.description || p.description,
            unit: act.unit || p.unit,
          };
        }
        return p;
      });
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

  const deleteActualReceive = (idOrPlanOrderId: string) => {
    setActualReceives((prev) =>
      prev.filter(
        (a) =>
          a.id !== idOrPlanOrderId &&
          a.planOrderId !== idOrPlanOrderId &&
          a.id !== `act-${idOrPlanOrderId}`
      )
    );
    syncToApi('DELETE_ACTUAL_RECEIVE', { id: idOrPlanOrderId });
  };

  const resetActualReceive = (planOrderId: string) => {
    setActualReceives((prev) => prev.filter((a) => a.planOrderId !== planOrderId && a.id !== planOrderId));
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

  // PHÂN HỆ KHO CHUNG (NỘI BỘ D&D) HANDLERS
  const saveGeneralInboundSlip = (slip: GeneralInboundSlip) => {
    setGeneralInboundSlips((prev) => {
      const exists = prev.some((s) => s.id === slip.id);
      if (exists) {
        return prev.map((s) => (s.id === slip.id ? slip : s));
      }
      return [slip, ...prev];
    });
    syncToApi('SAVE_GENERAL_INBOUND_SLIP', slip);
  };

  const deleteGeneralInboundSlip = (id: string) => {
    setGeneralInboundSlips((prev) => prev.filter((s) => s.id !== id));
    syncToApi('DELETE_GENERAL_INBOUND_SLIP', { id });
  };

  const saveGeneralOutboundSlip = (slip: GeneralOutboundSlip) => {
    setGeneralOutboundSlips((prev) => {
      const exists = prev.some((s) => s.id === slip.id);
      if (exists) {
        return prev.map((s) => (s.id === slip.id ? slip : s));
      }
      return [slip, ...prev];
    });
    syncToApi('SAVE_GENERAL_OUTBOUND_SLIP', slip);
  };

  const deleteGeneralOutboundSlip = (id: string) => {
    setGeneralOutboundSlips((prev) => prev.filter((s) => s.id !== id));
    syncToApi('DELETE_GENERAL_OUTBOUND_SLIP', { id });
  };

  // ==========================================================================
  // BỘ LẬP LỊCH TỰ ĐỘNG SAO LƯU (11:00 TRƯA & 16:30 CHIỀU MỖI NGÀY)
  // Đặt ở cuối component sau khi tất cả state và useMemo đã khởi tạo hoàn tất
  // ==========================================================================
  const autoBackupDataRef = useRef({
    googleSheetsWebhookUrl,
    customers,
    selectedCustomerId,
    purchaseOrders,
    planOrders,
    actualReceives,
    productionIssues,
    productionReports,
    finishedGoodsDeliveries,
    currentCustomerFinishedGoodsStock,
    currentCustomerDiscrepancies,
    currentCustomerCompensationItems,
    currentCustomerRealtimeStock,
    activeSizeRun,
    generalInboundSlips,
    generalOutboundSlips,
  });

  useEffect(() => {
    autoBackupDataRef.current = {
      googleSheetsWebhookUrl,
      customers,
      selectedCustomerId,
      purchaseOrders,
      planOrders,
      actualReceives,
      productionIssues,
      productionReports,
      finishedGoodsDeliveries,
      currentCustomerFinishedGoodsStock,
      currentCustomerDiscrepancies,
      currentCustomerCompensationItems,
      currentCustomerRealtimeStock,
      activeSizeRun,
      generalInboundSlips,
      generalOutboundSlips,
    };
  });

  useEffect(() => {
    if (!isAutoBackupEnabled) return;

    const checkAndTriggerAutoBackup = async () => {
      const data = autoBackupDataRef.current;
      if (!data.googleSheetsWebhookUrl.trim()) return;

      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

      const isSlot1100 = hours === 11 && minutes >= 0 && minutes <= 5;
      const isSlot1630 = hours === 16 && minutes >= 30 && minutes <= 35;

      if (!isSlot1100 && !isSlot1630) return;

      const slotKey = isSlot1100 ? 'DD_AUTO_BACKUP_DATE_1100' : 'DD_AUTO_BACKUP_DATE_1630';
      const slotLabel = isSlot1100 ? '11:00' : '16:30';
      const lastRunDate = localStorage.getItem(slotKey);

      if (lastRunDate === todayStr) {
        return; // Đã chạy trong ca này hôm nay rồi
      }

      // Đánh dấu đã chạy để không bị lặp lại trong khung giờ đó
      localStorage.setItem(slotKey, todayStr);
      const timeDisplay = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const recordTime = `${todayStr} ${timeDisplay}`;
      localStorage.setItem('DD_LAST_AUTO_BACKUP_TIME', recordTime);
      setLastAutoBackupTime(recordTime);

      try {
        const currentSizes = data.activeSizeRun?.sizes && data.activeSizeRun.sizes.length > 0
          ? data.activeSizeRun.sizes
          : ['4', '5', '6', '7', '8', '9', '10', '11', '12'];

        for (const cust of data.customers) {
          const cId = cust.id;
          const cPos = data.purchaseOrders.filter((p) => p.customerId === cId);
          const cPlans = data.planOrders.filter((p) => p.customerId === cId);
          const cActuals = data.actualReceives.filter((a) => a.customerId === cId);
          const cIssues = data.productionIssues.filter((i) => i.customerId === cId);
          const cReports = data.productionReports.filter((r) => r.customerId === cId);
          const cDeliveries = data.finishedGoodsDeliveries.filter((d) => d.customerId === cId);
          const cFgStock = cId === data.selectedCustomerId ? data.currentCustomerFinishedGoodsStock : [];
          const cDiscs = cId === data.selectedCustomerId ? data.currentCustomerDiscrepancies : [];
          const cComps = cId === data.selectedCustomerId ? data.currentCustomerCompensationItems : [];
          const cStock = cId === data.selectedCustomerId ? data.currentCustomerRealtimeStock : [];

          const payload = buildCompanySheetsPayload(
            cust,
            currentSizes,
            cPos,
            cPlans,
            cActuals,
            cDiscs,
            cComps,
            cIssues,
            cStock,
            cReports,
            cFgStock,
            cDeliveries,
            data.generalInboundSlips,
            data.generalOutboundSlips
          );

          await sendCompanyBackupToGoogleSheets(data.googleSheetsWebhookUrl, payload);
        }
        console.log(`[AutoBackup] Đã tự động sao lưu toàn bộ ${data.customers.length} công ty lúc ${slotLabel} thành công!`);
      } catch (err) {
        console.warn('[AutoBackup] Lỗi trong tiến trình tự động sao lưu:', err);
      }
    };

    const intervalId = setInterval(checkAndTriggerAutoBackup, 30000);
    checkAndTriggerAutoBackup();

    return () => clearInterval(intervalId);
  }, [isAutoBackupEnabled]);

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
        deleteActualReceive,
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

        // Google Sheets Backup
        googleSheetsWebhookUrl,
        setGoogleSheetsWebhookUrl,
        updateCustomerBackupInfo,

        // Authentication & Persistent Device Session
        isAuthenticated,
        currentUser,
        login,
        logout,

        // Auto Backup Scheduler
        isAutoBackupEnabled,
        setIsAutoBackupEnabled,
        lastAutoBackupTime,

        // General Warehouse (Kho Chung)
        generalInboundSlips,
        saveGeneralInboundSlip,
        deleteGeneralInboundSlip,
        generalOutboundSlips,
        saveGeneralOutboundSlip,
        deleteGeneralOutboundSlip,

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
