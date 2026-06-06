/**
 * Google Sheets Web App Backend - SheetSync Analytics
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create a new Google Sheet at https://sheets.google.com
 * 2. Click Extensions -> Apps Script
 * 3. Replace ALL code in the script editor with this code
 * 4. Click "Deploy" -> "New deployment"
 * 5. Choose type: "Web app"
 * 6. Set settings:
 *    - Description: "SheetSync Analytics API"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (crucial for CORS)
 * 7. Click Deploy, authorize permissions, and copy the "Web app URL"
 * 8. Paste the URL into your SheetSync app settings (gear icon)
 * 
 * The script will automatically create the "Data" sheet with headers on first use!
 */

// Configuration
const SHEET_NAME = "Data";
const HEADERS = ["Timestamp", "Field A", "Field B", "Field C"];

/**
 * Handle HTTP GET Requests - Fetches all records from Google Sheet
 */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    
    // Ensure headers exist
    ensureHeaders(sheet, data);
    
    // If empty or only header
    if (data.length <= 1) {
      return makeJsonResponse({
        status: "success",
        message: "No data records found",
        data: []
      });
    }
    
    const headers = data[0];
    const records = [];
    
    // Parse rows starting from row 2 (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const record = {};
      
      // Map columns by header name
      for (let j = 0; j < headers.length; j++) {
        const headerName = headers[j].toString().trim();
        let cellValue = row[j];
        
        // Handle empty cells
        if (cellValue === "" || cellValue === null || cellValue === undefined) {
          cellValue = headerName === "Field B" ? 0 : "";
        }
        
        // Format timestamp
        if (headerName === "Timestamp") {
          if (cellValue instanceof Date) {
            record.timestamp = cellValue.toISOString();
          } else if (typeof cellValue === "string") {
            record.timestamp = cellValue;
          } else {
            record.timestamp = new Date(cellValue).toISOString();
          }
        } 
        // Field A (text)
        else if (headerName === "Field A") {
          record.fieldA = cellValue.toString().trim();
        } 
        // Field B (number)
        else if (headerName === "Field B") {
          const numValue = Number(cellValue);
          record.fieldB = isNaN(numValue) ? 0 : numValue;
        } 
        // Field C (text)
        else if (headerName === "Field C") {
          record.fieldC = cellValue ? cellValue.toString().trim() : "";
        }
      }
      
      // Only include non-empty records
      if (record.timestamp || record.fieldA) {
        records.push(record);
      }
    }
    
    // Sort by timestamp (most recent first)
    records.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    return makeJsonResponse({
      status: "success",
      message: "Data retrieved successfully",
      data: records,
      count: records.length
    });
    
  } catch (error) {
    return makeJsonResponse({
      status: "error",
      message: "GET Error: " + error.toString()
    }, 500);
  }
}

/**
 * Handle HTTP POST Requests - Saves new data record to Google Sheet
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return makeJsonResponse({
        status: "error",
        message: "Bad Request: No post data received"
      }, 400);
    }
    
    // Parse JSON payload
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return makeJsonResponse({
        status: "error",
        message: "Bad Request: Invalid JSON - " + parseError.toString()
      }, 400);
    }
    
    // Validate and sanitize inputs
    const validation = validateAndSanitize(payload);
    if (!validation.valid) {
      return makeJsonResponse({
        status: "error",
        message: validation.error
      }, 400);
    }
    
    // Get or create sheet
    const sheet = getOrCreateSheet();
    ensureHeaders(sheet, sheet.getDataRange().getValues());
    
    // Create new row
    const timestamp = new Date();
    const newRow = [
      timestamp,
      validation.fieldA,
      validation.fieldB,
      validation.fieldC
    ];
    
    // Append to sheet
    sheet.appendRow(newRow);
    
    return makeJsonResponse({
      status: "success",
      message: "Data saved successfully",
      data: {
        timestamp: timestamp.toISOString(),
        fieldA: validation.fieldA,
        fieldB: validation.fieldB,
        fieldC: validation.fieldC
      }
    });
    
  } catch (error) {
    return makeJsonResponse({
      status: "error",
      message: "POST Error: " + error.toString()
    }, 500);
  }
}

/**
 * Get or create the Data sheet with headers
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    // Create new sheet
    sheet = ss.insertSheet(SHEET_NAME);
    
    // Add headers
    sheet.appendRow(HEADERS);
    
    // Format header row
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4f46e5");
    headerRange.setFontColor("#ffffff");
    headerRange.setBorder(true, true, true, true, true, true);
    
    // Auto-resize columns
    for (let i = 1; i <= HEADERS.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

/**
 * Ensure headers exist in the sheet
 * If the sheet exists but has no headers, add them
 */
function ensureHeaders(sheet, currentData) {
  // If sheet is empty, add headers
  if (!currentData || currentData.length === 0) {
    sheet.appendRow(HEADERS);
    
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4f46e5");
    headerRange.setFontColor("#ffffff");
    headerRange.setBorder(true, true, true, true, true, true);
    
    for (let i = 1; i <= HEADERS.length; i++) {
      sheet.autoResizeColumn(i);
    }
    
    sheet.setFrozenRows(1);
    return;
  }
  
  // Check if first row looks like data, not headers
  const firstRow = currentData[0];
  const isHeaderRow = HEADERS.every((header, index) => {
    const cellValue = firstRow[index];
    return cellValue && cellValue.toString().trim() === header;
  });
  
  // If first row is not headers, insert headers at top
  if (!isHeaderRow) {
    sheet.insertRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4f46e5");
    headerRange.setFontColor("#ffffff");
    headerRange.setBorder(true, true, true, true, true, true);
    
    sheet.setFrozenRows(1);
  }
}

/**
 * Validate and sanitize all input fields
 */
function validateAndSanitize(payload) {
  // Field A (required, text)
  if (!payload.fieldA || payload.fieldA.toString().trim() === "") {
    return {
      valid: false,
      error: "Validation Error: Field A is required"
    };
  }
  
  let fieldA = sanitizeInput(payload.fieldA.toString().trim());
  if (fieldA.length > 250) {
    return {
      valid: false,
      error: "Validation Error: Field A cannot exceed 250 characters"
    };
  }
  
  // Field B (required, number)
  if (payload.fieldB === undefined || payload.fieldB === null) {
    return {
      valid: false,
      error: "Validation Error: Field B is required"
    };
  }
  
  const fieldB = Number(payload.fieldB);
  if (isNaN(fieldB)) {
    return {
      valid: false,
      error: "Validation Error: Field B must be a valid number"
    };
  }
  
  // Field C (optional, text)
  let fieldC = sanitizeInput(
    payload.fieldC ? payload.fieldC.toString().trim() : ""
  );
  if (fieldC.length > 500) {
    return {
      valid: false,
      error: "Validation Error: Field C cannot exceed 500 characters"
    };
  }
  
  return {
    valid: true,
    fieldA: fieldA,
    fieldB: fieldB,
    fieldC: fieldC
  };
}

/**
 * Sanitize input to prevent HTML/script injection in display
 */
function sanitizeInput(str) {
  if (!str || typeof str !== "string") return "";
  
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Create standardized JSON response with CORS support
 */
function makeJsonResponse(responseObj, statusCode) {
  const jsonString = JSON.stringify(responseObj, null, 2);
  
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}
