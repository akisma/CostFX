import { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Shuffle, RefreshCw } from 'lucide-react'
import ActionButton from '../pos/shared/ActionButton'
import StatCard from '../pos/shared/StatCard'

const formatErrorRate = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '0.0%'
  }

  const percentValue = value > 1 ? value : value * 100
  return `${percentValue.toFixed(1)}%`
}

const CsvTransformPanel = ({
  uploadResult,
  transformResult,
  isTransforming,
  onTransform
}) => {
  const [dryRun, setDryRun] = useState(false)

  const canTransform = Boolean(uploadResult?.uploadId && uploadResult?.readyForTransform)

  const summaryCards = useMemo(() => {
    if (!transformResult?.summary) {
      return null
    }

    const { processed, created, updated, skipped, errors, itemMatching } = transformResult.summary

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <StatCard label="Processed" value={processed} variant="info" />
        <StatCard label="Created" value={created} variant="success" />
        <StatCard label="Errors" value={errors} variant={errors > 0 ? 'warning' : 'default'} />
        <StatCard label="Updated" value={updated} variant="default" className="md:col-span-1" />
        <StatCard label="Skipped" value={skipped} variant="default" className="md:col-span-1" />
        {itemMatching && (
          <StatCard label="Matched Items" value={itemMatching?.matched || 0} variant="success" className="md:col-span-1" />
        )}
      </div>
    )
  }, [transformResult])

  if (!uploadResult) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transform Uploaded Data</h3>
          <p className="text-sm text-gray-600 mt-1">
            {uploadResult.readyForTransform
              ? 'Run the transformation step to map CSV rows into the unified format.'
              : 'Upload contains validation issues that must be resolved before transforming.'}
          </p>
        </div>
        <RefreshCw className="w-5 h-5 text-gray-400" />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <dt className="font-medium text-gray-600">Upload ID</dt>
            <dd className="mt-1 text-gray-900">{uploadResult.uploadId}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Filename</dt>
            <dd className="mt-1 text-gray-900">{uploadResult.filename || 'Latest upload'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Valid Rows</dt>
            <dd className="mt-1 text-gray-900">{uploadResult.rowsValid ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">Flagged Rows</dt>
            <dd className="mt-1 text-gray-900">{uploadResult.rowsInvalid ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          Run as dry-run (no database writes)
        </label>
      </div>

      <ActionButton
        onClick={() => onTransform({ uploadId: uploadResult.uploadId, dryRun })}
        loading={isTransforming}
        disabled={!canTransform}
        icon={<Shuffle className="w-5 h-5" />}
        variant="success"
        className="mt-4"
      >
        Transform Data
      </ActionButton>

      {transformResult && (
        <div className="mt-4">
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
            <p className="font-medium">Transformation Complete</p>
            <p className="mt-1">Status: {transformResult.status}</p>
            <p className="mt-1">
              Error Rate:{' '}
              {formatErrorRate(transformResult.errorRate)}
            </p>
            {transformResult.errors?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-blue-800">View errors ({transformResult.errors.length})</summary>
                <ul className="list-disc list-inside text-blue-700 mt-2 space-y-1">
                  {transformResult.errors.slice(0, 5).map((error, index) => (
                    <li key={index}>{error.message || JSON.stringify(error)}</li>
                  ))}
                </ul>
                {transformResult.errors.length > 5 && (
                  <p className="text-xs text-blue-600 mt-1">Showing first 5 errors.</p>
                )}
              </details>
            )}
          </div>

          {summaryCards}
        </div>
      )}
    </div>
  )
}

CsvTransformPanel.propTypes = {
  uploadResult: PropTypes.shape({
    uploadId: PropTypes.number,
    filename: PropTypes.string,
    rowsValid: PropTypes.number,
    rowsInvalid: PropTypes.number,
    readyForTransform: PropTypes.bool
  }),
  transformResult: PropTypes.shape({
    status: PropTypes.string,
    dryRun: PropTypes.bool,
    errorRate: PropTypes.number,
    summary: PropTypes.object,
    errors: PropTypes.array
  }),
  isTransforming: PropTypes.bool,
  onTransform: PropTypes.func.isRequired
}

export default CsvTransformPanel
