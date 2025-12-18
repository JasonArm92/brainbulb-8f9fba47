import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface InvoiceData {
  invoiceNumber: string;
  clientName: string;
  description: string;
  amount: number;
  paymentDate: string;
  status: string;
}

export function generateInvoicePDF(data: InvoiceData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 30, 30);
  doc.rect(0, 0, pageWidth, 50, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 20, 30);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.invoiceNumber || 'INV-001', pageWidth - 20, 30, { align: 'right' });

  // Company info
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text('BrainBulb Design Studio', 20, 65);
  doc.text('jasonarm82@gmail.com', 20, 72);

  // Invoice date
  doc.text(`Date: ${new Date(data.paymentDate).toLocaleDateString('en-GB')}`, pageWidth - 20, 65, { align: 'right' });
  doc.text(`Status: ${data.status.toUpperCase()}`, pageWidth - 20, 72, { align: 'right' });

  // Bill to
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 20, 95);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(data.clientName, 20, 105);

  // Table header
  const tableTop = 130;
  doc.setFillColor(245, 245, 245);
  doc.rect(20, tableTop, pageWidth - 40, 12, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('Description', 25, tableTop + 8);
  doc.text('Amount', pageWidth - 25, tableTop + 8, { align: 'right' });

  // Table row
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(data.description, 25, tableTop + 22);
  doc.text(`£${data.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, pageWidth - 25, tableTop + 22, { align: 'right' });

  // Line
  doc.setDrawColor(200, 200, 200);
  doc.line(20, tableTop + 30, pageWidth - 20, tableTop + 30);

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL', 25, tableTop + 45);
  doc.setFontSize(14);
  doc.text(`£${data.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, pageWidth - 25, tableTop + 45, { align: 'right' });

  // Footer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Thank you for your business!', pageWidth / 2, 250, { align: 'center' });
  doc.text('Payment terms: Due upon receipt', pageWidth / 2, 258, { align: 'center' });

  // Save
  doc.save(`invoice-${data.invoiceNumber || 'draft'}.pdf`);
}

interface InvoiceButtonProps {
  entry: {
    invoice_number: string | null;
    client_name: string;
    description: string;
    amount: number;
    payment_date: string;
    status: string;
  };
}

export function InvoiceButton({ entry }: InvoiceButtonProps) {
  const handleGenerate = () => {
    generateInvoicePDF({
      invoiceNumber: entry.invoice_number || `INV-${Date.now()}`,
      clientName: entry.client_name,
      description: entry.description,
      amount: entry.amount,
      paymentDate: entry.payment_date,
      status: entry.status,
    });
  };

  return (
    <Button size="sm" variant="ghost" onClick={handleGenerate} title="Download Invoice">
      <FileText className="h-4 w-4" />
    </Button>
  );
}
