import { useState } from 'react'
import PropTypes from 'prop-types'
import { Upload } from 'lucide-react'
import ActionButton from '../pos/shared/ActionButton'
import StatCard from '../pos/shared/StatCard'

const CsvUploadCard = ({
  title,
  description,
  onUpload,
  isUploading,
  uploadResult
}) => {
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    setSelectedFile(file || null)
  }

  const handleUploadClick = () => {
    if (selectedFile) {
      onUpload(selectedFile)
    }
  }

  const rowsValid = uploadResult?.rowsValid ?? null
  const rowsInvalid = uploadResult?.rowsInvalid ?? null
  const rowsTotal = uploadResult?.rowsTotal ?? null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor={`${title}-file-input`}>
            CSV File
          </label>
          <input
            id={`${title}-file-input`}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={handleFileChange}
          />
          {selectedFile && (
            <p className="text-xs text-gray-500 mt-1">Selected: {selectedFile.name}</p>
          )}
        </div>

        <ActionButton
          onClick={handleUploadClick}
          loading={isUploading}
          disabled={!selectedFile}
          icon={<Upload className="w-5 h-5" />}
          variant="primary"
        >
          Upload & Validate
        </ActionButton>

        {uploadResult && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard label="Total Rows" value={rowsTotal} variant="info" />
            <StatCard label="Valid Rows" value={rowsValid} variant="success" />
            <StatCard label="Flagged Rows" value={rowsInvalid} variant={rowsInvalid > 0 ? 'warning' : 'default'} />
          </div>
        )}
      </div>
    </div>
  )
}

CsvUploadCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  onUpload: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  uploadResult: PropTypes.shape({
    rowsTotal: PropTypes.number,
    rowsValid: PropTypes.number,
    rowsInvalid: PropTypes.number
  })
}

export default CsvUploadCard
