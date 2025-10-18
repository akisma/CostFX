import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CsvTransformPanel from '../../../src/components/csv/CsvTransformPanel.jsx'

describe('CsvTransformPanel', () => {
  it('returns null when no upload result exists', () => {
    const { container } = render(
      <CsvTransformPanel
        uploadResult={null}
        transformResult={null}
        isTransforming={false}
        onTransform={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('disables transform button when upload is not ready', () => {
    render(
      <CsvTransformPanel
        uploadResult={{ uploadId: 7, readyForTransform: false, rowsValid: 0, rowsInvalid: 5 }}
        transformResult={null}
        isTransforming={false}
        onTransform={vi.fn()}
      />
    )

    const button = screen.getByRole('button', { name: /transform data/i })
    expect(button).toBeDisabled()
  })

  it('invokes onTransform with dry-run flag as the user toggles it', () => {
    const onTransform = vi.fn()

    render(
      <CsvTransformPanel
        uploadResult={{
          uploadId: 99,
          readyForTransform: true,
          rowsValid: 15,
          rowsInvalid: 1,
          filename: 'inventory.csv'
        }}
        transformResult={null}
        isTransforming={false}
        onTransform={onTransform}
      />
    )

    const button = screen.getByRole('button', { name: /transform data/i })
    expect(button).toBeEnabled()

    fireEvent.click(button)
    expect(onTransform).toHaveBeenCalledWith({ uploadId: 99, dryRun: false })

    const dryRunToggle = screen.getByLabelText(/run as dry-run/i)
    fireEvent.click(dryRunToggle)

    fireEvent.click(button)
    expect(onTransform).toHaveBeenLastCalledWith({ uploadId: 99, dryRun: true })
  })

  it('renders transformation summary stats when available', () => {
    render(
      <CsvTransformPanel
        uploadResult={{ uploadId: 3, readyForTransform: true, rowsValid: 10, rowsInvalid: 0 }}
        transformResult={{
          status: 'completed',
          errorRate: 0.125,
          summary: {
            processed: 32,
            created: 20,
            updated: 10,
            skipped: 2,
            errors: 0,
            itemMatching: { matched: 18 }
          },
          errors: []
        }}
        isTransforming={false}
        onTransform={vi.fn()}
      />
    )

  expect(screen.getByText(/transformation complete/i)).toBeInTheDocument()
  expect(screen.getByText(/status: completed/i)).toBeInTheDocument()
  expect(screen.getByText(/12.5%/)).toBeInTheDocument()

  expect(screen.getByText('Processed').nextElementSibling).toHaveTextContent('32')
  expect(screen.getByText('Created').nextElementSibling).toHaveTextContent('20')
  expect(screen.getByText('Updated').nextElementSibling).toHaveTextContent('10')
  expect(screen.getByText('Skipped').nextElementSibling).toHaveTextContent('2')
  expect(screen.getByText('Matched Items').nextElementSibling).toHaveTextContent('18')
  })

  it('formats error rate that is already provided as a percentage', () => {
    render(
      <CsvTransformPanel
        uploadResult={{ uploadId: 4, readyForTransform: true, rowsValid: 5, rowsInvalid: 0 }}
        transformResult={{
          status: 'completed',
          errorRate: 5,
          summary: {
            processed: 5,
            created: 5,
            updated: 0,
            skipped: 0,
            errors: 0
          },
          errors: []
        }}
        isTransforming={false}
        onTransform={vi.fn()}
      />
    )

    expect(screen.getByText(/5.0%/)).toBeInTheDocument()
  })
})
