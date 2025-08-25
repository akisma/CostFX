import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { restaurantService } from '../../services/restaurantService'

// Async thunks
export const fetchRestaurants = createAsyncThunk(
  'restaurant/fetchRestaurants',
  async (params = {}) => {
    const response = await restaurantService.getAll(params)
    return response
  }
)

export const fetchRestaurantById = createAsyncThunk(
  'restaurant/fetchRestaurantById',
  async (id) => {
    const response = await restaurantService.getById(id)
    return response.data
  }
)

export const createRestaurant = createAsyncThunk(
  'restaurant/createRestaurant',
  async (restaurantData) => {
    const response = await restaurantService.create(restaurantData)
    return response.data
  }
)

// Initial state
const initialState = {
  restaurants: [],
  currentRestaurant: null,
  loading: false,
  error: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  }
}

// Slice
const restaurantSlice = createSlice({
  name: 'restaurant',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setCurrentRestaurant: (state, action) => {
      state.currentRestaurant = action.payload
    },
    clearCurrentRestaurant: (state) => {
      state.currentRestaurant = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch restaurants
      .addCase(fetchRestaurants.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRestaurants.fulfilled, (state, action) => {
        state.loading = false
        state.restaurants = action.payload.data
        state.pagination = action.payload.pagination
      })
      .addCase(fetchRestaurants.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      
      // Fetch restaurant by ID
      .addCase(fetchRestaurantById.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRestaurantById.fulfilled, (state, action) => {
        state.loading = false
        state.currentRestaurant = action.payload
      })
      .addCase(fetchRestaurantById.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
      
      // Create restaurant
      .addCase(createRestaurant.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createRestaurant.fulfilled, (state, action) => {
        state.loading = false
        state.restaurants.push(action.payload)
      })
      .addCase(createRestaurant.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message
      })
  }
})

export const { clearError, setCurrentRestaurant, clearCurrentRestaurant } = restaurantSlice.actions
export default restaurantSlice.reducer