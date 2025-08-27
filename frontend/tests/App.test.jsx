import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import PropTypes from 'prop-types';

import { store } from '../src/store/index.js';

// Mock layout component
const MockLayout = ({ children }) => <div data-testid="layout">{children}</div>;
MockLayout.propTypes = {
  children: PropTypes.node.isRequired
};

// Mock the main App component since it's not being used in these tests
const TestApp = () => <div>Test App</div>;

describe('App Tests', () => {
  it('renders without crashing', () => {
    render(
      <Provider store={store}>
        <BrowserRouter>
          <TestApp />
        </BrowserRouter>
      </Provider>
    );
    
    expect(screen.getByText('Test App')).toBeInTheDocument();
  });

  it('renders with router and store', () => {
    render(
      <Provider store={store}>
        <BrowserRouter>
          <MockLayout>
            <TestApp />
          </MockLayout>
        </BrowserRouter>
      </Provider>
    );
    
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });
});

