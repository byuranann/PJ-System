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
 * Initialize sheet on first deployment
 * This runs once when you first deploy the script
 */
function onOpen() {
  initializeSheet();
}

/**
 * Initialize the sheet with headers
 */
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  // Create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  
  // Check if sheet is empty or has no headers
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) {
    // Sheet is completely empty - add headers
    sheet.appendRow(HEADERS);
    formatHeaders(sheet);
  } else {
    // Check if first row is headers
    const firstRow = data[0];
    const hasHeaders = HEADERS.every((header, index) => {
      const cellValue = firstRow[index];
      return cellValue && cellValue.toString().trim() === header;
    });
    
    // If no headers, insert them at the top
    if (!hasHeaders) {
      sheet.insertRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      formatHeaders(sheet);
    }
  }
}

/**
 * Format the header row with styling
 */
function formatHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  
  // Apply formatting
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#4f46e5");
  headerRange.setFontColor("#ffffff");
  headerRange.setFontSize(11);
  headerRange.setBorder(true, true, true, true, true, true);
  headerRange.setHorizontalAlignment("center");
  
  // Auto-resize columns
  for (let i = 1; i <= HEADERS.length; i++) {
    sheet.autoResizeColumn(i);
  }
  
  // Freeze header row
  sheet.setFrozenRows(1);
}

/**
 * Handle HTTP GET Requests - Fetches all records from Google Sheet
 */
function doGet(e) {
  try {
    initializeSheet(); // Ensure headers exist
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return makeJsonResponse({
        status: "error",
        message: "Sheet not found"
      }, 404);
    }
    
    const data = sheet.getDataRange().getValues();
    
    // If empty or only header
    if (data.length <= 1) {
      return makeJsonResponse({
        status: "success",
        message: "No data records found",
        data: [],
        count: 0
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
        const headerName = headers[j] ? headers[j].toString().trim() : "";
        let cellValue = row[j] || "";
        
        // Format timestamp
        if (headerName === "Timestamp") {
          if (cellValue instanceof Date) {
            record.timestamp = cellValue.toISOString();
          } else if (typeof cellValue === "string" && cellValue) {
            record.timestamp = cellValue;
          } else if (cellValue) {
            record.timestamp = new Date(cellValue).toISOString();
          } else {
            record.timestamp = "";
          }
        } 
        // Field A (text)
        else if (headerName === "Field A") {
          record.fieldA = cellValue ? cellValue.toString().trim() : "";
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
      
      // Only include records that have at least a timestamp or fieldA
      if (record.timestamp || record.fieldA) {
        records.push(record);
      }
    }
    
    // Sort by timestamp (most recent first)
    records.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    
    return makeJsonResponse({
      status: "success",
      message: "Data retrieved successfully",
      data: records,
      count: records.length
    });
    
  } catch (error) {
    Logger.log("GET Error: " + error.toString());
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
    // Initialize sheet before saving
    initializeSheet();
    
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
    
    // Get sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return makeJsonResponse({
        status: "error",
        message: "Sheet not found"
      }, 404);
    }
    
    // Create new row with data
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
    Logger.log("POST Error: " + error.toString());
    return makeJsonResponse({
      status: "error",
      message: "POST Error: " + error.toString()
    }, 500);
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
  if (payload.fieldB === undefined || payload.fieldB === null || payload.fieldB === "") {
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
