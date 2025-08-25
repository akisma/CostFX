import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  recipes: [],
  currentRecipe: null,
  ingredients: [],
  categories: ['appetizer', 'main_course', 'dessert', 'beverage', 'side'],
  loading: false,
  error: null
}

const recipeSlice = createSlice({
  name: 'recipe',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    setRecipes: (state, action) => {
      state.recipes = action.payload
    },
    addRecipe: (state, action) => {
      state.recipes.push(action.payload)
    },
    updateRecipe: (state, action) => {
      const index = state.recipes.findIndex(r => r.id === action.payload.id)
      if (index !== -1) {
        state.recipes[index] = action.payload
      }
    },
    setCurrentRecipe: (state, action) => {
      state.currentRecipe = action.payload
    },
    clearCurrentRecipe: (state) => {
      state.currentRecipe = null
    },
    setIngredients: (state, action) => {
      state.ingredients = action.payload
    }
  }
})

export const {
  setLoading,
  setError,
  clearError,
  setRecipes,
  addRecipe,
  updateRecipe,
  setCurrentRecipe,
  clearCurrentRecipe,
  setIngredients
} = recipeSlice.actions

export default recipeSlice.reducer