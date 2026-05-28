
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportMultiSheetExcel = (sheets: { data: any[], name: string }[], fileName: string) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data);
    
    // Auto-fit column widths to ensure organized, professional layout
    if (sheet.data && sheet.data.length > 0) {
      const keys = Object.keys(sheet.data[0]);
      const wscols = keys.map(key => {
        let maxLen = key.toString().length;
        sheet.data.forEach(row => {
          const val = row[key];
          if (val !== undefined && val !== null) {
            const len = val.toString().length;
            if (len > maxLen) maxLen = len;
          }
        });
        // Set optimal width with safety padding (min 10, max 50 for very long text)
        return { wch: Math.min(Math.max(maxLen + 3, 10), 50) };
      });
      worksheet['!cols'] = wscols;
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPDF = (data: any[], title: string, fileName: string) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);
  
  // Prepare table data
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const body = data.map(item => headers.map(header => String(item[header] || '')));
    
    (doc as any).autoTable({
      head: [headers],
      body: body,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] } // Emerald 500
    });
  } else {
    doc.text("Nenhum dado encontrado.", 14, 40);
  }
  
  doc.save(`${fileName}.pdf`);
};
