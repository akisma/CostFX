const InventoryList = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        <button className="btn btn-primary">
          Add Transaction
        </button>
      </div>

      {/* Inventory content will go here */}
      <div className="card p-6">
        <p className="text-gray-600">Inventory management interface coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will include current stock levels, transaction history, and low-stock alerts.
        </p>
      </div>
    </div>
  )
}

export default InventoryList