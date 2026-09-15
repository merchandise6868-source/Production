import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  FolderSync,
  HelpCircle,
  Building2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import {
  buildCompanySheetsPayload,
  sendCompanyBackupToGoogleSheets,
  testGoogleSheetsWebhook,
} from '../../utils/googleSheetsSync';
import { useMessageBox } from './MessageBox';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetsBackupModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { alert, toast } = useMessageBox();
  const {
    customers,
    selectedCustomerId,
    currentCustomer,
    activeSizeRun,
    purchaseOrders,
    planOrders,
    actualReceives,
    productionIssues,
    productionReports,
    finishedGoodsDeliveries,
    finishedGoodsStock,
    currentCustomerDiscrepancies,
    currentCustomerCompensationItems,
    currentCustomerRealtimeStock,
    googleSheetsWebhookUrl,
    setGoogleSheetsWebhookUrl,
    updateCustomerBackupInfo,
  } = useInventory();

  const [inputUrl, setInputUrl] = useState(googleSheetsWebhookUrl || '');
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<'SUCCESS' | 'FAILED' | null>(null);

  useEffect(() => {
    if (googleSheetsWebhookUrl && !inputUrl) {
      setInputUrl(googleSheetsWebhookUrl);
    }
  }, [googleSheetsWebhookUrl, inputUrl]);

  const [showScriptHelp, setShowScriptHelp] = useState(!googleSheetsWebhookUrl);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState<{
    current: number;
    total: number;
    currentName: string;
    logs: string[];
  } | null>(null);

  if (!isOpen) return null;

  const sizes = activeSizeRun?.sizes && activeSizeRun.sizes.length > 0
    ? activeSizeRun.sizes
    : ['4', '5', '6', '7', '8', '9', '10', '11', '12'];

  // Save webhook URL
  const handleSaveUrl = () => {
    if (!inputUrl.trim()) {
      alert('Vui lòng nhập đường link Google Apps Script Webhook URL!', 'Thiếu URL', 'warning');
      return;
    }
    setGoogleSheetsWebhookUrl(inputUrl.trim());
    toast('✅ Đã lưu Google Apps Script Webhook URL thành công!');
  };

  // Test webhook connection
  const handleTestConnection = async () => {
    if (!inputUrl.trim()) {
      alert('Vui lòng nhập Webhook URL trước khi kiểm tra!', 'Thiếu URL', 'warning');
      return;
    }
    setIsTestingUrl(true);
    setTestResult(null);
    try {
      const ok = await testGoogleSheetsWebhook(inputUrl);
      if (ok) {
        setTestResult('SUCCESS');
        toast('🟢 Kết nối Webhook thành công!');
      } else {
        setTestResult('FAILED');
      }
    } catch {
      setTestResult('FAILED');
    } finally {
      setIsTestingUrl(false);
    }
  };

  // Copy Google Apps Script code
  const handleCopyScriptCode = () => {
    const scriptCode = `/**
 * GOOGLE APPS SCRIPT: MASTER HUB SAO LƯU DỮ LIỆU KHO ĐA CÔNG TY
 * DỰ ÁN: HỆ THỐNG QUẢN LÝ KHO SẢN XUẤT - D&D LONG AN
 */
const ROOT_FOLDER_NAME = "HỆ THỐNG KHO D&D LONG AN - DỮ LIỆU SAO LƯU";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "Google Apps Script Master Hub đang hoạt động bình thường!"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Dữ liệu rỗng" })).setMimeType(ContentService.MimeType.JSON);
    }
    const payload = JSON.parse(e.postData.contents);
    const companyName = payload.companyName || "Công Ty";
    const sheetsData = payload.sheets || {};
    const timestamp = payload.timestamp || new Date().toLocaleString("vi-VN");

    const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
    const targetFolder = folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);

    const fileName = "[KHO] - Báo Cáo - " + companyName.trim();
    const files = targetFolder.getFilesByName(fileName);
    let spreadsheet;
    if (files.hasNext()) {
      spreadsheet = SpreadsheetApp.openById(files.next().getId());
    } else {
      spreadsheet = SpreadsheetApp.create(fileName);
      const f = DriveApp.getFileById(spreadsheet.getId());
      targetFolder.addFile(f);
      DriveApp.getRootFolder().removeFile(f);
    }

    const updatedSheetNames = [];
    for (const [sheetKey, sheetObj] of Object.entries(sheetsData)) {
      const sheetName = sheetObj.title || sheetKey;
      const headers = sheetObj.headers || [];
      const rows = sheetObj.rows || [];
      const headerColor = sheetObj.themeColor || "#1e3a8a";

      let sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) sheet = spreadsheet.insertSheet(sheetName);
      sheet.clear();

      const allData = [];
      if (headers.length > 0) allData.push(headers);
      rows.forEach(r => allData.push(r));

      if (allData.length > 0) {
        const totalRows = allData.length;
        const totalCols = Math.max.apply(null, allData.map(r => r.length));
        const normalized = allData.map(row => {
          const nr = new Array(totalCols).fill("");
          row.forEach((v, i) => { nr[i] = (v === null || v === undefined) ? "" : v; });
          return nr;
        });
        const range = sheet.getRange(1, 1, totalRows, totalCols);
        range.setValues(normalized);
        range.setFontFamily("Roboto");
        range.setFontSize(10);
        range.setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);

        if (headers.length > 0) {
          const hRange = sheet.getRange(1, 1, 1, totalCols);
          hRange.setBackground(headerColor);
          hRange.setFontColor("#ffffff");
          hRange.setFontWeight("bold");
          hRange.setHorizontalAlignment("center");
          sheet.setFrozenRows(1);
        }
        for (let c = 1; c <= totalCols; c++) {
          sheet.autoResizeColumn(c);
          if (sheet.getColumnWidth(c) < 80) sheet.setColumnWidth(c, 80);
          if (sheet.getColumnWidth(c) > 260) sheet.setColumnWidth(c, 260);
        }
      }
      updatedSheetNames.push(sheetName);
    }

    const defaultS = spreadsheet.getSheetByName("Sheet1") || spreadsheet.getSheetByName("Trang tính 1");
    if (defaultS && spreadsheet.getSheets().length > 1) {
      try { spreadsheet.deleteSheet(defaultS); } catch (err) {}
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Đã sao lưu thành công " + updatedSheetNames.length + " sheet",
      companyId: payload.companyId,
      companyName: companyName,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl(),
      updatedSheets: updatedSheetNames,
      timestamp: timestamp
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    navigator.clipboard.writeText(scriptCode);
    setHasCopiedCode(true);
    toast('📋 Đã sao chép toàn bộ mã Google Apps Script vào bộ nhớ tạm!');
    setTimeout(() => setHasCopiedCode(false), 3000);
  };

  // Helper to backup a single company
  const backupSingleCompany = async (targetCustomer: typeof customers[0]): Promise<boolean> => {
    const activeUrl = inputUrl.trim() || googleSheetsWebhookUrl.trim();
    if (!activeUrl) {
      setShowScriptHelp(true);
      alert(
        'Vui lòng tạo và dán Webhook URL của Google Drive vào ô bên trên trước khi sao lưu!\n(Hệ thống đã tự động mở hướng dẫn 4 bước bên dưới cho bạn)',
        'Chưa có Webhook',
        'warning'
      );
      return false;
    }

    // Filter data for this customer
    const cId = targetCustomer.id;
    const cPos = purchaseOrders.filter((p) => p.customerId === cId);
    const cPlans = planOrders.filter((p) => p.customerId === cId);
    const cActuals = actualReceives.filter((a) => a.customerId === cId);
    const cIssues = productionIssues.filter((i) => i.customerId === cId);
    const cReports = productionReports.filter((r) => r.customerId === cId);
    const cDeliveries = finishedGoodsDeliveries.filter((d) => d.customerId === cId);
    const cFgStock = finishedGoodsStock.filter((fg) => fg.customerId === cId);

    // Tab 3, 4, 6
    const cDiscs = cId === selectedCustomerId ? currentCustomerDiscrepancies : [];
    const cComps = cId === selectedCustomerId ? currentCustomerCompensationItems : [];
    const cStock = cId === selectedCustomerId ? currentCustomerRealtimeStock : [];

    const payload = buildCompanySheetsPayload(
      targetCustomer,
      sizes,
      cPos,
      cPlans,
      cActuals,
      cDiscs,
      cComps,
      cIssues,
      cStock,
      cReports,
      cFgStock,
      cDeliveries
    );

    const res = await sendCompanyBackupToGoogleSheets(activeUrl, payload);

    if (res.success && res.spreadsheetUrl) {
      updateCustomerBackupInfo(cId, res.spreadsheetUrl, res.timestamp || new Date().toLocaleString('vi-VN'));
      return true;
    } else {
      throw new Error(res.error || 'Phản hồi thất bại từ Google Apps Script');
    }
  };

  // Handle backup current company
  const handleBackupCurrentCompany = async () => {
    if (!currentCustomer) {
      alert('Vui lòng chọn khách hàng/công ty trước khi sao lưu!', 'Chưa chọn công ty', 'warning');
      return;
    }
    setIsBackingUp(true);
    setBackupProgress({
      current: 1,
      total: 1,
      currentName: currentCustomer.name,
      logs: [`Bắt đầu sao lưu 10 sheets cho ${currentCustomer.name}...`],
    });

    try {
      await backupSingleCompany(currentCustomer);
      setBackupProgress((p) => ({
        current: 1,
        total: 1,
        currentName: currentCustomer.name,
        logs: [...(p?.logs || []), `✅ Hoàn tất sao lưu 10 sheets cho ${currentCustomer.name}!`],
      }));
      toast(`🎉 Đã sao lưu thành công file Google Sheet của công ty ${currentCustomer.name}!`);
    } catch (err: any) {
      alert(`Lỗi khi sao lưu: ${err.message}`, 'Sao lưu thất bại', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handle backup ALL companies in 1-Click
  const handleBackupAllCompanies = async () => {
    if (customers.length === 0) {
      alert('Chưa có danh sách công ty nào để sao lưu!', 'Trống', 'warning');
      return;
    }

    setIsBackingUp(true);
    setBackupProgress({
      current: 0,
      total: customers.length,
      currentName: customers[0].name,
      logs: [`Bắt đầu chu trình sao lưu hàng loạt cho ${customers.length} công ty...`],
    });

    let successCount = 0;
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      setBackupProgress((p) => ({
        current: i + 1,
        total: customers.length,
        currentName: c.name,
        logs: [...(p?.logs || []), `Đang xử lý (${i + 1}/${customers.length}): ${c.name}...`],
      }));

      try {
        await backupSingleCompany(c);
        successCount++;
        setBackupProgress((p) => ({
          current: i + 1,
          total: customers.length,
          currentName: c.name,
          logs: [...(p?.logs || []), `  ✓ Hoàn thành ${c.name} (File Google Sheet riêng)`],
        }));
      } catch (err: any) {
        setBackupProgress((p) => ({
          current: i + 1,
          total: customers.length,
          currentName: c.name,
          logs: [...(p?.logs || []), `  ❌ Lỗi tại ${c.name}: ${err.message}`],
        }));
      }
    }

    setIsBackingUp(false);
    toast(`🚀 Đã hoàn tất sao lưu: Thành công ${successCount}/${customers.length} công ty!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                TRUNG TÂM SAO LƯU DỮ LIỆU GOOGLE SHEETS
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-300/40 text-emerald-100">
                  Đa Công Ty
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90">
                Mỗi công ty sở hữu một File Google Sheet độc lập trên Drive • Đầy đủ 10 Sheets nghiệp vụ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* SECTION 1: CẤU HÌNH WEBHOOK */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <FolderSync className="w-4 h-4 text-teal-600" />
                ĐƯỜNG LINK GOOGLE APPS SCRIPT WEBHOOK URL:
              </label>
              <button
                type="button"
                onClick={() => setShowScriptHelp(!showScriptHelp)}
                className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showScriptHelp ? 'Đóng hướng dẫn' : 'Xem mã script & Hướng dẫn cài đặt 2 phút'}</span>
                {showScriptHelp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                className="flex-1 min-w-[280px] h-9 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveUrl}
                className="px-3.5 h-9 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu URL</span>
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingUrl}
                className="px-3 h-9 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingUrl ? 'animate-spin text-teal-600' : ''}`} />
                <span>{isTestingUrl ? 'Đang thử...' : 'Kiểm tra'}</span>
              </button>
            </div>

            {testResult === 'SUCCESS' && (
              <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Kết nối tới Webhook Google Apps Script thành công! Hệ thống sẵn sàng sao lưu.
              </p>
            )}
            {testResult === 'FAILED' && (
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Không thể kết nối! Hãy chắc chắn bạn đã Deploy dưới dạng "Web App" với quyền truy cập "Anyone".
              </p>
            )}

            {/* Hướng dẫn chi tiết & nút Copy Script */}
            {showScriptHelp && (
              <div className="mt-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 space-y-2.5 animate-in fade-in duration-150">
                <p className="font-bold text-[11px] uppercase tracking-wide text-amber-950 flex items-center justify-between">
                  <span>HƯỚNG DẪN THIẾT LẬP GOOGLE APPS SCRIPT TRÊN GOOGLE DRIVE:</span>
                  <button
                    type="button"
                    onClick={handleCopyScriptCode}
                    className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer transition shadow-2xs"
                  >
                    {hasCopiedCode ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{hasCopiedCode ? 'Đã sao chép mã!' : 'Sao chép mã Script'}</span>
                  </button>
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-amber-900/90 leading-relaxed">
                  <li>Truy cập <strong>Google Drive</strong> của công ty (<code>drive.google.com</code>).</li>
                  <li>Bấm <strong>Mới (+)</strong> &gt; Chọn <strong>Khác</strong> &gt; Chọn <strong>Google Apps Script</strong>.</li>
                  <li>Xóa đoạn mã mặc định, bấm nút <strong>"Sao chép mã Script"</strong> ở trên và dán (Ctrl+V) vào ô soạn thảo.</li>
                  <li>Bấm <strong>Triển khai (Deploy)</strong> ở góc trên bên phải &gt; Chọn <strong>Tùy chọn triển khai mới (New deployment)</strong>.</li>
                  <li>Mục <em>Chọn loại</em>: Chọn <strong>Ứng dụng web (Web App)</strong>.</li>
                  <li>Tại mục <em>Ai có quyền truy cập (Who has access)</em>: Chọn <strong>Bất kỳ ai (Anyone)</strong> &gt; Bấm <strong>Triển khai</strong>.</li>
                  <li>Sao chép đường link <strong>URL của ứng dụng web</strong> và dán vào ô bên trên rồi bấm <strong>Lưu URL</strong>.</li>
                </ol>
              </div>
            )}
          </div>

          {/* SECTION 2: THAO TÁC SAO LƯU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Sao lưu công ty hiện tại */}
            <div className="p-4 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-teal-700 tracking-wider">Chế độ đơn lẻ</span>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  {currentCustomer?.name || 'Chưa chọn công ty'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Chỉ sao lưu toàn bộ 10 tab dữ liệu của công ty đang xem vào đúng file Google Sheet của công ty này.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackupCurrentCompany}
                disabled={isBackingUp || !currentCustomer}
                className="w-full h-10 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{isBackingUp ? 'Đang thực hiện sao lưu...' : `⚡ Sao Lưu Cho ${currentCustomer?.name || 'Công ty'}`}</span>
              </button>
            </div>

            {/* Sao lưu TẤT CẢ CÔNG TY (1-Click) */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider">Chế độ toàn diện</span>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  Sao Lưu Toàn Bộ ({customers.length} Công Ty)
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tự động duyệt qua từng công ty, tạo mới hoặc cập nhật 10 sheets vào từng file Google Sheet độc lập trên Google Drive.
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackupAllCompanies}
                disabled={isBackingUp || customers.length === 0}
                className="w-full h-10 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:bg-slate-300 text-white font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <FolderSync className="w-4 h-4" />
                <span>{isBackingUp ? 'Đang tiến hành sao lưu hàng loạt...' : `🚀 Sao Lưu TẤT CẢ ${customers.length} Công Ty (1-Click)`}</span>
              </button>
            </div>
          </div>

          {/* PROGRESS BAR KHI ĐANG SAO LƯU */}
          {backupProgress && (
            <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>Tiến trình: Đang xử lý "{backupProgress.currentName}" ({backupProgress.current}/{backupProgress.total})</span>
                <span>{Math.round((backupProgress.current / backupProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-300"
                  style={{ width: `${(backupProgress.current / backupProgress.total) * 100}%` }}
                />
              </div>
              <div className="max-h-24 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-0.5 pt-1">
                {backupProgress.logs.map((log, idx) => (
                  <div key={idx}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 3: DANH SÁCH FILE GOOGLE SHEET TỪNG CÔNG TY */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
              <span>DANH SÁCH FILE GOOGLE SHEET TƯƠNG ỨNG CỦA CÁC CÔNG TY:</span>
              <span className="text-slate-500 text-[11px] normal-case font-normal">
                Tổng cộng: <strong>{customers.length}</strong> công ty đối tác
              </span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                    <th className="p-2.5 w-12 text-center">STT</th>
                    <th className="p-2.5">Tên Công Ty / Khách Hàng</th>
                    <th className="p-2.5">File Google Sheet Riêng</th>
                    <th className="p-2.5">Lần Sao Lưu Cuối</th>
                    <th className="p-2.5 w-32 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {customers.map((cust, idx) => (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cust.name}</span>
                          {cust.id === selectedCustomerId && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-teal-100 text-teal-800">
                              Đang chọn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        {cust.googleSheetUrl ? (
                          <a
                            href={cust.googleSheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>[KHO] - Báo Cáo - {cust.name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Chưa khởi tạo (Tự động sinh khi sao lưu)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-600 text-[11px]">
                        {cust.lastBackupAt ? (
                          <span className="text-emerald-700 font-medium">✓ {cust.lastBackupAt}</span>
                        ) : (
                          <span className="text-slate-400">Chưa có lịch sử</span>
                        )}
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => backupSingleCompany(cust)}
                            disabled={isBackingUp}
                            className="px-2 py-1 text-[11px] font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded cursor-pointer transition disabled:opacity-50"
                            title="Sao lưu công ty này ngay"
                          >
                            Sao lưu
                          </button>
                          {cust.googleSheetUrl && (
                            <a
                              href={cust.googleSheetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition inline-flex items-center gap-1"
                              title="Mở file Google Sheet của công ty này"
                            >
                              <span>Mở Sheet</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="text-[11px]">
            💡 Mỗi lần sao lưu sẽ cập nhật mới nhất toàn bộ 10 sheets trong file của công ty đó mà không làm mất liên kết chia sẻ.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
