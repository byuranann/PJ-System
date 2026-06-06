/**
 * Google Sheets Web App Backend
 * 
 * Instructions:
 * 1. Create a new Google Sheet.
 * 2. In the sheet, rename the first sheet tab to "Data" (without quotes).
 * 3. Add headers in Row 1:
 *    - Column A: Timestamp
 *    - Column B: Field A
 *    - Column C: Field B
 *    - Column D: Field C
 * 4. Click Extensions -> Apps Script.
 * 5. Replace all code in the script editor with this code.
 * 6. Click "Deploy" -> "New deployment".
 * 7. Choose type: "Web app".
 * 8. Set settings:
 *    - Description: "Analytics Backend"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (crucial for API requests from the dashboard)
 * 9. Click Deploy, authorize permissions, and copy the "Web app URL".
 * 10. Paste this URL into your application's settings.
 */

// Configuration
var SHEET_NAME = "Data";

/**
 * Handle HTTP GET Requests - Fetches all records from Google Sheet
 */
function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    
    // If empty or only header
    if (data.length <= 1) {
      return makeJsonResponse({
        status: "success",
        data: []
      });
    }
    
    var headers = data[0];
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var record = {};
      
      // Clean mapping based on header columns
      for (var j = 0; j < headers.length; j++) {
        var header = headers[j].toString().trim();
        var cellValue = row[j];
        
        // Format timestamp safely
        if (header === "Timestamp" && cellValue instanceof Date) {
          record.timestamp = cellValue.toISOString();
        } else if (header === "Field A") {
          record.fieldA = cellValue.toString();
        } else if (header === "Field B") {
          record.fieldB = Number(cellValue);
        } else if (header === "Field C") {
          record.fieldC = cellValue ? cellValue.toString() : "";
        }
      }
      records.push(record);
    }
    
    // Sort records by timestamp descending (most recent first)
    records.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    return makeJsonResponse({
      status: "success",
      data: records
    });
    
  } catch (error) {
    return makeJsonResponse({
      status: "error",
      message: error.toString()
    }, 500);
  }
}

/**
 * Handle HTTP POST Requests - Saves new data record to Google Sheet
 */
function doPost(e) {
  // Set up CORS preflight headers or output response
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return makeJsonResponse({
        status: "error",
        message: "Bad Request: No post data received."
      }, 400);
    }
    
    // Parse input
    var payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return makeJsonResponse({
        status: "error",
        message: "Bad Request: Invalid JSON formatting."
      }, 400);
    }
    
    // Validation
    var fieldA = payload.fieldA;
    var fieldB = payload.fieldB;
    var fieldC = payload.fieldC || "";
    
    // Field A Validation
    if (fieldA === undefined || fieldA === null || fieldA.toString().trim() === "") {
      return makeJsonResponse({
        status: "error",
        message: "Validation Error: Field A is required and cannot be empty."
      }, 400);
    }
    fieldA = sanitizeInput(fieldA.toString().trim());
    if (fieldA.length > 250) {
      return makeJsonResponse({
        status: "error",
        message: "Validation Error: Field A cannot exceed 250 characters."
      }, 400);
    }
    
    // Field B Validation
    if (fieldB === undefined || fieldB === null) {
      return makeJsonResponse({
        status: "error",
        message: "Validation Error: Field B is required."
      }, 400);
    }
    var numB = Number(fieldB);
    if (isNaN(numB)) {
      return makeJsonResponse({
        status: "error",
        message: "Validation Error: Field B must be a valid number."
      }, 400);
    }
    
    // Field C Validation
    fieldC = sanitizeInput(fieldC.toString().trim());
    if (fieldC.length > 500) {
      return makeJsonResponse({
        status: "error",
        message: "Validation Error: Field C cannot exceed 500 characters."
      }, 400);
    }
    
    // Append to sheet
    var sheet = getOrCreateSheet();
    var timestamp = new Date();
    
    sheet.appendRow([
      timestamp,
      fieldA,
      numB,
      fieldC
    ]);
    
    return makeJsonResponse({
      status: "success",
      message: "Data saved successfully.",
      data: {
        timestamp: timestamp.toISOString(),
        fieldA: fieldA,
        fieldB: numB,
        fieldC: fieldC
      }
    });
    
  } catch (error) {
    return makeJsonResponse({
      status: "error",
      message: "Server Error: " + error.toString()
    }, 500);
  }
}

/**
 * Helper: Get sheet or create it if it doesn't exist
 */
function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    sheet.appendRow(["Timestamp", "Field A", "Field B", "Field C"]);
    
    // Style headers
    var headerRange = sheet.getRange(1, 1, 1, 4);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#f3f4f6");
    headerRange.setBorder(true, true, true, true, true, true);
    
    // Freeze header row
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Helper: Sanitize string to prevent basic code injection when viewed
 */
function sanitizeInput(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Helper: Standardized JSON CORS-ready Response
 */
function makeJsonResponse(responseObj, statusCode) {
  var jsonString = JSON.stringify(responseObj);
  
  // CORS handling in Google Apps Script is done by returning a text output
  // of JSON mime type. Native browser redirect handles access headers.
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}
