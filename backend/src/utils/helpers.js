import { format, addDays, startOfDay } from 'date-fns';

// Utility functions for date operations
export const formatDate = (date, formatString = 'yyyy-MM-dd') => {
  return format(date, formatString);
};

export const addBusinessDays = (date, days) => {
  return addDays(date, days);
};

export const getStartOfDay = (date) => {
  return startOfDay(date);
};

// Calculation utilities
export const calculateWastePercentage = (totalPurchased, totalUsed) => {
  if (totalPurchased <= 0) return 0;
  const waste = totalPurchased - totalUsed;
  return (waste / totalPurchased) * 100;
};

export const calculateCostPerServing = (totalCost, servings) => {
  if (servings <= 0) return 0;
  return totalCost / servings;
};

export const calculateMargin = (revenue, cost) => {
  if (revenue <= 0) return 0;
  return ((revenue - cost) / revenue) * 100;
};

// Inventory calculations
export const calculateReorderPoint = (dailyUsage, leadTimeDays, safetyStock = 0) => {
  return (dailyUsage * leadTimeDays) + safetyStock;
};

export const calculateEconomicOrderQuantity = (annualDemand, orderCost, holdingCost) => {
  if (holdingCost <= 0) return 0;
  return Math.sqrt((2 * annualDemand * orderCost) / holdingCost);
};