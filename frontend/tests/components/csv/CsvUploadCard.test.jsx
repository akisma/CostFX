import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CsvUploadCard from '../../../src/components/csv/CsvUploadCard.jsx'

describe('CsvUploadCard', () => {
  it('disables upload button when no file is selected', () => {
    render(
      <CsvUploadCard
        title="Upload Inventory CSV"
        description="Test description"
        onUpload={vi.fn()}
        isUploading={false}
      />
    )

    const uploadButton = screen.getByRole('button', { name: /upload & validate/i })
    expect(uploadButton).toBeDisabled()
  })

  it('invokes onUpload with the selected file', () => {
    const onUpload = vi.fn()

    render(
      <CsvUploadCard
        title="Upload Inventory CSV"
        description="Test description"
        onUpload={onUpload}
        isUploading={false}
      />
    )

    const fileInput = screen.getByLabelText(/csv file/i)
    const testFile = new File(['name,quantity'], 'inventory.csv', { type: 'text/csv' })

    fireEvent.change(fileInput, { target: { files: [testFile] } })

    const uploadButton = screen.getByRole('button', { name: /upload & validate/i })
    expect(uploadButton).not.toBeDisabled()

    fireEvent.click(uploadButton)

    expect(onUpload).toHaveBeenCalledTimes(1)
    expect(onUpload).toHaveBeenCalledWith(testFile)
  })

  it('renders upload statistics when available', () => {
    render(
      <CsvUploadCard
        title="Upload Inventory CSV"
        description="Test description"
        onUpload={vi.fn()}
        isUploading={false}
        uploadResult={{ rowsTotal: 12, rowsValid: 10, rowsInvalid: 2 }}
      />
    )

    expect(screen.getByText(/total rows/i)).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText(/valid rows/i)).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText(/flagged rows/i)).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
