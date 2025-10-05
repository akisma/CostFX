import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSnackbar } from 'notistack'
import PropTypes from 'prop-types'
import { MapPin, Search, Loader2, CheckCircle, Building2 } from 'lucide-react'
import {
  fetchSquareLocations,
  selectAvailableLocations,
  selectLoading,
  selectError,
  updateLocalSelectedLocations
} from '../../../store/slices/squareConnectionSlice'

/**
 * LocationSelector Component
 * 
 * Purpose: Multi-location selection UI for Square locations
 * Issue: #30 - Square OAuth Connection UI
 * 
 * Features:
 * - Multi-select checkbox interface
 * - Search/filter locations
 * - Display location details (name, address, capabilities)
 * - Validation (at least one location required)
 * - Loading and error states
 */
const LocationSelector = ({
  onLocationsSelected,
  onCancel,
  required = false,
  preselectedLocationIds = [],
  className = ''
}) => {
  const dispatch = useDispatch()
  const { enqueueSnackbar } = useSnackbar()

  const availableLocations = useSelector(selectAvailableLocations)
  const loading = useSelector(selectLoading)
  const error = useSelector(selectError)

  const [selectedIds, setSelectedIds] = useState(preselectedLocationIds)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  /**
   * Fetch available locations on mount
   */
  useEffect(() => {
    if (availableLocations.length === 0) {
      dispatch(fetchSquareLocations())
    }
  }, [availableLocations.length, dispatch])

  /**
   * Filter locations based on search term
   */
  const filteredLocations = availableLocations.filter((location) => {
    const searchLower = searchTerm.toLowerCase()
    const nameMatch = location.name?.toLowerCase().includes(searchLower)
    const addressMatch = location.address?.locality?.toLowerCase().includes(searchLower) ||
                         location.address?.city?.toLowerCase().includes(searchLower)
    return nameMatch || addressMatch
  })

  /**
   * Handle location checkbox toggle
   */
  const handleToggleLocation = (locationId) => {
    setSelectedIds((prev) => {
      if (prev.includes(locationId)) {
        return prev.filter((id) => id !== locationId)
      } else {
        return [...prev, locationId]
      }
    })
  }

  /**
   * Handle select all
   */
  const handleSelectAll = () => {
    if (selectedIds.length === filteredLocations.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredLocations.map((loc) => loc.id))
    }
  }

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    // Validation
    if (required && selectedIds.length === 0) {
      enqueueSnackbar('Please select at least one location', { variant: 'warning' })
      return
    }

    try {
      setIsSubmitting(true)

      // Get full location objects for selected IDs
      const selectedLocations = availableLocations.filter((loc) =>
        selectedIds.includes(loc.id)
      )

      // Update Redux state
      dispatch(updateLocalSelectedLocations(selectedLocations))

      // Call parent callback
      if (onLocationsSelected) {
        await onLocationsSelected(selectedIds, selectedLocations)
      }

      enqueueSnackbar(
        `${selectedIds.length} location(s) selected successfully`,
        { variant: 'success' }
      )
    } catch (err) {
      const errorMessage = err?.message || err || 'Failed to select locations'
      enqueueSnackbar(errorMessage, { variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  // Loading state
  if (loading.locations) {
    return (
      <div className={`p-6 bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Loader2 className="animate-spin text-blue-600" size={40} />
          <p className="text-gray-600">Loading available locations...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`p-6 bg-white rounded-lg border border-red-300 ${className}`}>
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-red-600">
          <p className="font-semibold">Failed to load locations</p>
          <p className="text-sm">{error}</p>
                    <button
            onClick={() => dispatch(fetchSquareLocations())}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No locations available
  if (availableLocations.length === 0) {
    return (
      <div className={`p-6 bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-gray-500">
          <Building2 size={48} />
          <p className="font-semibold">No locations available</p>
          <p className="text-sm text-center">
            No Square locations found for this account.
            Please ensure your Square account has active locations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MapPin size={20} />
          Select Locations to Sync
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Choose which Square locations to sync data from
        </p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Select All */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.length === filteredLocations.length && filteredLocations.length > 0}
            onChange={handleSelectAll}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Select All ({filteredLocations.length} location{filteredLocations.length !== 1 ? 's' : ''})
          </span>
        </label>
      </div>

      {/* Location List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredLocations.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No locations match your search
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredLocations.map((location) => {
              const isSelected = selectedIds.includes(location.id)
              
              return (
                <li key={location.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleLocation(location.id)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{location.name}</p>
                        {isSelected && (
                          <CheckCircle size={16} className="text-green-500" />
                        )}
                      </div>
                      
                      {location.address && (
                        <p className="text-sm text-gray-600 mt-1">
                          {[
                            location.address.addressLine1,
                            location.address.locality || location.address.city,
                            location.address.administrativeDistrictLevel1,
                            location.address.postalCode
                          ].filter(Boolean).join(', ')}
                        </p>
                      )}
                      
                      {location.capabilities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {location.capabilities.slice(0, 3).map((capability, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                            >
                              {capability}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {selectedIds.length} location{selectedIds.length !== 1 ? 's' : ''} selected
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || (required && selectedIds.length === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Selection</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

LocationSelector.propTypes = {
  onLocationsSelected: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  required: PropTypes.bool,
  preselectedLocationIds: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string
}

export default LocationSelector
