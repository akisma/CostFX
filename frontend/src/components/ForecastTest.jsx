import { useState } from 'react'
import { forecastService } from '../services/forecastService'

const ForecastTest = () => {
  const [result, setResult] = useState('Click button to test')
  const [loading, setLoading] = useState(false)

  const testForecast = async () => {
    setLoading(true)
    setResult('Testing...')
    
    try {
      console.log('🧪 Starting forecast test...')
      const data = await forecastService.getDemandForecast()
      console.log('📊 Forecast test result:', data)
      setResult(`Success! Received ${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      console.error('❌ Forecast test failed:', error)
      setResult(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Forecast API Test</h1>
      <button 
        onClick={testForecast}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Forecast API'}
      </button>
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <pre className="text-sm">{result}</pre>
      </div>
    </div>
  )
}

export default ForecastTest
