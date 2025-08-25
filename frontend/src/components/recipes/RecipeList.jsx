const RecipeList = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Recipe Management</h1>
        <button className="btn btn-primary">
          Create Recipe
        </button>
      </div>

      {/* Recipe content will go here */}
      <div className="card p-6">
        <p className="text-gray-600">Recipe management interface coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will include recipe standardization, cost calculations, and scaling tools.
        </p>
      </div>
    </div>
  )
}

export default RecipeList