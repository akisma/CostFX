import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/common/Layout'
import Dashboard from './components/dashboard/Dashboard'
import InventoryList from './components/inventory/InventoryList'
import RecipeList from './components/recipes/RecipeList'
import RecipeDetail from './components/recipes/RecipeDetail'
import CostAnalysis from './components/analysis/CostAnalysis'
import WasteAnalysis from './components/analysis/WasteAnalysis'
import ForecastView from './components/analysis/ForecastView'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryList />} />
          <Route path="/recipes" element={<RecipeList />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/analysis/costs" element={<CostAnalysis />} />
          <Route path="/analysis/waste" element={<WasteAnalysis />} />
          <Route path="/analysis/forecast" element={<ForecastView />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App