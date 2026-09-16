// functions/api/inventory.js

// Khởi tạo bảng app_metadata nếu chưa có (dùng lưu các cấu hình/dữ liệu phụ)
async function ensureMetadataTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `).run();

  try {
    await db.prepare("ALTER TABLE plan_orders ADD COLUMN status TEXT DEFAULT 'Hàng đơn'").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN status TEXT DEFAULT 'Hàng đơn'").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN po_number TEXT").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN item_code TEXT").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN receipt_date TEXT").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN voucher_code TEXT").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN description TEXT").run();
  } catch {}
  try {
    await db.prepare("ALTER TABLE actual_receives ADD COLUMN unit TEXT").run();
  } catch {}
}

// 1. GET /api/inventory - Đọc toàn bộ dữ liệu từ D1
export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "DB binding not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    await ensureMetadataTable(db);

    // Lấy dữ liệu từ 6 bảng nghiệp vụ chính
    const [
      customersRes,
      planOrdersRes,
      actualReceivesRes,
      productionIssuesRes,
      productionReportsRes,
      compensationRequestsRes,
      metadataRes
    ] = await Promise.all([
      db.prepare("SELECT * FROM customers").all().catch(() => ({ results: [] })),
      db.prepare("SELECT * FROM plan_orders ORDER BY created_at DESC").all().catch(() => ({ results: [] })),
      db.prepare("SELECT * FROM actual_receives").all().catch(() => ({ results: [] })),
      db.prepare("SELECT * FROM production_issues ORDER BY issue_date DESC").all().catch(() => ({ results: [] })),
      db.prepare("SELECT * FROM production_reports ORDER BY report_date DESC").all().catch(() => ({ results: [] })),
      db.prepare("SELECT * FROM compensation_requests ORDER BY request_date DESC").all().catch(() => ({ results: [] })),
      db.prepare("SELECT * FROM app_metadata").all().catch(() => ({ results: [] })),
    ]);

    const customers = (customersRes.results || []).map(c => ({
      id: c.id,
      code: c.code,
      name: c.name,
      note: c.note || '',
      sizeRuns: c.size_runs ? JSON.parse(c.size_runs) : [],
      activeSizeRunId: c.active_size_run_id || ''
    }));

    if (!customers.some(c => c.id === 'cust-chung')) {
      customers.push({
        id: 'cust-chung',
        code: 'CHUNG',
        name: 'Kho Chung (Nội Bộ D&D)',
        note: 'Quản lý kho nội bộ: Công cụ dụng cụ, Vật tư sản xuất & Thiết bị máy móc',
        sizeRuns: [
          {
            id: 'sr-chung-standard',
            name: 'Quản Lý Theo ĐVT (Cái, Bộ, Mét, Kg, Hộp, Cây...)',
            sizes: [],
          },
        ],
        activeSizeRunId: 'sr-chung-standard',
      });
    }

    const planOrders = (planOrdersRes.results || []).map(p => ({
      id: p.id,
      customerId: p.customer_id,
      receiptDate: p.receipt_date,
      poNumber: p.po_number,
      itemCode: p.item_code,
      voucherCode: p.voucher_code || '',
      description: p.description || '',
      unit: p.unit || 'PRS',
      sizeQuantities: p.size_quantities ? JSON.parse(p.size_quantities) : {},
      totalQty: Number(p.total_qty) || 0,
      status: p.status || 'Hàng đơn',
      note: p.note || '',
      createdAt: p.created_at
    }));

    const actualReceives = (actualReceivesRes.results || []).map(a => ({
      id: a.id,
      planOrderId: a.plan_order_id,
      customerId: a.customer_id,
      receiptDate: a.receipt_date || '',
      poNumber: a.po_number || '',
      itemCode: a.item_code || '',
      voucherCode: a.voucher_code || '',
      description: a.description || '',
      unit: a.unit || 'PRS',
      sizeQuantities: a.size_quantities ? JSON.parse(a.size_quantities) : {},
      totalQty: Number(a.total_qty) || 0,
      status: a.status || 'Hàng đơn',
      note: a.note || '',
      updatedAt: a.updated_at
    }));

    const productionIssues = (productionIssuesRes.results || []).map(pi => ({
      id: pi.id,
      customerId: pi.customer_id,
      issueDate: pi.issue_date,
      poNumber: pi.po_number,
      itemCode: pi.item_code,
      lineId: pi.line_id,
      unit: pi.unit || 'PRS',
      sizeQuantities: pi.size_quantities ? JSON.parse(pi.size_quantities) : {},
      totalQty: Number(pi.total_qty) || 0,
      note: pi.note || ''
    }));

    const productionReports = (productionReportsRes.results || []).map(pr => ({
      id: pr.id,
      customerId: pr.customer_id,
      reportDate: pr.report_date,
      poNumber: pr.po_number,
      itemCode: pr.item_code,
      lineId: pr.line_id,
      unit: pr.unit || 'PRS',
      completedQuantities: pr.completed_quantities ? JSON.parse(pr.completed_quantities) : {},
      damagedQuantities: pr.damaged_quantities ? JSON.parse(pr.damaged_quantities) : {},
      compensationFromStock: pr.compensation_from_stock ? JSON.parse(pr.compensation_from_stock) : {},
      compensationFromCustomer: pr.compensation_from_customer ? JSON.parse(pr.compensation_from_customer) : {},
      status: pr.status || 'Đủ hàng',
      note: pr.note || ''
    }));

    const compensationRequests = (compensationRequestsRes.results || []).map(cr => ({
      id: cr.id,
      customerId: cr.customer_id,
      source: cr.source,
      sourceLabel: cr.source_label,
      poNumber: cr.po_number,
      itemCode: cr.item_code,
      voucherCode: cr.voucher_code || '',
      lineId: cr.line_id || '',
      reason: cr.reason || '',
      sizeQuantities: cr.size_quantities ? JSON.parse(cr.size_quantities) : {},
      totalQty: Number(cr.total_qty) || 0,
      requestDate: cr.request_date,
      status: cr.status || 'Chờ gửi KH',
      note: cr.note || ''
    }));

    // Metadata dictionary
    const metadata = {};
    (metadataRes.results || []).forEach(row => {
      try {
        metadata[row.key] = JSON.parse(row.value);
      } catch {
        metadata[row.key] = row.value;
      }
    });

    const isEmpty = customers.length === 0 && planOrders.length === 0;

    return new Response(JSON.stringify({
      success: true,
      isEmpty,
      customers,
      planOrders,
      actualReceives,
      productionIssues,
      productionReports,
      compensationRequests,
      stockCompensations: metadata.stockCompensations || {},
      purchaseOrders: metadata.purchaseOrders || [],
      receipts: metadata.receipts || [],
      deliveries: metadata.deliveries || [],
      compensations: metadata.compensations || [],
      inventories: metadata.inventories || [],
      finishedGoodsDeliveries: metadata.finishedGoodsDeliveries || [],
      supplementalMaterialStock: metadata.supplementalMaterialStock || {},
      compensationReceivedQuantities: metadata.compensationReceivedQuantities || {},
      compensationStatusOverrides: metadata.compensationStatusOverrides || {}
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// 2. POST /api/inventory - Ghi dữ liệu vào D1
export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "DB binding not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    await ensureMetadataTable(db);

    const body = await context.request.json();
    const { action, payload } = body;

    switch (action) {
      // Khởi tạo toàn bộ dữ liệu ban đầu lên D1 (Khi database còn mới trống)
      case 'SEED_ALL': {
        const statements = [];

        if (payload.customers && payload.customers.length > 0) {
          for (const c of payload.customers) {
            statements.push(
              db.prepare(`
                INSERT OR REPLACE INTO customers (id, code, name, note, size_runs, active_size_run_id)
                VALUES (?, ?, ?, ?, ?, ?)
              `).bind(c.id, c.code, c.name, c.note || '', JSON.stringify(c.sizeRuns || []), c.activeSizeRunId || '')
            );
          }
        }

        if (payload.planOrders && payload.planOrders.length > 0) {
          for (const p of payload.planOrders) {
            statements.push(
              db.prepare(`
                INSERT OR REPLACE INTO plan_orders (id, customer_id, receipt_date, po_number, item_code, voucher_code, description, unit, size_quantities, total_qty, status, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                p.id, p.customerId, p.receiptDate || '', p.poNumber || '', p.itemCode || '',
                p.voucherCode || '', p.description || '', p.unit || 'PRS',
                JSON.stringify(p.sizeQuantities || {}), p.totalQty || 0, p.status || 'Hàng đơn', p.note || '', p.createdAt || ''
              )
            );
          }
        }

        if (payload.actualReceives && payload.actualReceives.length > 0) {
          for (const a of payload.actualReceives) {
            statements.push(
              db.prepare(`
                INSERT OR REPLACE INTO actual_receives (id, plan_order_id, customer_id, receipt_date, po_number, item_code, voucher_code, description, unit, size_quantities, total_qty, status, note, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                a.id, a.planOrderId || '', a.customerId || '',
                a.receiptDate || '', a.poNumber || '', a.itemCode || '', a.voucherCode || '', a.description || '', a.unit || 'PRS',
                JSON.stringify(a.sizeQuantities || {}), a.totalQty || 0, a.status || 'Hàng đơn', a.note || '', a.updatedAt || ''
              )
            );
          }
        }

        if (payload.productionIssues && payload.productionIssues.length > 0) {
          for (const pi of payload.productionIssues) {
            statements.push(
              db.prepare(`
                INSERT OR REPLACE INTO production_issues (id, customer_id, issue_date, po_number, item_code, line_id, unit, size_quantities, total_qty, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                pi.id, pi.customerId || '', pi.issueDate || '', pi.poNumber || '', pi.itemCode || '',
                pi.lineId || '', pi.unit || 'PRS', JSON.stringify(pi.sizeQuantities || {}),
                pi.totalQty || 0, pi.note || ''
              )
            );
          }
        }

        if (payload.productionReports && payload.productionReports.length > 0) {
          for (const pr of payload.productionReports) {
            statements.push(
              db.prepare(`
                INSERT OR REPLACE INTO production_reports (id, customer_id, report_date, po_number, item_code, line_id, unit, completed_quantities, damaged_quantities, compensation_from_stock, compensation_from_customer, status, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                pr.id, pr.customerId || '', pr.reportDate || '', pr.poNumber || '', pr.itemCode || '',
                pr.lineId || '', pr.unit || 'PRS',
                JSON.stringify(pr.completedQuantities || {}),
                JSON.stringify(pr.damagedQuantities || {}),
                JSON.stringify(pr.compensationFromStock || {}),
                JSON.stringify(pr.compensationFromCustomer || {}),
                pr.status || 'Đủ hàng',
                pr.note || ''
              )
            );
          }
        }

        if (payload.compensationRequests && payload.compensationRequests.length > 0) {
          for (const cr of payload.compensationRequests) {
            statements.push(
              db.prepare(`
                INSERT OR REPLACE INTO compensation_requests (id, customer_id, source, source_label, po_number, item_code, voucher_code, line_id, reason, size_quantities, total_qty, request_date, status, note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                cr.id, cr.customerId || '', cr.source || '', cr.sourceLabel || '',
                cr.poNumber || '', cr.itemCode || '', cr.voucherCode || '', cr.lineId || '',
                cr.reason || '', JSON.stringify(cr.sizeQuantities || {}), cr.totalQty || 0,
                cr.requestDate || '', cr.status || 'Chờ gửi KH', cr.note || ''
              )
            );
          }
        }

        // Lưu metadata
        if (payload.stockCompensations) {
          statements.push(
            db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('stockCompensations', JSON.stringify(payload.stockCompensations))
          );
        }
        if (payload.purchaseOrders) {
          statements.push(
            db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('purchaseOrders', JSON.stringify(payload.purchaseOrders))
          );
        }
        if (payload.receipts) {
          statements.push(
            db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('receipts', JSON.stringify(payload.receipts))
          );
        }
        if (payload.deliveries) {
          statements.push(
            db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('deliveries', JSON.stringify(payload.deliveries))
          );
        }
        if (payload.compensations) {
          statements.push(
            db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('compensations', JSON.stringify(payload.compensations))
          );
        }
        if (payload.inventories) {
          statements.push(
            db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('inventories', JSON.stringify(payload.inventories))
          );
        }

        if (statements.length > 0) {
          await db.batch(statements);
        }
        return new Response(JSON.stringify({ success: true, count: statements.length }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      // Lưu 1 hoặc nhiều Kế hoạch (Tab 1)
      case 'SAVE_PLAN_ORDERS': {
        const list = Array.isArray(payload) ? payload : [payload];
        const statements = list.map(p =>
          db.prepare(`
            INSERT OR REPLACE INTO plan_orders (id, customer_id, receipt_date, po_number, item_code, voucher_code, description, unit, size_quantities, total_qty, status, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            p.id, p.customerId, p.receiptDate || '', p.poNumber || '', p.itemCode || '',
            p.voucherCode || '', p.description || '', p.unit || 'PRS',
            JSON.stringify(p.sizeQuantities || {}), p.totalQty || 0, p.status || 'Hàng đơn', p.note || '', p.createdAt || ''
          )
        );
        await db.batch(statements);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_PLAN_ORDER': {
        await db.prepare("DELETE FROM plan_orders WHERE id = ?").bind(payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Lưu Thực nhận (Tab 2)
      case 'SAVE_ACTUAL_RECEIVES': {
        const list = Array.isArray(payload) ? payload : [payload];
        const statements = list.map(a =>
          db.prepare(`
            INSERT OR REPLACE INTO actual_receives (id, plan_order_id, customer_id, receipt_date, po_number, item_code, voucher_code, description, unit, size_quantities, total_qty, status, note, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            a.id, a.planOrderId || '', a.customerId || '',
            a.receiptDate || '', a.poNumber || '', a.itemCode || '', a.voucherCode || '', a.description || '', a.unit || 'PRS',
            JSON.stringify(a.sizeQuantities || {}), a.totalQty || 0, a.status || 'Hàng đơn', a.note || '', a.updatedAt || ''
          )
        );
        await db.batch(statements);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Lưu Xuất sản xuất (Tab 5)
      case 'SAVE_PRODUCTION_ISSUES': {
        const list = Array.isArray(payload) ? payload : [payload];
        const statements = list.map(pi =>
          db.prepare(`
            INSERT OR REPLACE INTO production_issues (id, customer_id, issue_date, po_number, item_code, line_id, unit, size_quantities, total_qty, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            pi.id, pi.customerId || '', pi.issueDate || '', pi.poNumber || '', pi.itemCode || '',
            pi.lineId || '', pi.unit || 'PRS', JSON.stringify(pi.sizeQuantities || {}),
            pi.totalQty || 0, pi.note || ''
          )
        );
        await db.batch(statements);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_PRODUCTION_ISSUE': {
        await db.prepare("DELETE FROM production_issues WHERE id = ?").bind(payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Lưu Báo cáo sản xuất (Tab 7)
      case 'SAVE_PRODUCTION_REPORT': {
        const pr = payload;
        await db.prepare(`
          INSERT OR REPLACE INTO production_reports (id, customer_id, report_date, po_number, item_code, line_id, unit, completed_quantities, damaged_quantities, compensation_from_stock, compensation_from_customer, status, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          pr.id, pr.customerId || '', pr.reportDate || '', pr.poNumber || '', pr.itemCode || '',
          pr.lineId || '', pr.unit || 'PRS',
          JSON.stringify(pr.completedQuantities || {}),
          JSON.stringify(pr.damagedQuantities || {}),
          JSON.stringify(pr.compensationFromStock || {}),
          JSON.stringify(pr.compensationFromCustomer || {}),
          pr.status || 'Đủ hàng',
          pr.note || ''
        ).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_PRODUCTION_REPORT': {
        await db.prepare("DELETE FROM production_reports WHERE id = ?").bind(payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Cập nhật trạng thái phiếu bù (Tab 4)
      case 'UPDATE_COMPENSATION_STATUS': {
        await db.prepare("UPDATE compensation_requests SET status = ? WHERE id = ?").bind(payload.status, payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'UPDATE_COMPENSATION_DATE': {
        await db.prepare("UPDATE compensation_requests SET request_date = ? WHERE id = ?").bind(payload.requestDate, payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'SAVE_COMPENSATION_REQUESTS': {
        const list = Array.isArray(payload) ? payload : [payload];
        const statements = list.map(cr =>
          db.prepare(`
            INSERT OR REPLACE INTO compensation_requests (id, customer_id, source, source_label, po_number, item_code, voucher_code, line_id, reason, size_quantities, total_qty, request_date, status, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            cr.id, cr.customerId || '', cr.source || '', cr.sourceLabel || '',
            cr.poNumber || '', cr.itemCode || '', cr.voucherCode || '', cr.lineId || '',
            cr.reason || '', JSON.stringify(cr.sizeQuantities || {}), cr.totalQty || 0,
            cr.requestDate || '', cr.status || 'Chờ gửi KH', cr.note || ''
          )
        );
        await db.batch(statements);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_COMPENSATION_REQUEST': {
        await db.prepare("DELETE FROM compensation_requests WHERE id = ?").bind(payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_ACTUAL_RECEIVE': {
        await db.prepare("DELETE FROM actual_receives WHERE plan_order_id = ?").bind(payload.planOrderId).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'SAVE_FINISHED_GOODS_DELIVERY': {
        const existingRow = await db.prepare("SELECT value FROM app_metadata WHERE key = 'finishedGoodsDeliveries'").first();
        let deliveries = [];
        if (existingRow && existingRow.value) {
          try { deliveries = JSON.parse(existingRow.value); } catch {}
        }
        const idx = deliveries.findIndex(d => d.id === payload.id);
        if (idx >= 0) {
          deliveries[idx] = payload;
        } else {
          deliveries.unshift(payload);
        }
        await db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('finishedGoodsDeliveries', ?)").bind(JSON.stringify(deliveries)).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_FINISHED_GOODS_DELIVERY': {
        const existingRow = await db.prepare("SELECT value FROM app_metadata WHERE key = 'finishedGoodsDeliveries'").first();
        let deliveries = [];
        if (existingRow && existingRow.value) {
          try { deliveries = JSON.parse(existingRow.value); } catch {}
        }
        deliveries = deliveries.filter(d => d.id !== payload.id);
        await db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('finishedGoodsDeliveries', ?)").bind(JSON.stringify(deliveries)).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'SAVE_SUPPLEMENTAL_STOCK': {
        await db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('supplementalMaterialStock', ?)").bind(JSON.stringify(payload)).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'RECEIVE_COMPENSATION': {
        const { id, receivedQuantities, status } = payload;
        if (status) {
          await db.prepare("UPDATE compensation_requests SET status = ? WHERE id = ?").bind(status, id).run();
        }
        const qRow = await db.prepare("SELECT value FROM app_metadata WHERE key = 'compensationReceivedQuantities'").first();
        let qMap = {};
        if (qRow && qRow.value) try { qMap = JSON.parse(qRow.value); } catch {}
        qMap[id] = receivedQuantities;
        await db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('compensationReceivedQuantities', ?)").bind(JSON.stringify(qMap)).run();

        if (status) {
          const sRow = await db.prepare("SELECT value FROM app_metadata WHERE key = 'compensationStatusOverrides'").first();
          let sMap = {};
          if (sRow && sRow.value) try { sMap = JSON.parse(sRow.value); } catch {}
          sMap[id] = status;
          await db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES ('compensationStatusOverrides', ?)").bind(JSON.stringify(sMap)).run();
        }
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Cập nhật xuất bù tồn kho (Tab 6)
      case 'SAVE_STOCK_COMPENSATIONS': {
        await db.prepare("INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)").bind('stockCompensations', JSON.stringify(payload)).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Cập nhật khách hàng
      case 'SAVE_CUSTOMER': {
        const c = payload;
        await db.prepare(`
          INSERT OR REPLACE INTO customers (id, code, name, note, size_runs, active_size_run_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(c.id, c.code, c.name, c.note || '', JSON.stringify(c.sizeRuns || []), c.activeSizeRunId || '').run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      case 'DELETE_CUSTOMER': {
        await db.prepare("DELETE FROM customers WHERE id = ?").bind(payload.id).run();
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      // Reset toàn bộ
      case 'RESET_ALL': {
        await db.batch([
          db.prepare("DELETE FROM plan_orders"),
          db.prepare("DELETE FROM actual_receives"),
          db.prepare("DELETE FROM production_issues"),
          db.prepare("DELETE FROM production_reports"),
          db.prepare("DELETE FROM compensation_requests"),
          db.prepare("DELETE FROM app_metadata"),
        ]);
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
