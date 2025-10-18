import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import CsvUploadCard from '../components/csv/CsvUploadCard'
import CsvTransformPanel from '../components/csv/CsvTransformPanel'
import CsvDataReviewPanel from '../components/csv/CsvDataReviewPanel'
import useCsvUploadWorkflow from '../hooks/useCsvUploadWorkflow'
import {
  uploadInventoryCsv,
  uploadSalesCsv,
  transformInventoryUpload,
  transformSalesUpload,
  CSV_UPLOAD_TYPES
} from '../services/csvImportService'

const DEFAULT_RESTAURANT_ID = 1

const CsvDataImportPage = () => {
  const [activeTab, setActiveTab] = useState(CSV_UPLOAD_TYPES.INVENTORY)

  const inventoryWorkflow = useCsvUploadWorkflow({
    uploadFn: uploadInventoryCsv,
    transformFn: transformInventoryUpload,
    dataTypeName: 'Inventory',
    restaurantId: DEFAULT_RESTAURANT_ID
  })

  const salesWorkflow = useCsvUploadWorkflow({
    uploadFn: uploadSalesCsv,
    transformFn: transformSalesUpload,
    dataTypeName: 'Sales',
    restaurantId: DEFAULT_RESTAURANT_ID
  })

  const activeWorkflow = activeTab === CSV_UPLOAD_TYPES.INVENTORY ? inventoryWorkflow : salesWorkflow

  const uploadCopy = useMemo(() => {
    if (activeTab === CSV_UPLOAD_TYPES.SALES) {
      return {
        title: 'Upload Sales CSV',
        description: 'Import sales transactions from any POS export. Upload a CSV to validate the data structure before transforming.'
      }
    }

    return {
      title: 'Upload Inventory CSV',
      description: 'Import inventory items from spreadsheet exports. Upload a CSV to validate the data structure before transforming.'
    }
  }, [activeTab])

  const handleUpload = async (file) => {
    try {
      await activeWorkflow.handleUpload(file)
    } catch (err) {
      // handleUpload already surfaces a snackbar; no-op keeps stack clean
      console.error('CSV upload failed', err)
    }
  }

  const handleTransform = async ({ uploadId, dryRun }) => {
    try {
      await activeWorkflow.handleTransform({ uploadId, dryRun })
    } catch (err) {
      console.error('CSV transform failed', err)
    }
  }

  const showErrorBanner = Boolean(activeWorkflow.error)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CSV Data Import</h1>
          <p className="text-gray-600 mt-2 max-w-2xl">
            Validate and transform inventory or sales CSV files before they enter your CostFX workspace.
            Start with an upload, review validation results, then run the transform step when you are ready.
          </p>
        </header>

        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab(CSV_UPLOAD_TYPES.INVENTORY)}
              className={`
                py-3 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === CSV_UPLOAD_TYPES.INVENTORY
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Inventory CSV
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(CSV_UPLOAD_TYPES.SALES)}
              className={`
                py-3 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === CSV_UPLOAD_TYPES.SALES
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              Sales CSV
            </button>
          </nav>
        </div>

        {showErrorBanner && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-500" />
            <div>
              <p className="font-medium">Workflow error</p>
              <p>{activeWorkflow.error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <CsvUploadCard
            title={uploadCopy.title}
            description={uploadCopy.description}
            onUpload={handleUpload}
            isUploading={activeWorkflow.isUploading}
            uploadResult={activeWorkflow.uploadResult}
          />

          <CsvTransformPanel
            uploadResult={activeWorkflow.uploadResult}
            transformResult={activeWorkflow.transformResult}
            isTransforming={activeWorkflow.isTransforming}
            onTransform={handleTransform}
          />

          <CsvDataReviewPanel
            transformResult={activeWorkflow.transformResult}
            uploadType={activeTab}
          />
        </div>
      </div>
    </div>
  )
}

export default CsvDataImportPage
