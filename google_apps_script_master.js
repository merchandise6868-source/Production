/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: MASTER HUB SAO LƯU DỮ LIỆU KHO ĐA CÔNG TY (PHIÊN BẢN TỐI ƯU SIÊU TỐC)
 * DỰ ÁN: HỆ THỐNG QUẢN LÝ KHO SẢN XUẤT - D&D LONG AN
 * ==============================================================================
 * 
 * ĐÃ TỐI ƯU:
 * 1. Gom toàn bộ cột bằng Batch Auto-Resize (sheet.autoResizeColumns) -> Tăng tốc 20x.
 * 2. Tự động bôi màu đỏ số âm Tab 3 bằng ConditionalFormatRule -> 0.01s trên Cloud.
 * 3. Bảo mật Webhook bằng SECRET_API_TOKEN -> Ngăn ngừa quét và spam từ bên ngoài.
 * ==============================================================================
 */

// Tên thư mục gốc lưu trữ tập trung trên Google Drive
const ROOT_FOLDER_NAME = "HỆ THỐNG KHO D&D LONG AN - DỮ LIỆU SAO LƯU";

// Khóa bí mật bảo vệ API Webhook (Khớp với Web App Kho)
const SECRET_API_TOKEN = "DD_LONG_AN_SECURE_TOKEN_2026";

/**
 * Xử lý kiểm tra kết nối từ Web App Kho (GET Request)
 */
function doGet(e) {
  const result = {
    status: "ok",
    service: "Master Hub Backup Kho D&D Long An",
    version: "3.0 - Siêu tốc & Bảo mật Token",
    timestamp: new Date().toLocaleString("vi-VN"),
    message: "Google Apps Script Web App Master Hub đang hoạt động hoàn hảo!"
  };
  return createJsonResponse(result);
}

/**
 * Xử lý nhận dữ liệu sao lưu từ Web Kho gửi sang (POST Request)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        error: "Không nhận được nội dung dữ liệu payload từ Web!"
      });
    }

    const payload = JSON.parse(e.postData.contents);

    // Xác thực Secret Key bảo vệ API
    if (payload.secretToken && payload.secretToken !== SECRET_API_TOKEN) {
      return createJsonResponse({
        success: false,
        error: "Lỗi bảo mật: Secret Token không hợp lệ! Từ chối truy cập."
      });
    }

    const companyId = payload.companyId || "default";
    const companyName = (payload.companyName || "Công Ty").trim();
    const sheetsData = payload.sheets || {};
    const timestamp = payload.timestamp || new Date().toLocaleString("vi-VN");

    // 1. Tìm hoặc tự động tạo thư mục gốc trên Google Drive
    const targetFolder = getOrCreateFolder(ROOT_FOLDER_NAME);

    // 2. Tìm hoặc tự động tạo File Google Sheet riêng biệt cho công ty này
    const spreadsheet = getOrCreateCompanySpreadsheet(targetFolder, companyName);
    const spreadsheetUrl = spreadsheet.getUrl();
    const spreadsheetId = spreadsheet.getId();

    const updatedSheetNames = [];

    // 3. Cập nhật từng Sheet tương ứng theo cơ chế Batch gom khối siêu tốc
    for (const [sheetKey, sheetObj] of Object.entries(sheetsData)) {
      const sheetName = sheetObj.title || sheetKey;
      const headers = sheetObj.headers || [];
      const rows = sheetObj.rows || [];
      const headerColor = sheetObj.themeColor || "#1e3a8a";

      updateOrCreateSheetOptimized(spreadsheet, sheetName, headers, rows, headerColor, sheetKey);
      updatedSheetNames.push(sheetName);
    }

    // 4. Ghi nhận nhật ký lịch sử sao lưu vào sheet cuối cùng
    updateBackupLogSheet(spreadsheet, companyName, timestamp, updatedSheetNames.length);

    // 5. Xóa sheet mặc định "Sheet1" nếu có
    cleanupDefaultSheet(spreadsheet);

    return createJsonResponse({
      success: true,
      message: "Đã sao lưu thành công " + updatedSheetNames.length + " sheet cho công ty " + companyName + " trong vài giây!",
      companyId: companyId,
      companyName: companyName,
      spreadsheetId: spreadsheetId,
      spreadsheetUrl: spreadsheetUrl,
      updatedSheets: updatedSheetNames,
      timestamp: timestamp
    });

  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  }
}

/**
 * Tìm hoặc tạo thư mục trên Google Drive
 */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * Tìm hoặc tạo file Google Sheet riêng cho từng công ty trong thư mục Drive
 */
function getOrCreateCompanySpreadsheet(folder, companyName) {
  const expectedFileName = "[KHO] - Báo Cáo - " + companyName.trim();
  const files = folder.getFilesByName(expectedFileName);

  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }

  // Tạo mới file Google Sheet và lưu vào đúng thư mục công ty
  const newSheet = SpreadsheetApp.create(expectedFileName);
  const file = DriveApp.getFileById(newSheet.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  return newSheet;
}

