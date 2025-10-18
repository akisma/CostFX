import api from './api'

const CSV_UPLOAD_TYPES = {
  INVENTORY: 'inventory',
  SALES: 'sales'
}

const uploadCsv = async (type, { file, restaurantId }) => {
  if (!file) {
    throw new Error('A CSV file is required for upload')
  }

  const formData = new FormData()
  formData.append('file', file)

  if (restaurantId) {
    formData.append('restaurantId', restaurantId)
  }

  const endpoint = type === CSV_UPLOAD_TYPES.SALES
    ? '/data/csv/sales/upload'
    : '/data/csv/inventory/upload'

  const response = await api.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })

  return response.data
}

const transformCsv = async (type, uploadId, { restaurantId, dryRun = false } = {}) => {
  if (!uploadId) {
    throw new Error('uploadId is required to run a transform')
  }

  const endpoint = type === CSV_UPLOAD_TYPES.SALES
    ? `/data/csv/sales/${uploadId}/transform`
    : `/data/csv/inventory/${uploadId}/transform`

  const payload = {}

  if (typeof dryRun === 'boolean') {
    payload.dryRun = dryRun
  }

  if (restaurantId) {
    payload.restaurantId = restaurantId
  }

  const response = await api.post(endpoint, payload)
  return response.data
}

export const uploadInventoryCsv = (options) => uploadCsv(CSV_UPLOAD_TYPES.INVENTORY, options)
export const uploadSalesCsv = (options) => uploadCsv(CSV_UPLOAD_TYPES.SALES, options)

export const transformInventoryUpload = (uploadId, options = {}) =>
  transformCsv(CSV_UPLOAD_TYPES.INVENTORY, uploadId, options)

export const transformSalesUpload = (uploadId, options = {}) =>
  transformCsv(CSV_UPLOAD_TYPES.SALES, uploadId, options)

export { CSV_UPLOAD_TYPES }

export default {
  uploadInventoryCsv,
  uploadSalesCsv,
  transformInventoryUpload,
  transformSalesUpload
}
