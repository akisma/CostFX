import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const uploadCardPropsLog = []
const { csvUploadWorkflowMock } = vi.hoisted(() => ({
  csvUploadWorkflowMock: vi.fn()
}))

vi.mock('../../src/hooks/useCsvUploadWorkflow.js', () => ({
  default: (...args) => csvUploadWorkflowMock(...args)
}))

vi.mock('../../src/components/csv/CsvUploadCard.jsx', () => ({
  default: (props) => {
    uploadCardPropsLog.push(props)
    return (
      <div>
        <span data-testid="upload-title">{props.title}</span>
        <button
          type="button"
          data-testid="upload-trigger"
          onClick={() => props.onUpload({ name: 'mock.csv' })}
        >
          trigger-upload
        </button>
      </div>
    )
  }
}))

vi.mock('../../src/components/csv/CsvTransformPanel.jsx', () => ({
  default: ({ onTransform }) => (
    <button
      type="button"
      data-testid="transform-trigger"
      onClick={() => onTransform({ uploadId: 11, dryRun: false })}
    >
      trigger-transform
    </button>
  )
}))

vi.mock('../../src/components/csv/CsvDataReviewPanel.jsx', () => ({
  default: () => <div data-testid="review-panel" />
}))

vi.mock('lucide-react', () => ({
  AlertCircle: (props) => <div data-testid="alert-icon" {...props} />
}))

import CsvDataImportPage from '../../src/pages/CsvDataImportPage.jsx'

describe('CsvDataImportPage', () => {
  let inventoryWorkflow
  let salesWorkflow

  beforeEach(() => {
    uploadCardPropsLog.length = 0

    inventoryWorkflow = {
      handleUpload: vi.fn().mockResolvedValue({}),
      handleTransform: vi.fn().mockResolvedValue({}),
      uploadResult: null,
      transformResult: null,
      isUploading: false,
      isTransforming: false,
      error: null
    }

    salesWorkflow = {
      handleUpload: vi.fn().mockResolvedValue({}),
      handleTransform: vi.fn().mockResolvedValue({}),
      uploadResult: null,
      transformResult: null,
      isUploading: false,
      isTransforming: false,
      error: null
    }

    csvUploadWorkflowMock.mockImplementation(({ dataTypeName }) => {
      if (dataTypeName === 'Inventory') {
        return inventoryWorkflow
      }
      if (dataTypeName === 'Sales') {
        return salesWorkflow
      }
      throw new Error(`Unexpected dataTypeName: ${dataTypeName}`)
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    uploadCardPropsLog.length = 0
  })

  it('renders the inventory workflow by default', () => {
    render(<CsvDataImportPage />)

    expect(screen.getByText('CSV Data Import')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /inventory csv/i })).toHaveAttribute('class', expect.stringContaining('border-blue-500'))

    const latestUploadProps = uploadCardPropsLog[uploadCardPropsLog.length - 1]
    expect(latestUploadProps.title).toContain('Inventory')
    expect(csvUploadWorkflowMock).toHaveBeenCalledWith(
      expect.objectContaining({ dataTypeName: 'Inventory', restaurantId: expect.any(Number) })
    )
  })

  it('switches to the sales workflow when the tab is selected', () => {
    render(<CsvDataImportPage />)

    fireEvent.click(screen.getByRole('button', { name: /sales csv/i }))

    const latestUploadProps = uploadCardPropsLog[uploadCardPropsLog.length - 1]
    expect(latestUploadProps.title).toContain('Sales')
  })

  it('delegates uploads to the active workflow', async () => {
    render(<CsvDataImportPage />)

    fireEvent.click(screen.getByTestId('upload-trigger'))

    expect(inventoryWorkflow.handleUpload).toHaveBeenCalledWith({ name: 'mock.csv' })
  })

  it('delegates transforms to the currently selected workflow', async () => {
    render(<CsvDataImportPage />)

    // Switch to sales before triggering transform
    fireEvent.click(screen.getByRole('button', { name: /sales csv/i }))
    fireEvent.click(screen.getByTestId('transform-trigger'))

    expect(salesWorkflow.handleTransform).toHaveBeenCalledWith({ uploadId: 11, dryRun: false })
    expect(inventoryWorkflow.handleTransform).not.toHaveBeenCalled()
  })

  it('shows workflow errors for the active tab', () => {
    salesWorkflow.error = 'Sales workflow failed'

    render(<CsvDataImportPage />)

    fireEvent.click(screen.getByRole('button', { name: /sales csv/i }))

    expect(screen.getByText('Sales workflow failed')).toBeInTheDocument()
    expect(screen.getByTestId('alert-icon')).toBeInTheDocument()
  })
})
