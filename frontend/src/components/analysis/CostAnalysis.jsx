const CostAnalysis = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Cost Analysis</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Dish Profitability</h2>
          <p className="text-gray-600">Cost analysis by menu item coming soon...</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cost Trends</h2>
          <p className="text-gray-500">Historical cost trend analysis coming soon...</p>
        </div>
      </div>
    </div>
  )
}

export default CostAnalysis