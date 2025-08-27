// Quick test script to debug API connection
async function testAPI() {
  console.log('🧪 Testing API Connection...')
  
  try {
    const response = await fetch('http://localhost:3003/api/v1/agents/forecast/demand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        days: 7,
        menuItems: ['Classic Burger'],
        restaurantId: 1
      })
    })
    
    console.log('Response status:', response.status)
    console.log('Response headers:', [...response.headers.entries()])
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ API Response:', data)
    } else {
      console.log('❌ API Error:', response.statusText)
    }
  } catch (error) {
    console.log('❌ Network Error:', error.message)
  }
}

testAPI()
