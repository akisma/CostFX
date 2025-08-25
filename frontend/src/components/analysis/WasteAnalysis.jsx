const WasteAnalysis = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Waste Analysis</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Waste by Category</h2>
          <p className="text-gray-600">Waste breakdown analysis coming soon...</p>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Reduction Opportunities</h2>
          <p className="text-gray-600">AI-powered waste reduction recommendations coming soon...</p>
        </div>
      </div>
    </div>
  )
}

export default WasteAnalysis