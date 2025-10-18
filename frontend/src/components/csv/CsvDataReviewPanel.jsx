import PropTypes from 'prop-types'
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react'
import DataTable from '../pos/shared/DataTable'
import StatCard from '../pos/shared/StatCard'

const REASON_LABELS = {
  unmapped_category: 'Category needs mapping',
  low_category_confidence: 'Low category confidence',
  missing_identifiers: 'Missing identifiers',
  inventory_match_not_found: 'Inventory match not found'
}

const POSITIVE_VARIANTS = new Set(['autoLinked', 'matched'])
const WARNING_VARIANTS = new Set(['needsReview', 'unmatched'])

const formatConfidence = (value) => {
  if (value === null || value === undefined) {
    return null
  }

  if (value <= 1) {
    return `${Math.round(value * 100)}%`
  }

  return `${Math.round(value)}%`
}

const buildDetailSummary = (row) => {
  switch (row.reason) {
    case 'unmapped_category':
      return row.category ? `CSV category "${row.category}" is not linked yet.` : 'CSV row does not map to a known category.'
    case 'low_category_confidence': {
      const confidence = formatConfidence(row.confidence)
      const mapped = row.mappedCategory ? `mapped to ${row.mappedCategory}` : 'mapping requires review'
      return confidence
        ? `${mapped} with ${confidence} confidence.`
        : `${mapped} with low confidence.`
    }
    case 'missing_identifiers':
      return 'SKU and vendor identifiers are both missing from this row.'
    case 'inventory_match_not_found': {
      const parts = []
      if (row.orderId) {
        parts.push(`Order ${row.orderId}`)
      }
      if (row.lineItemId) {
        parts.push(`Line item ${row.lineItemId}`)
      }
      const location = parts.length > 0 ? parts.join(' - ') : 'No matching inventory item exists yet.'
      return `${location}${parts.length > 0 ? ' has no matching inventory item.' : ''}`
    }
    default:
      return row.reason || 'Review required.'
  }
}

const reasonColumns = [
  {
    key: 'name',
    header: 'Item',
    render: (row) => row.name || 'Unnamed row'
  },
  {
    key: 'reason',
    header: 'Issue',
    render: (row) => REASON_LABELS[row.reason] || row.reason
  },
  {
    key: 'details',
    header: 'Details',
    render: (row) => buildDetailSummary(row)
  }
]

const renderItemMatchCards = (itemMatching) => {
  if (!itemMatching || typeof itemMatching !== 'object') {
    return null
  }

  const entries = Object.entries(itemMatching)
  if (entries.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([key, value]) => {
        const isPositive = POSITIVE_VARIANTS.has(key)
        const isWarning = WARNING_VARIANTS.has(key)
        const variant = isPositive ? 'success' : isWarning ? 'warning' : 'default'
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())

        return (
          <StatCard
            key={key}
            label={label}
            value={value}
            variant={variant}
          />
        )
      })}
    </div>
  )
}

const CsvDataReviewPanel = ({ transformResult, uploadType }) => {
  const flaggedRows = transformResult?.flaggedForReview || transformResult?.summary?.flaggedForReview || []
  const itemMatching = transformResult?.itemMatching || transformResult?.summary?.itemMatching || null
  const itemMatchCards = renderItemMatchCards(itemMatching)
  const sampleData = (() => {
    const metadata = transformResult?.metadata || transformResult?.summary?.metadata
    return metadata?.sampleRows || []
  })()

  const dataPreviewColumns = uploadType === 'inventory'
    ? [
        { key: 'name', header: 'Item Name', render: (row) => row.name || 'N/A' },
        { key: 'category', header: 'Category', render: (row) => row.category || 'N/A' },
        { key: 'unit_cost', header: 'Unit Cost', render: (row) => row.unit_cost ? `$${Number(row.unit_cost).toFixed(2)}` : 'N/A' },
        { key: 'unit', header: 'Unit', render: (row) => row.unit || 'N/A' },
        { key: 'supplier_name', header: 'Supplier', render: (row) => row.supplier_name || 'N/A' },
        { key: 'current_stock', header: 'Stock', render: (row) => row.current_stock || '0' }
      ]
    : [
        { key: 'item_name', header: 'Item Name', render: (row) => row.item_name || 'N/A' },
        { key: 'transaction_date', header: 'Date', render: (row) => row.transaction_date ? new Date(row.transaction_date).toLocaleDateString() : 'N/A' },
        { key: 'quantity', header: 'Quantity', render: (row) => row.quantity || '0' },
        { key: 'unit_price', header: 'Unit Price', render: (row) => row.unit_price ? `$${Number(row.unit_price).toFixed(2)}` : 'N/A' },
        { key: 'total_amount', header: 'Total', render: (row) => row.total_amount ? `$${Number(row.total_amount).toFixed(2)}` : 'N/A' },
        { key: 'order_id', header: 'Order ID', render: (row) => row.order_id || 'N/A' }
      ]

  const flaggedCount = flaggedRows.length

  if (!transformResult) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Review Flagged {uploadType === 'sales' ? 'Sales' : 'Inventory'} Rows</h3>
            <p className="text-sm text-gray-600 mt-1">
              Run the transform step to view rows that need manual review.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Data Preview Section */}
      {sampleData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Data Preview</h3>
              <p className="text-sm text-gray-600 mt-1">
                Sample of uploaded {uploadType} data (first {sampleData.length} rows)
              </p>
            </div>
            <Database className="w-5 h-5 text-blue-500" />
          </div>

          <DataTable
            columns={dataPreviewColumns}
            data={sampleData}
            emptyMessage="No sample data available."
            maxHeight="320px"
          />
        </div>
      )}

      {/* Review Section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Review Flagged {uploadType === 'sales' ? 'Sales' : 'Inventory'} Rows</h3>
            <p className="text-sm text-gray-600 mt-1">
              Inspect rows that need attention before finalizing your {uploadType === 'sales' ? 'sales' : 'inventory'} data.
            </p>
          </div>
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        </div>

        {itemMatchCards && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Matching Summary
            </h4>
            {itemMatchCards}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Rows Requiring Manual Review
            </h4>
            <span className="text-xs text-gray-500">Showing up to 25 rows provided by the transform summary.</span>
          </div>

          <DataTable
            columns={reasonColumns}
            data={flaggedRows}
            emptyMessage="No rows were flagged during transformation."
            maxHeight="320px"
          />

          <p className="text-xs text-gray-500 mt-3">
            {flaggedCount === 0
              ? 'Great! No issues detected during this transform.'
              : `${flaggedCount} row${flaggedCount === 1 ? '' : 's'} flagged. Update your source data or category mappings, then rerun the transform.`}
          </p>
        </div>
      </div>
    </div>
  )
}

CsvDataReviewPanel.propTypes = {
  transformResult: PropTypes.shape({
    summary: PropTypes.shape({
      flaggedForReview: PropTypes.arrayOf(PropTypes.object),
      itemMatching: PropTypes.object,
      metadata: PropTypes.object
    }),
    flaggedForReview: PropTypes.arrayOf(PropTypes.object),
    itemMatching: PropTypes.object,
    metadata: PropTypes.object
  }),
  uploadType: PropTypes.oneOf(['inventory', 'sales']).isRequired
}

export default CsvDataReviewPanel
