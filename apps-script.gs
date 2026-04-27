// Google Apps Script — incrementar contador de la columna E (veces)
// Pega este código en tu hoja: Extensiones → Apps Script → pegar → Implementar

function doGet(e) {
  const row = Number(e.parameter.row);

  if (!row || row < 2) {
    return jsonResponse({ error: 'fila no válida' });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const cell = sheet.getRange(row, 5); // columna E = veces
  const current = Number(cell.getValue()) || 0;
  cell.setValue(current + 1);

  return jsonResponse({ veces: current + 1 });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
