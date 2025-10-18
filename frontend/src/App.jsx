import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/common/Layout'
import ErrorBoundary from './components/common/ErrorBoundary'
import Dashboard from './components/dashboard/Dashboard'
import InventoryList from './components/inventory/InventoryList'
import RecipeList from './components/recipes/RecipeList'
import RecipeDetail from './components/recipes/RecipeDetail'
import CostAnalysis from './components/analysis/CostAnalysis'
import WasteAnalysis from './components/analysis/WasteAnalysis'
import ForecastView from './components/analysis/ForecastView'
import ForecastTest from './components/ForecastTest'
import SquareConnectionPage from './pages/SquareConnectionPage'
import CsvDataImportPage from './pages/CsvDataImportPage'

// Extract routes into a separate component that doesn't include the router
export function AppRoutes() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryList />} />
          <Route path="/recipes" element={<RecipeList />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/analysis/costs" element={<CostAnalysis />} />
          <Route path="/analysis/waste" element={<WasteAnalysis />} />
          <Route path="/analysis/forecast" element={<ForecastView />} />
          <Route path="/test/forecast" element={<ForecastTest />} />
          <Route path="/data-import/csv" element={<CsvDataImportPage />} />
          <Route path="/settings/integrations/square" element={<SquareConnectionPage />} />
          <Route path="/settings/integrations/square/callback" element={<SquareConnectionPage />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  )
}

export default App