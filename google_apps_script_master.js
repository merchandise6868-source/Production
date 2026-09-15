/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT: MASTER HUB SAO LƯU DỮ LIỆU KHO ĐA CÔNG TY
 * DỰ ÁN: HỆ THỐNG QUẢN LÝ KHO SẢN XUẤT - D&D LONG AN
 * ==============================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT 2 PHÚT (CHỈ CẦN LÀM 1 LẦN DUY NHẤT):
 * 1. Mở Google Drive của bạn (https://drive.google.com).
 * 2. Bấm "Mới" (+) -> Chọn "Ứng dụng khác" -> "Google Apps Script".
 * 3. Xóa toàn bộ mã mặc định và dán toàn bộ đoạn mã này vào.
 * 4. Bấm "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 * 5. Mục "Chọn loại" -> Chọn "Ứng dụng web" (Web App).
 * 6. Cấu hình:
 *    - Mô tả: Master Hub Backup Kho
 *    - Thực thi dưới dạng: "Tôi" (Me)
 *    - Ai có quyền truy cập: "Bất kỳ ai" (Anyone)
 * 7. Bấm "Triển khai" (Deploy) -> Cấp quyền truy cập nếu Google hỏi -> Sao chép "URL của ứng dụng web".
 * 8. Dán URL này vào mục "Cấu hình Webhook" trên trang web quản lý kho.
 * ==============================================================================
 */

// Tên thư mục gốc lưu trữ trên Google Drive
const ROOT_FOLDER_NAME = "HỆ THỐNG KHO D&D LONG AN - DỮ LIỆU SAO LƯU";

/**
 * Xử lý kiểm tra kết nối (GET Request)
 */
function doGet(e) {
  const result = {
    status: "ok",
    service: "Master Hub Backup Kho D&D Long An",
    timestamp: new Date().toLocaleString("vi-VN"),
    message: "Google Apps Script Master Hub đang hoạt động bình thường!"
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý sao lưu dữ liệu (POST Request)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Dữ liệu payload trống!" });
    }

    const payload = JSON.parse(e.postData.contents);
    const companyId = payload.companyId || "default";
    const companyName = payload.companyName || "Công Ty";
    const sheetsData = payload.sheets || {};
    const timestamp = payload.timestamp || new Date().toLocaleString("vi-VN");

    // 1. Tìm hoặc tự động tạo thư mục lưu trữ trên Google Drive
    const targetFolder = getOrCreateFolder(ROOT_FOLDER_NAME);

    // 2. Tìm hoặc tự động tạo File Google Sheet riêng cho công ty này
    const spreadsheet = getOrCreateCompanySpreadsheet(targetFolder, companyName);
    const spreadsheetUrl = spreadsheet.getUrl();
    const spreadsheetId = spreadsheet.getId();

    const updatedSheetNames = [];

    // 3. Cập nhật từng Sheet tương ứng với từng Tab trên Web
    for (const [sheetKey, sheetObj] of Object.entries(sheetsData)) {
      const sheetName = sheetObj.title || sheetKey;
      const headers = sheetObj.headers || [];
      const rows = sheetObj.rows || [];
      const headerColor = sheetObj.themeColor || "#1e3a8a";

      updateOrCreateSheet(spreadsheet, sheetName, headers, rows, headerColor);
      updatedSheetNames.push(sheetName);
    }

    // 4. Ghi nhận nhật ký sao lưu vào Sheet cuối cùng
    updateBackupLogSheet(spreadsheet, companyName, timestamp, updatedSheetNames.length);

    // Xóa Sheet mặc định "Sheet1" nếu có và đã có sheet dữ liệu khác
    cleanupDefaultSheet(spreadsheet);

    return createJsonResponse({
      success: true,
      message: "Đã sao lưu thành công " + updatedSheetNames.length + " sheet cho công ty " + companyName,
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
 * Tìm hoặc tạo file Google Sheet cho từng công ty trong thư mục Drive
 */
function getOrCreateCompanySpreadsheet(folder, companyName) {
  const expectedFileName = "[KHO] - Báo Cáo - " + companyName.trim();
  const files = folder.getFilesByName(expectedFileName);

  if (files.hasNext()) {
    const file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }

  // Nếu chưa có, tạo mới file Google Sheet và chuyển vào thư mục quy định
  const newSheet = SpreadsheetApp.create(expectedFileName);
  const file = DriveApp.getFileById(newSheet.getId());
  folder.addFile(file);
  DriveApp.getRootFolder().removeFile(file);
  return newSheet;
}

/**
 * Cập nhật nội dung và định dạng cho 1 Sheet
 */
function updateOrCreateSheet(spreadsheet, sheetName, headers, rows, headerColor) {
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

  // Định dạng dòng tiêu đề (Header)
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

  // Tự động căn chỉnh độ rộng cột
  for (let c = 1; c <= totalCols; c++) {
    sheet.autoResizeColumn(c);
    const w = sheet.getColumnWidth(c);
    if (w < 80) sheet.setColumnWidth(c, 80);
    if (w > 260) sheet.setColumnWidth(c, 260);
  }
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
    sheet.setFrozenRows(1);
  }

  const lastRow = sheet.getLastRow();
  const newStt = lastRow;
  sheet.appendRow([newStt, timestamp, companyName, sheetCount + " Sheets"]);
  sheet.autoResizeColumns(1, 4);
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