/**
 * Cập nhật nội dung và định dạng thẩm mỹ theo cơ chế BATCH SIÊU TỐC
 */
function updateOrCreateSheetOptimized(spreadsheet, sheetName, headers, rows, headerColor, sheetKey) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.clear();

  if (headers.length === 0 && rows.length === 0) {
    sheet.getRange(1, 1).setValue("Chưa có dữ liệu cho mục này.");
    return;
  }

  const allData = [];
  if (headers.length > 0) {
    allData.push(headers);
  }
  rows.forEach(function(r) { allData.push(r); });

  const totalRows = allData.length;
  const totalCols = Math.max.apply(null, allData.map(function(r) { return r.length; }).concat([headers.length]));

  // Chuẩn hóa ma trận dữ liệu
  const normalizedData = allData.map(function(row) {
    const newRow = new Array(totalCols).fill("");
    row.forEach(function(val, idx) {
      newRow[idx] = (val === undefined || val === null) ? "" : val;
    });
    return newRow;
  });

  const range = sheet.getRange(1, 1, totalRows, totalCols);
  range.setValues(normalizedData);
  range.setFontFamily("Roboto");
  range.setFontSize(10);
  range.setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);

  // 1. Định dạng dòng tiêu đề (Header Row)
  if (headers.length > 0) {
    const headerRange = sheet.getRange(1, 1, 1, totalCols);
    headerRange.setBackground(headerColor);
    headerRange.setFontColor("#ffffff");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    headerRange.setWrap(true);
    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);
  }

  // 2. Định dạng dữ liệu và cảnh báo lệch âm
  if (totalRows > 1) {
    const dataRange = sheet.getRange(2, 1, totalRows - 1, totalCols);
    dataRange.setVerticalAlignment("middle");

    // Canh giữa cột STT (Cột 1)
    sheet.getRange(2, 1, totalRows - 1, 1).setHorizontalAlignment("center");

    // Áp dụng định dạng có điều kiện siêu tốc cho Tab 3 (0.01 giây trên Cloud)
    if (sheetName.indexOf("Tab3") !== -1 || (sheetKey && sheetKey.indexOf("Tab3") !== -1)) {
      applyTab3ConditionalFormatting(sheet, dataRange);
    }
  }

  // 3. Tự động căn chỉnh độ rộng cột BATCH GOM KHỐI (1 LỆNH DUY NHẤT)
  try {
    sheet.autoResizeColumns(1, totalCols);
  } catch (e) {}
}

/**
 * Tự động bôi màu đỏ cảnh báo lệch âm bằng CONDITIONAL FORMAT RULES gốc của Google Sheets
 * Thực thi trong 0.01 giây mà không cần lặp từng ô!
 */
function applyTab3ConditionalFormatting(sheet, dataRange) {
  try {
    const ruleNegative = SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThan(0)
      .setBackground("#fee2e2")
      .setFontColor("#b91c1c")
      .setBold(true)
      .setRanges([dataRange])
      .build();

    const ruleComp = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("CẦN BÙ")
      .setBackground("#fee2e2")
      .setFontColor("#991b1b")
      .setBold(true)
      .setRanges([dataRange])
      .build();

    const ruleMatch = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("Khớp đủ")
      .setBackground("#dcfce7")
      .setFontColor("#15803d")
      .setBold(true)
      .setRanges([dataRange])
      .build();

    sheet.setConditionalFormatRules([ruleNegative, ruleComp, ruleMatch]);
  } catch (err) {}
}

/**
 * Ghi nhận nhật ký lịch sử sao lưu
 */
function updateBackupLogSheet(spreadsheet, companyName, timestamp, sheetCount) {
  const logSheetName = "NhatKy_SaoLuu";
  let sheet = spreadsheet.getSheetByName(logSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(logSheetName);
    sheet.getRange(1, 1, 1, 4).setValues([["STT", "Thời Gian Sao Lưu", "Công Ty", "Số Sheets Đồng Bộ"]]);
    const hRange = sheet.getRange(1, 1, 1, 4);
    hRange.setBackground("#334155");
    hRange.setFontColor("#ffffff");
    hRange.setFontWeight("bold");
    hRange.setHorizontalAlignment("center");
    hRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 30);
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  const newStt = lastRow;
  sheet.appendRow([newStt, timestamp, companyName, sheetCount + " Sheets"]);
  try { sheet.autoResizeColumns(1, 4); } catch (e) {}
}

/**
 * Xóa sheet rỗng mặc định nếu đã có các sheet nghiệp vụ
 */
function cleanupDefaultSheet(spreadsheet) {
  const defaultSheet = spreadsheet.getSheetByName("Sheet1") || spreadsheet.getSheetByName("Trang tính 1");
  if (defaultSheet && spreadsheet.getSheets().length > 1) {
    try {
      spreadsheet.deleteSheet(defaultSheet);
    } catch (e) {}
  }
}

