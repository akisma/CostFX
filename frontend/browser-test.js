// Simple test in browser console
// Open browser console and run this:

async function testForecastService() {
  try {
    console.log('Testing forecast service...');
    
    // Test direct API call
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
    });
    
    console.log('Direct API Response:', response.status);
    const data = await response.json();
    console.log('Direct API Data:', data);
    
    // Test through axios (if available)
    if (typeof window !== 'undefined' && window.axios) {
      console.log('Testing through axios...');
      const axiosResponse = await window.axios.post('/api/v1/agents/forecast/demand', {
        days: 7,
        menuItems: ['Classic Burger'],
        restaurantId: 1
      });
      console.log('Axios Response:', axiosResponse.data);
    }
    
  } catch (error) {
    console.error('Test Error:', error);
  }
}

testForecastService();
