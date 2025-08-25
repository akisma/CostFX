import api from './api'

export const restaurantService = {
  // Get all restaurants
  getAll: async (params = {}) => {
    const response = await api.get('/restaurants', { params })
    return response.data
  },

  // Get restaurant by ID
  getById: async (id) => {
    const response = await api.get(`/restaurants/${id}`)
    return response.data
  },

  // Create new restaurant
  create: async (restaurantData) => {
    const response = await api.post('/restaurants', restaurantData)
    return response.data
  },

  // Update restaurant
  update: async (id, restaurantData) => {
    const response = await api.put(`/restaurants/${id}`, restaurantData)
    return response.data
  },

  // Delete restaurant
  delete: async (id) => {
    const response = await api.delete(`/restaurants/${id}`)
    return response.data
  }
}