import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, vi } from 'vitest'
import App, { AppRoutes } from '../src/App'
import restaurantSlice from '../src/store/slices/restaurantSlice'
import inventorySlice from '../src/store/slices/inventorySlice'
import recipeSlice from '../src/store/slices/recipeSlice'
import agentSlice from '../src/store/slices/agentSlice'

// Mock the dashboard and other components to avoid complex rendering
vi.mock('../src/components/dashboard/Dashboard', () => ({
  default: () => <div data-testid="dashboard">Dashboard Component</div>
}))

vi.mock('../src/components/common/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>
}))

// Create a test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      restaurant: restaurantSlice,
      inventory: inventorySlice,
      recipe: recipeSlice,
      agent: agentSlice
    },
    preloadedState: initialState
  })
}

// Wrapper component for tests
const TestWrapper = ({ children, initialState = {}, initialEntries = ['/'] }) => {
  const store = createTestStore(initialState)
  return (
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </Provider>
  )
}

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <AppRoutes />
      </TestWrapper>
    )
    
    // Should render the layout and dashboard
    expect(screen.getByTestId('layout')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })

  it('renders the dashboard by default', () => {
    render(
      <TestWrapper>
        <AppRoutes />
      </TestWrapper>
    )
    
    // The dashboard should be the default route
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })
})
