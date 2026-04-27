// Google Apps Script — gestionar dinámicas (increment veces) y usuarios (selecciones)
// Pega este código en tu hoja: Extensiones → Apps Script → pegar → Implementar

function doGet(e) {
  const action = e.parameter.action || 'increment';

  if (action === 'increment') {
    return incrementVeces(e);
  }
  if (action === 'markUser') {
    return markUserSelected(e);
  }
  if (action === 'resetUsers') {
    return resetUserSelections();
  }

  return jsonResponse({ error: 'acción desconocida' });
}

function incrementVeces(e) {
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

function markUserSelected(e) {
  const userName = e.parameter.name;
  
  if (!userName) {
    return jsonResponse({ error: 'nombre de usuario requerido' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('usuarios');
  if (!sheet) {
    return jsonResponse({ error: 'hoja usuarios no encontrada' });
  }

  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    if ((values[i][0] + '').trim() === userName) {
      sheet.getRange(i + 2, 2).setValue(1);
      return jsonResponse({ marked: userName });
    }
  }

  return jsonResponse({ error: 'usuario no encontrado' });
}

function resetUserSelections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('usuarios');
  if (!sheet) {
    return jsonResponse({ error: 'hoja usuarios no encontrada' });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ reset: 0 });
  }

  const range = sheet.getRange(2, 2, lastRow - 1, 1);
  range.clearContent();

  return jsonResponse({ reset: lastRow - 1 });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
