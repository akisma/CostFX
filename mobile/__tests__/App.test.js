import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

jest.mock('expo-constants', () => ({
  expoConfig: { sdkVersion: '51.0.0' }
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null
}));

describe('App', () => {
  it('renders hello world view', () => {
    const { getByText } = render(<App />);

    expect(getByText('CostFX Mobile')).toBeTruthy();
    expect(getByText('Hello world! 👋')).toBeTruthy();
    expect(getByText('Welcome to CostFX, Chef!')).toBeTruthy();
  });
});
