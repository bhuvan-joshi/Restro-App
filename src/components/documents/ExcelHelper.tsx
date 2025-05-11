import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { PDFDocument, rgb } from 'pdf-lib';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, Download, Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface ExcelHelperProps {
  file: File;
  onConversionComplete: (pdfFile: File) => void;
  onCancel: () => void;
}

const ExcelHelper: React.FC<ExcelHelperProps> = ({ file, onConversionComplete, onCancel }) => {
  const [status, setStatus] = useState<'idle' | 'converting' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const processExcelData = (workbook: XLSX.WorkBook) => {
    let processedData = '';
    
    // Process each sheet
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      
      // Get the range of the sheet
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      
      // Add sheet name
      processedData += `Sheet: ${sheetName}\n`;
      processedData += '----------------------------------------\n';
      
      // Process headers (first row)
      let headers = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
        const cell = worksheet[cellAddress];
        const headerValue = cell ? XLSX.utils.format_cell(cell) : '';
        headers.push(headerValue);
      }
      
      // Process data rows with header context
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const rowData: { [key: string]: string } = {};
        
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const cellValue = cell ? XLSX.utils.format_cell(cell) : '';
          
          if (col < headers.length) {
            rowData[headers[col]] = cellValue;
          }
        }
        
        // Output row data with headers
        for (const header of headers) {
          processedData += `${header}: ${rowData[header] || ''}\n`;
        }
        processedData += '----------------------------------------\n';
      }
      processedData += '\n';
    });
    
    return processedData;
  };

  const convertToPdf = async () => {
    try {
      setStatus('converting');
      setProgress(10);

      // Read the Excel file
      const arrayBuffer = await file.arrayBuffer();
      setProgress(30);

      // Parse with xlsx
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      setProgress(50);

      // Process Excel data for better structure preservation
      const processedData = processExcelData(workbook);

      // Create a PDF document
      const pdfDoc = await PDFDocument.create();
      
      // Create pages with processed data
      const lines = processedData.split('\n');
      let currentPage = pdfDoc.addPage([595, 842]); // A4 size
      let yPos = currentPage.getHeight() - 50;
      const fontSize = 10;
      const lineHeight = fontSize * 1.2;
      
      for (const line of lines) {
        if (yPos < 50) {
          currentPage = pdfDoc.addPage([595, 842]);
          yPos = currentPage.getHeight() - 50;
        }
        
        if (line.startsWith('Sheet:')) {
          // Sheet header
          currentPage.drawText(line, {
            x: 50,
            y: yPos,
            size: 14,
          color: rgb(0, 0, 0),
        });
          yPos -= lineHeight * 1.5;
        } else if (line.startsWith('----')) {
          // Separator line
          yPos -= lineHeight * 0.5;
        } else if (line.trim()) {
          // Regular data line
          currentPage.drawText(line, {
            x: 50,
            y: yPos,
                size: fontSize,
                color: rgb(0, 0, 0),
              });
          yPos -= lineHeight;
        } else {
          // Empty line
          yPos -= lineHeight * 0.5;
        }
      }
      
      setProgress(80);
      
      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfFile = new File([pdfBlob], `${file.name.replace(/\.(xlsx|xls)$/i, '')}.pdf`, { type: 'application/pdf' });
      
      setProgress(100);
      setStatus('success');
      
      // Wait a moment to show the success state before completing
      setTimeout(() => {
        onConversionComplete(pdfFile);
      }, 1000);
      
    } catch (error) {
      console.error('Error converting Excel to PDF:', error);
      setErrorMessage(error.message || 'Failed to convert Excel file to PDF');
      setStatus('error');
    }
  };

  return (
    <div className="p-4 border rounded-md bg-gray-50">
      <div className="flex items-center space-x-2 mb-4">
        <FileText className="h-5 w-5 text-amber-500" />
        <h3 className="font-medium">Excel File Processing</h3>
      </div>
      
      <Alert className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Excel Processing Information</AlertTitle>
        <AlertDescription>
          The file will be processed to preserve data structure and relationships.
          This ensures better compatibility with AI analysis.
        </AlertDescription>
      </Alert>
      
      {status === 'converting' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Processing Excel data...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
      
      {status === 'error' && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Processing Failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex space-x-2">
        {status === 'idle' && (
          <>
            <Button onClick={convertToPdf}>
              <Download className="mr-2 h-4 w-4" />
              Process Excel
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
        
        {status === 'converting' && (
          <Button disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </Button>
        )}
        
        {status === 'success' && (
          <Button disabled className="bg-green-600">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Completing...
          </Button>
        )}
        
        {status === 'error' && (
          <>
            <Button onClick={convertToPdf}>
              <Download className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExcelHelper; 