import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(repoRoot, 'debug', 'sample-data', 'inventory');

const header = [
  'name',
  'description',
  'category',
  'unit',
  'unit_cost',
  'supplier_name',
  'minimum_stock',
  'maximum_stock',
  'current_stock',
  'batch_number',
  'location',
  'gl_account',
  'sku',
  'vendor_item_number',
  'notes'
];

const categories = [
  'produce',
  'meat',
  'dairy',
  'dry_goods',
  'beverages',
  'other'
];

const units = [
  'lb',
  'kg',
  'oz',
  'gal',
  'liter',
  'case',
  'each',
  'pack'
];

const locations = [
  'Walk-in Cooler',
  'Dry Storage',
  'Freezer',
  'Bar Storage',
  'Prep Station',
  'Pantry'
];

const suppliers = [
  'Fresh Farms Co.',
  'Prime Protein Supply',
  'DairyBest Distributors',
  'Metro Restaurant Supply',
  'Gourmet Goods LLC',
  'Sunrise Produce'
];

function formatNumber(value, decimals = 2) {
  return Number.parseFloat(value).toFixed(decimals);
}

function buildRow(index) {
  const category = categories[index % categories.length];
  const unit = units[index % units.length];
  const supplier = suppliers[index % suppliers.length];
  const location = locations[index % locations.length];

  const minimumStock = 5 + (index % 7);
  const maximumStock = minimumStock + 10 + (index % 5);
  const currentStock = minimumStock + (index % (maximumStock - minimumStock + 1));

  const unitCostBase = 1.25 + (index % 15) * 0.75;
  const unitCost = formatNumber(2 + unitCostBase);

  const sku = `SKU-${String(index + 1).padStart(5, '0')}`;
  const vendorItem = `VIN-${String((index + 1) * 3).padStart(6, '0')}`;
  const glAccount = `5${String(100 + (index % 50)).padStart(3, '0')}`;

  return [
    `Sample Item ${index + 1}`,
    `Sample description for inventory item ${index + 1}`,
    category,
    unit,
    unitCost,
    supplier,
    formatNumber(minimumStock),
    formatNumber(maximumStock),
    formatNumber(currentStock),
    `BATCH-${String((index % 90) + 1).padStart(3, '0')}`,
    location,
    glAccount,
    sku,
    vendorItem,
    `Notes for item ${index + 1}`
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

  const fileName = `sample_inventory_${count}.csv`;
  const filePath = path.join(outputDir, fileName);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, rows.join('\n'));
  return filePath;
}

function main() {
  const counts = [100, 500, 1200];
  const outputs = counts.map(generateCsvFile);

  console.log('Generated sample CSV files:', outputs.join(', '));
}

main();
