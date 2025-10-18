import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CsvDataReviewPanel from '../../../src/components/csv/CsvDataReviewPanel.jsx'

describe('CsvDataReviewPanel', () => {
  it('renders an instructional placeholder when no transform result is present', () => {
    render(<CsvDataReviewPanel transformResult={null} uploadType="inventory" />)

    expect(screen.getByText(/review flagged inventory rows/i)).toBeInTheDocument()
    expect(screen.getByText(/run the transform step/i)).toBeInTheDocument()
  })

  it('displays flagged rows and matching stats', () => {
    const transformResult = {
      summary: {
        flaggedForReview: [
          {
            name: 'Chicken Breast',
            reason: 'unmapped_category',
            category: 'proteins'
          },
          {
            name: 'Mystery Item',
            reason: 'inventory_match_not_found',
            orderId: 'ORD-42',
            lineItemId: 'LINE-9'
          }
        ],
        itemMatching: {
          autoLinked: 5,
          needsReview: 2
        }
      }
    }

    render(<CsvDataReviewPanel transformResult={transformResult} uploadType="sales" />)

    expect(screen.getByText(/matching summary/i)).toBeInTheDocument()
    expect(screen.getByText('Auto Linked')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Needs Review')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    expect(screen.getByText('Chicken Breast')).toBeInTheDocument()
    expect(screen.getByText(/category needs mapping/i)).toBeInTheDocument()
    expect(screen.getByText(/csv category "proteins" is not linked yet/i)).toBeInTheDocument()

    expect(screen.getByText('Mystery Item')).toBeInTheDocument()
    expect(screen.getByText(/inventory match not found/i)).toBeInTheDocument()
    expect(screen.getByText(/order ord-42 - line item line-9 has no matching inventory item/i)).toBeInTheDocument()

    expect(screen.getByText(/2 rows flagged/i)).toBeInTheDocument()
  })
})
