import { renderHook, act } from '@testing-library/react'
import { vi, beforeEach, describe, it, expect } from 'vitest'

const enqueueSnackbarMock = vi.fn()

vi.mock('notistack', async () => {
  const actual = await vi.importActual('notistack')
  return {
    ...actual,
    useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock })
  }
})

import useCsvUploadWorkflow from '../../src/hooks/useCsvUploadWorkflow.js'

describe('useCsvUploadWorkflow', () => {
  beforeEach(() => {
    enqueueSnackbarMock.mockReset()
  })

  it('uploads a file and stores the upload result', async () => {
    const uploadResult = { uploadId: 42, readyForTransform: true }
    const uploadFn = vi.fn().mockResolvedValue(uploadResult)
    const transformFn = vi.fn()

    const { result } = renderHook(() =>
      useCsvUploadWorkflow({
        uploadFn,
        transformFn,
        dataTypeName: 'Inventory',
        restaurantId: 7
      })
    )

    await act(async () => {
      await result.current.handleUpload({ name: 'inventory.csv' })
    })

    expect(uploadFn).toHaveBeenCalledWith({ file: { name: 'inventory.csv' }, restaurantId: 7 })
    expect(result.current.uploadResult).toEqual(uploadResult)
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Uploading Inventory CSV...', { variant: 'info' })
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Inventory CSV validated successfully.', { variant: 'success' })
  })

  it('warns when transform is attempted before upload', async () => {
    const uploadFn = vi.fn()
    const transformFn = vi.fn()

    const { result } = renderHook(() =>
      useCsvUploadWorkflow({
        uploadFn,
        transformFn,
        dataTypeName: 'Sales',
        restaurantId: 9
      })
    )

    await act(async () => {
      await result.current.handleTransform()
    })

    expect(transformFn).not.toHaveBeenCalled()
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('An upload must be completed before transformation.', { variant: 'warning' })
  })

  it('runs transform and records result including dry-run flag', async () => {
    const uploadResult = { uploadId: 11, readyForTransform: true }
    const transformResult = { status: 'completed' }

    const uploadFn = vi.fn().mockResolvedValue(uploadResult)
    const transformFn = vi.fn().mockResolvedValue(transformResult)

    const { result } = renderHook(() =>
      useCsvUploadWorkflow({
        uploadFn,
        transformFn,
        dataTypeName: 'Inventory',
        restaurantId: 3
      })
    )

    await act(async () => {
      await result.current.handleUpload({ name: 'inventory.csv' })
    })

    await act(async () => {
      await result.current.handleTransform({ dryRun: true })
    })

    expect(transformFn).toHaveBeenCalledWith(11, { restaurantId: 3, dryRun: true })
    expect(result.current.transformResult).toEqual(transformResult)
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Inventory CSV validated successfully.', { variant: 'success' })
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Inventory transform dry-run completed.', { variant: 'success' })
  })

  it('captures errors emitted during upload', async () => {
    const failingUpload = vi.fn().mockRejectedValue(new Error('Network failure'))
    const { result } = renderHook(() =>
      useCsvUploadWorkflow({
        uploadFn: failingUpload,
        transformFn: vi.fn(),
        dataTypeName: 'Sales',
        restaurantId: 12
      })
    )

    let caught
    await act(async () => {
      try {
        await result.current.handleUpload({ name: 'sales.csv' })
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect(caught.message).toBe('Network failure')
    expect(result.current.error).toBe('Network failure')
    expect(enqueueSnackbarMock).toHaveBeenCalledWith('Upload failed: Network failure', { variant: 'error' })
  })
})
