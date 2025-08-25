import { useParams } from 'react-router-dom'

const RecipeDetail = () => {
  const { id } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Recipe Details</h1>
        <div className="space-x-2">
          <button className="btn btn-secondary">Edit</button>
          <button className="btn btn-primary">Scale Recipe</button>
        </div>
      </div>

      {/* Recipe detail content will go here */}
      <div className="card p-6">
        <p className="text-gray-600">Recipe detail view for recipe ID: {id}</p>
        <p className="text-sm text-gray-500 mt-2">
          This will show detailed recipe information, ingredients, instructions, and cost analysis.
        </p>
      </div>
    </div>
  )
}

export default RecipeDetail