import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'debug', 'sample-data', 'sales');

const header = [
  'transaction_date',
  'order_id',
  'item_name',
  'line_item_id',
  'quantity',
  'unit_price',
  'total_amount',
  'modifiers',
  'notes',
  'location',
  'server_name',
  'guest_count'
];

const sampleItems = Array.from({ length: 200 }, (_, index) => `Sample Item ${index + 1}`);

const locations = [
  'Main Dining',
  'Patio',
  'Bar',
  'Takeout Window',
  'Private Room'
];

const servers = [
  'Alex Rivera',
  'Jordan Kim',
  'Taylor Morgan',
  'Casey Lopez',
  'Riley Chen'
];

const modifierSets = [
  '',
  'Extra Sauce',
  'No Onions',
  'Add Cheese',
  'Gluten Free',
  'No Salt'
];

const noteVariants = [
  '',
  'VIP guest',
  'Birthday table',
  'Handle with care',
  'Rush order'
];

function formatNumber(value, decimals = 2) {
  return Number.parseFloat(value).toFixed(decimals);
}

function buildRow(index) {
  const itemIndex = index % sampleItems.length;
  const itemName = sampleItems[itemIndex];

  const baseDate = new Date('2025-10-01T11:00:00Z');
  const transactionDate = new Date(baseDate.getTime() + index * 15 * 60 * 1000);
  const transactionIso = transactionDate.toISOString();

  const quantity = (index % 4) + 1;
  const unitPrice = 5 + (itemIndex % 20) * 0.75;
  const totalAmount = quantity * unitPrice;

  const orderId = `ORD-${String(1000 + Math.floor(index / 2)).padStart(4, '0')}`;
  const lineItemId = `LI-${String(index + 1).padStart(6, '0')}`;

  const modifiers = modifierSets[index % modifierSets.length];
  const notes = noteVariants[index % noteVariants.length];
  const location = locations[index % locations.length];
  const server = servers[index % servers.length];
  const guestCount = ((index % 6) + 1).toString();

  return [
    transactionIso,
    orderId,
    itemName,
    lineItemId,
    quantity.toString(),
    formatNumber(unitPrice),
    formatNumber(totalAmount),
    modifiers,
    notes,
    location,
    server,
    guestCount
  ];
}

function buildCsvRow(cells) {
  return cells
    .map((cell) => {
      if (cell === null || cell === undefined) {
        return '';
      }
      const stringValue = String(cell);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    })
    .join(',');
}

function generateCsvFile(count) {
  const rows = [buildCsvRow(header)];

  for (let i = 0; i < count; i += 1) {
    rows.push(buildCsvRow(buildRow(i)));
  }

  const fileName = `sample_sales_${count}.csv`;
  const filePath = path.join(outputDir, fileName);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, rows.join('\n'));
  return filePath;
}

function main() {
  const counts = [100, 500, 1200];
  const outputs = counts.map(generateCsvFile);

  console.log('Generated sample sales CSV files:', outputs.join(', '));
}

main();
