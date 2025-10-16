import PropTypes from 'prop-types'
import { Database, Package, AlertCircle, RefreshCw } from 'lucide-react'
import { useDataReview } from '../../../hooks'
import { ActionButton, DataTable, StatCard } from '../shared'
import { getRawSalesData, getTransformedSalesData } from '../../../services/posSyncService'

/**
 * SalesDataReviewPanel Component
 * 
 * Shows side-by-side comparison of Tier 1 (raw Square sales) vs Tier 2 (transformed sales transactions).
 * Uses shared useDataReview hook and UI components for DRY approach.
 * 
 * Features:
 * - Displays square_orders and square_order_items (Tier 1)
 * - Displays sales_transactions (Tier 2)
 * - Statistics showing counts and totals
 * - Refresh button to reload data
 * - Clean, consistent UI matching inventory review
 * 
 * Created: 2025-10-13 (Issue #46)
 */
const SalesDataReviewPanel = ({ connectionId }) => {
  const {
    rawData,
    transformedData,
    loading,
    error,
    refresh
  } = useDataReview({
    connectionId,
    fetchRawFn: getRawSalesData,
    fetchTransformedFn: getTransformedSalesData,
    autoFetch: true,
    fetchOptions: { limit: 100 } // Limit for performance
  })

  // Define columns for raw orders table
  const rawOrdersColumns = [
    { 
      key: 'id', 
      header: 'Order ID',
      render: (row) => row.square_order_id?.substring(0, 12) || 'N/A'
    },
    { 
      key: 'created_at', 
      header: 'Date',
      render: (row) => new Date(row.created_at).toLocaleDateString()
    },
    { 
      key: 'state', 
      header: 'State',
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          row.state === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {row.state}
        </span>
      )
    },
    { 
      key: 'total_money', 
      header: 'Total',
      render: (row) => `$${((row.total_money || 0) / 100).toFixed(2)}`
    },
    { 
      key: 'items', 
      header: 'Items',
      render: (row) => row._itemCount || 0
    }
  ]

  // Define columns for transformed transactions table
  const transformedColumns = [
    { 
      key: 'id', 
      header: 'ID',
      render: (row) => row.id
    },
    { 
      key: 'date', 
      header: 'Date',
      render: (row) => new Date(row.transaction_date).toLocaleDateString()
    },
    { 
      key: 'item', 
      header: 'Item',
      render: (row) => row.item_name || 'Unknown'
    },
    { 
      key: 'quantity', 
      header: 'Qty',
      render: (row) => row.quantity
    },
    { 
      key: 'unit_price', 
      header: 'Unit Price',
      render: (row) => `$${(row.unit_price || 0).toFixed(2)}`
    },
    { 
      key: 'total', 
      header: 'Total',
      render: (row) => `$${((row.quantity || 0) * (row.unit_price || 0)).toFixed(2)}`
    }
  ]

  // Calculate statistics
  const stats = {
    raw: {
      orders: rawData?.orders?.length || 0,
      orderItems: rawData?.orderItems?.length || 0,
      totalRevenue: rawData?.orders?.reduce((sum, order) => sum + (order.total_money || 0), 0) / 100 || 0
    },
    transformed: {
      transactions: transformedData?.transactions?.length || 0,
      totalRevenue: transformedData?.transactions?.reduce((sum, tx) => 
        sum + ((tx.quantity || 0) * (tx.unit_price || 0)), 0
      ) || 0
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading sales data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
        <ActionButton
          onClick={refresh}
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
          className="mt-4"
        >
          Retry
        </ActionButton>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Sales Data Review</h2>
        <ActionButton
          onClick={refresh}
          variant="outline"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </ActionButton>
      </div>

      {/* Tier 1: Raw Square Sales Data */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Tier 1: Raw Square Sales Data</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Data imported directly from Square (square_orders, square_order_items)
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Orders"
              value={stats.raw.orders}
              variant="info"
            />
            <StatCard
              label="Line Items"
              value={stats.raw.orderItems}
              variant="info"
            />
            <StatCard
              label="Total Revenue"
              value={`$${stats.raw.totalRevenue.toFixed(2)}`}
              variant="success"
            />
          </div>

          {/* Orders Table */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Recent Orders ({stats.raw.orders} total, showing first 100)
            </h4>
            <DataTable
              columns={rawOrdersColumns}
              data={rawData?.orders || []}
              emptyMessage="No orders synced yet. Import sales data first."
              maxHeight="400px"
            />
          </div>
        </div>
      </div>

      {/* Tier 2: Transformed Sales Transactions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Tier 2: Transformed Sales Transactions</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Transformed and standardized for analysis (sales_transactions)
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Transactions"
              value={stats.transformed.transactions}
              variant="success"
            />
            <StatCard
              label="Total Revenue"
              value={`$${stats.transformed.totalRevenue.toFixed(2)}`}
              variant="success"
            />
          </div>

          {/* Transactions Table */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Recent Transactions ({stats.transformed.transactions} total, showing first 100)
            </h4>
            <DataTable
              columns={transformedColumns}
              data={transformedData?.transactions || []}
              emptyMessage="No transactions yet. Transform sales data first."
              maxHeight="400px"
            />
          </div>
        </div>
      </div>

      {/* Comparison Summary */}
      {stats.raw.orders > 0 && stats.transformed.transactions > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">📊 Transformation Summary</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              <strong>{stats.raw.orders}</strong> orders with{' '}
              <strong>{stats.raw.orderItems}</strong> line items →{' '}
              <strong>{stats.transformed.transactions}</strong> transactions
            </p>
            <p>
              Transformation rate:{' '}
              <strong>
                {((stats.transformed.transactions / stats.raw.orderItems) * 100).toFixed(1)}%
              </strong>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

SalesDataReviewPanel.propTypes = {
  connectionId: PropTypes.number.isRequired
}

export default SalesDataReviewPanel
