export const CSV_UPLOAD_TYPES = {
  INVENTORY: 'inventory',
  SALES: 'sales'
};

const HEADER_ALIASES = {
  // Inventory aliases
  'item name': 'name',
  'item_name': 'name',
  'product name': 'name',
  'category name': 'category',
  'category_name': 'category',
  'uom': 'unit',
  'unit of measure': 'unit',
  'unit cost': 'unit_cost',
  'price': 'unit_cost',
  'cost': 'unit_cost',
  'supplier': 'supplier_name',
  'vendor': 'supplier_name',
  'vendor name': 'supplier_name',
  'current qty': 'current_stock',
  'current quantity': 'current_stock',
  'par level': 'maximum_stock',
  'par': 'maximum_stock',
  'min': 'minimum_stock',
  'max': 'maximum_stock',
  'batch': 'batch_number',
  'location name': 'location',
  'gl account': 'gl_account',
  'gl code': 'gl_account',
  'sku': 'sku',
  'item sku': 'sku',
  'vendor item #': 'vendor_item_number',
  'vendor item number': 'vendor_item_number',
  // Sales aliases
  'date': 'transaction_date',
  'transaction date': 'transaction_date',
  'item': 'item_name',
  'menu item': 'item_name',
  'qty': 'quantity',
  'quantity sold': 'quantity',
  'price each': 'unit_price',
  'line total': 'total_amount',
  'total': 'total_amount',
  'ticket id': 'order_id',
  'check id': 'order_id',
  'line item id': 'line_item_id',
  'modifier': 'modifiers',
  'modifier list': 'modifiers'
};

const INVENTORY_REQUIRED_HEADERS = [
  'name',
  'category',
  'unit',
  'unit_cost',
  'description',
  'supplier_name'
];

const INVENTORY_OPTIONAL_HEADERS = [
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

const SALES_REQUIRED_HEADERS = [
  'transaction_date',
  'item_name',
  'quantity',
  'unit_price',
  'total_amount',
  'order_id'
];

const SALES_OPTIONAL_HEADERS = [
  'line_item_id',
  'modifiers',
  'notes',
  'location',
  'server_name',
  'guest_count'
];

export function normalizeHeader(header) {
  if (!header) return '';
  const trimmed = header.trim();
  const lower = trimmed.toLowerCase();
  return HEADER_ALIASES[lower] || lower.replace(/\s+/g, '_');
}

export function getSchema(uploadType) {
  if (uploadType === CSV_UPLOAD_TYPES.INVENTORY) {
    return {
      uploadType,
      requiredHeaders: INVENTORY_REQUIRED_HEADERS,
      optionalHeaders: INVENTORY_OPTIONAL_HEADERS,
      knownHeaders: new Set([...INVENTORY_REQUIRED_HEADERS, ...INVENTORY_OPTIONAL_HEADERS])
    };
  }

  if (uploadType === CSV_UPLOAD_TYPES.SALES) {
    return {
      uploadType,
      requiredHeaders: SALES_REQUIRED_HEADERS,
      optionalHeaders: SALES_OPTIONAL_HEADERS,
      knownHeaders: new Set([...SALES_REQUIRED_HEADERS, ...SALES_OPTIONAL_HEADERS])
    };
  }

  throw new Error(`Unsupported CSV upload type: ${uploadType}`);
}
