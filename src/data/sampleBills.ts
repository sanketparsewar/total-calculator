export interface SampleBillItem {
  name: string;
  qty?: string;
  rate?: string;
  amount: string; // e.g. "125.00"
  amountPaise: number;
}

export interface SampleBill {
  id: string;
  title: string;
  type: 'notebook' | 'restaurant' | 'table';
  hasGrandTotal: boolean;
  grandTotalText?: string;
  groundTruthTotalPaise: number;
  groundTruthFormatted: string;
  items: SampleBillItem[];
}

export const SAMPLE_BILLS: SampleBill[] = [
  {
    id: 'grocery-notebook',
    title: 'Indian Grocery Notebook Bill (17 items)',
    type: 'notebook',
    hasGrandTotal: false,
    groundTruthTotalPaise: 39750,
    groundTruthFormatted: '₹397.50',
    items: [
      { name: 'Atta 5kg', amount: '125.00', amountPaise: 12500 },
      { name: 'Sugar 1kg', amount: '46.00', amountPaise: 4600 },
      { name: 'Toor Dal', amount: '35.00', amountPaise: 3500 },
      { name: 'Mustard Oil', amount: '20.00', amountPaise: 2000 },
      { name: 'Lifebuoy Soap', amount: '17.00', amountPaise: 1700 },
      { name: 'Red Label Tea', amount: '10.50', amountPaise: 1050 },
      { name: 'Parle-G Biscuit', amount: '9.50', amountPaise: 950 },
      { name: 'Cow Ghee 50g', amount: '12.00', amountPaise: 1200 },
      { name: 'Basmati Rice', amount: '31.00', amountPaise: 3100 },
      { name: 'Tata Salt', amount: '23.00', amountPaise: 2300 },
      { name: 'Garam Masala', amount: '7.50', amountPaise: 750 },
      { name: 'Matchbox pkt', amount: '2.50', amountPaise: 250 },
      { name: 'Colgate Paste', amount: '32.00', amountPaise: 3200 },
      { name: 'Rin Detergent', amount: '6.00', amountPaise: 600 },
      { name: 'Lays Chips', amount: '8.50', amountPaise: 850 },
      { name: 'Dairy Milk', amount: '8.00', amountPaise: 800 },
      { name: 'Maggi 2-min', amount: '4.00', amountPaise: 400 },
    ],
  },
  {
    id: 'restaurant-receipt',
    title: 'Restaurant Receipt with Grand Total & Duplicate Price',
    type: 'restaurant',
    hasGrandTotal: true,
    grandTotalText: 'Total: 590.00',
    groundTruthTotalPaise: 59000,
    groundTruthFormatted: '₹590.00',
    items: [
      { name: 'Paneer Tikka', amount: '180.00', amountPaise: 18000 },
      { name: 'Butter Naan', amount: '45.00', amountPaise: 4500 },
      { name: 'Butter Naan', amount: '45.00', amountPaise: 4500 }, // Identical price on distinct row!
      { name: 'Dal Makhani', amount: '160.00', amountPaise: 16000 },
      { name: 'Jeera Rice', amount: '110.00', amountPaise: 11000 },
      { name: 'Gulab Jamun', amount: '50.00', amountPaise: 5000 },
    ],
  },
  {
    id: 'table-invoice',
    title: 'Multi-Column Bill (Qty, Rate, Amount)',
    type: 'table',
    hasGrandTotal: true,
    grandTotalText: 'Grand Total: 195.00',
    groundTruthTotalPaise: 19500,
    groundTruthFormatted: '₹195.00',
    items: [
      { name: 'Onion', qty: '2 kg', rate: '30', amount: '60.00', amountPaise: 6000 },
      { name: 'Potato', qty: '3 kg', rate: '25', amount: '75.00', amountPaise: 7500 },
      { name: 'Tomato', qty: '1 kg', rate: '40', amount: '40.00', amountPaise: 4000 },
      { name: 'Ginger', qty: '250 gm', rate: '20', amount: '20.00', amountPaise: 2000 },
    ],
  },
];

/**
 * Render a sample bill onto an HTML canvas simulating a realistic paper document.
 */
export function renderSampleBillToCanvas(bill: SampleBill, width: number = 720, height: number = 960): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Paper background with warm off-white / light cream tone
  ctx.fillStyle = '#FDFCF7';
  ctx.fillRect(0, 0, width, height);

  // Subtle paper texture / faint margin line
  ctx.strokeStyle = '#F3E8FF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 0);
  ctx.lineTo(60, height);
  ctx.stroke();

  // Horizontal notebook lines if notebook bill
  if (bill.type === 'notebook') {
    ctx.strokeStyle = 'rgba(219, 234, 254, 0.6)'; // faint blue notebook ruled lines
    ctx.lineWidth = 1;
    for (let y = 100; y < height - 60; y += 38) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  // Header
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(bill.type === 'restaurant' ? 'SHREE KRISHNA RESTAURANT' : 'KIRANA STORE BILL', 80, 55);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(`Date: 14/10/2026   Bill No: 104`, 80, 80);

  // Column header
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 16px sans-serif';
  if (bill.type === 'table') {
    ctx.fillText('Items', 80, 120);
    ctx.fillText('Qty', 320, 120);
    ctx.fillText('Rate', 440, 120);
    ctx.fillText('Amount (Rs)', 560, 120);
  } else {
    ctx.fillText('Particulars', 80, 120);
    ctx.fillText('Amount Rs.', 540, 120);
  }

  // Divider line
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, 132);
  ctx.lineTo(width - 40, 132);
  ctx.stroke();

  // Draw Items
  let startY = 165;
  const rowHeight = bill.type === 'notebook' ? 38 : 45;

  ctx.fillStyle = '#0F172A'; // Dark handwritten ink color
  ctx.font = '500 18px "Courier New", monospace, sans-serif';

  bill.items.forEach((item) => {
    // Left: item name
    ctx.fillText(item.name, 80, startY);

    if (bill.type === 'table') {
      if (item.qty) ctx.fillText(item.qty, 320, startY);
      if (item.rate) ctx.fillText(item.rate, 440, startY);
    }

    // Rightmost amount column
    ctx.font = 'bold 19px "Courier New", monospace, sans-serif';
    ctx.fillText(item.amount, 550, startY);
    ctx.font = '500 18px "Courier New", monospace, sans-serif';

    startY += rowHeight;
  });

  // Grand total if present
  if (bill.hasGrandTotal && bill.grandTotalText) {
    startY += 15;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(350, startY - 18);
    ctx.lineTo(width - 40, startY - 18);
    ctx.stroke();

    ctx.font = 'bold 21px sans-serif';
    ctx.fillStyle = '#B91C1C';
    ctx.fillText(bill.grandTotalText, 390, startY + 12);

    ctx.beginPath();
    ctx.moveTo(350, startY + 22);
    ctx.lineTo(width - 40, startY + 22);
    ctx.stroke();
  }

  return canvas;
}
