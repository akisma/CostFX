import { useState } from 'react'
import { useSnackbar } from 'notistack'

/**
 * useCsvUploadWorkflow Hook
 *
 * Handles two-step CSV workflow (upload -> transform) for inventory and sales files.
 * Preserves consistent messaging with POS sync flows while remaining provider agnostic.
 */
const useCsvUploadWorkflow = ({
  uploadFn,
  transformFn,
  dataTypeName,
  restaurantId
}) => {
  const { enqueueSnackbar } = useSnackbar()

  const [isUploading, setIsUploading] = useState(false)
  const [isTransforming, setIsTransforming] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [transformResult, setTransformResult] = useState(null)
  const [error, setError] = useState(null)

  const handleUpload = async (file) => {
    if (!file) {
      enqueueSnackbar('Please select a CSV file before uploading.', { variant: 'warning' })
      return null
    }

    try {
      setIsUploading(true)
      setError(null)

      enqueueSnackbar(`Uploading ${dataTypeName} CSV...`, { variant: 'info' })

      const result = await uploadFn({ file, restaurantId })
      setUploadResult(result)

      enqueueSnackbar(`${dataTypeName} CSV validated successfully.`, { variant: 'success' })
      return result
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Upload failed'
      setError(errorMessage)
      enqueueSnackbar(`Upload failed: ${errorMessage}`, { variant: 'error' })
      throw err
    } finally {
      setIsUploading(false)
    }
  }

  const handleTransform = async ({ uploadId, dryRun = false } = {}) => {
    const effectiveUploadId = uploadId || uploadResult?.uploadId

    if (!effectiveUploadId) {
      enqueueSnackbar('An upload must be completed before transformation.', { variant: 'warning' })
      return null
    }

    try {
      setIsTransforming(true)
      setError(null)

      enqueueSnackbar(`Transforming ${dataTypeName} CSV...`, { variant: 'info' })

      const result = await transformFn(effectiveUploadId, { restaurantId, dryRun })
      setTransformResult(result)

      const successMessage = dryRun
        ? `${dataTypeName} transform dry-run completed.`
        : `${dataTypeName} data transformed successfully.`

      enqueueSnackbar(successMessage, { variant: 'success' })
      return result
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Transformation failed'
      setError(errorMessage)
      enqueueSnackbar(`Transform failed: ${errorMessage}`, { variant: 'error' })
      throw err
    } finally {
      setIsTransforming(false)
    }
  }

  const reset = () => {
    setUploadResult(null)
    setTransformResult(null)
    setError(null)
  }

  return {
    isUploading,
    isTransforming,
    uploadResult,
    transformResult,
    error,
    handleUpload,
    handleTransform,
    reset
  }
}

export default useCsvUploadWorkflow