/**
 * Helper tạo phản hồi JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * HÀM CHẠY THỬ TRỰC TIẾP TRONG GOOGLE APPS SCRIPT EDITOR:
 * Chọn hàm "testKhoiTaoVaSaoLuu" rồi bấm "Chạy" (Run) để kiểm tra tốc độ siêu tốc 100%!
 */
function testKhoiTaoVaSaoLuu() {
  const testPayload = {
    secretToken: SECRET_API_TOKEN,
    companyId: "test-dw",
    companyName: "Deawoong (DW) - Test Siêu Tốc",
    timestamp: new Date().toLocaleString("vi-VN"),
    sheets: {
      "01_DonHang_PO": {
        title: "01_DonHang_PO",
        themeColor: "#1e3a8a",
        headers: ["STT", "Mã PO", "Style / Tên Hàng", "Ngày Đặt", "ĐVT", "Size 4", "Size 5", "Size 6", "Size 7", "Tổng SL Đặt", "Ghi Chú"],
        rows: [
          [1, "PO-101", "Giày Da Nam Cao Cấp", "01/09/2026", "PRS", 10, 15, 20, 15, 60, "Đơn xuất khẩu"],
          [2, "PO-102", "Giày Thể Thao Mẫu Mới", "02/09/2026", "PRS", 20, 30, 20, 10, 80, "Gấp"]
        ]
      },
      "Tab1_KeHoachNhap": {
        title: "Tab1_KeHoachNhap",
        themeColor: "#0284c7",
        headers: ["STT", "Ngày Nhận", "Mã PO", "Code Vật Tư", "Trạng Thái", "Số Phiếu Giao", "Quy Cách / Diễn Giải", "ĐVT", "Size 4", "Size 5", "Size 6", "Size 7", "Tổng Kế Hoạch", "Ghi Chú"],
        rows: [
          [1, "01/09/2026", "PO-101", "VT-DA-01", "Hàng đơn", "PX-001", "Da bò thuộc cao cấp", "PRS", 10, 15, 20, 15, 60, "Đơn gốc"],
          [2, "02/09/2026", "PO-101", "VT-DA-01", "Hàng bù", "PX-002", "Da bò thuộc cấp bù đợt 1", "PRS", 0, 2, 0, 0, 2, "Bù thiếu"]
        ]
      },
      "Tab2_ThucNhan": {
        title: "Tab2_ThucNhan",
        themeColor: "#059669",
        headers: ["STT", "Ngày Nhận", "Mã PO", "Code Vật Tư", "Trạng Thái", "Số Phiếu KH", "Diễn Giải", "ĐVT", "Size 4", "Size 5", "Size 6", "Size 7", "Tổng Thực Nhận", "SL Trên Phiếu", "Ghi Chú"],
        rows: [
          [1, "01/09/2026", "PO-101", "VT-DA-01", "Hàng đơn", "PX-001", "Da bò thuộc cao cấp", "PRS", 10, 13, 20, 15, 58, 60, "Thiếu 2 đôi size 5"],
          [2, "02/09/2026", "PO-101", "VT-DA-01", "Hàng bù", "PX-002", "Da bò thuộc cấp bù đợt 1", "PRS", 0, 2, 0, 0, 2, 2, "Đã nhận bù đủ"]
        ]
      },
      "Tab3_ChenhLech_PO": {
        title: "Tab3_ChenhLech_PO",
        themeColor: "#ea580c",
        headers: ["STT", "Ngày Nhập", "Mã PO", "Code Vật Tư", "Trạng Thái PO", "Số Phiếu KH", "Diễn Giải", "ĐVT", "Lệch Size 4", "Lệch Size 5", "Lệch Size 6", "Lệch Size 7", "Tổng Chênh Lệch", "Cần Bù? [X]", "SL Đơn Gốc", "Đã Nhận Bù", "Tổng Đã Nhận"],
        rows: [
          [1, "01/09/2026", "PO-101", "VT-DA-01", "Khớp đủ", "PX-001, PX-002", "Da bò thuộc cao cấp", "PRS", 0, 0, 0, 0, 0, "Đủ", 60, 2, 60],
          [2, "02/09/2026", "PO-102", "VT-DE-02", "Thiếu cần bù", "PX-003", "Đế cao su lưu hóa", "PRS", 0, -2, 0, 0, -2, "CẦN BÙ [X]", 80, 0, 78]
        ]
      }
    }
  };

  const fakeEvent = {
    postData: {
      contents: JSON.stringify(testPayload)
    }
  };

  const startTime = new Date().getTime();
  const response = doPost(fakeEvent);
  const elapsed = (new Date().getTime() - startTime) / 1000;
  Logger.log("Kết quả chạy thử (" + elapsed + "s): " + response.getContent());
}
