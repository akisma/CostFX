import { configureStore } from '@reduxjs/toolkit'
import restaurantSlice from './slices/restaurantSlice'
import inventorySlice from './slices/inventorySlice'
import recipeSlice from './slices/recipeSlice'
import agentSlice from './slices/agentSlice'

export const store = configureStore({
  reducer: {
    restaurant: restaurantSlice,
    inventory: inventorySlice,
    recipe: recipeSlice,
    agent: agentSlice
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
})

// Note: TypeScript type exports removed for JavaScript compatibility
// If you need these types, convert this file to TypeScript (.ts)