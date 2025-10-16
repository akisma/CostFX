import PropTypes from 'prop-types'

/**
 * DataTable Component
 * 
 * Reusable table for displaying raw/transformed data.
 * Supports custom columns, empty state, and responsive design.
 * 
 * Usage:
 * ```jsx
 * <DataTable
 *   columns={[
 *     { key: 'id', header: 'ID', render: (row) => row.id },
 *     { key: 'name', header: 'Name', render: (row) => row.name }
 *   ]}
 *   data={items}
 *   emptyMessage="No data available"
 * />
 * ```
 */
const DataTable = ({ 
  columns = [], 
  data = [], 
  emptyMessage = 'No data to display',
  className = '',
  maxHeight = '400px'
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div 
      className={`overflow-auto rounded-lg bg-gray-50 ${className}`}
      style={{ maxHeight }}
    >
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white border-b-2 border-gray-300">
          <tr>
            {columns.map((col) => (
              <th 
                key={col.key} 
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr 
              key={row.id || rowIndex} 
              className="hover:bg-gray-100 transition-colors"
            >
              {columns.map((col) => (
                <td 
                  key={`${rowIndex}-${col.key}`} 
                  className="px-4 py-3 text-gray-900"
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

DataTable.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      header: PropTypes.string.isRequired,
      render: PropTypes.func
    })
  ).isRequired,
  data: PropTypes.array,
  emptyMessage: PropTypes.string,
  className: PropTypes.string,
  maxHeight: PropTypes.string
}

export default DataTable
