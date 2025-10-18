import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Database, Package, AlertCircle } from 'lucide-react';

/**
 * DataReviewPanel - Quick & Dirty UI to show imported vs transformed data
 * 
 * Shows:
 * - Tier 1: Raw Square data (square_menu_items, square_categories)
 * - Tier 2: Transformed inventory items
 */
export default function DataReviewPanel({ connectionId }) {
  const [tier1Data, setTier1Data] = useState({ categories: [], items: [] });
  const [tier2Data, setTier2Data] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!connectionId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch Tier 1 data (raw Square data)
      const tier1Response = await fetch(`/api/v1/pos/square/inventory/raw/${connectionId}`);
      if (!tier1Response.ok) {
        throw new Error('Failed to fetch Tier 1 data');
      }
      const tier1 = await tier1Response.json();
      setTier1Data(tier1.data || { categories: [], items: [] });

      // Fetch Tier 2 data (transformed inventory items)
      const tier2Response = await fetch(`/api/v1/pos/square/inventory/transformed/${connectionId}`);
      if (!tier2Response.ok) {
        throw new Error('Failed to fetch Tier 2 data');
      }
      const tier2 = await tier2Response.json();
      setTier2Data(tier2.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  useEffect(() => {
    if (connectionId) {
      fetchData();
    }
  }, [connectionId, fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-600">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tier 1: Raw Square Data */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Tier 1: Raw Square Data</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Data imported directly from Square (stored in square_* tables)
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Menu Items - Show First and Prominently */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">
              Menu Items ({tier1Data.items?.length || 0})
            </h4>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-700 border-b border-gray-300">
                  <tr>
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Description</th>
                    <th className="pb-2 pr-4">Price</th>
                    <th className="pb-2">Square ID</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  {tier1Data.items?.length > 0 ? (
                    tier1Data.items.map((item) => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="py-2 pr-4">{item.id}</td>
                        <td className="py-2 pr-4 font-medium">{item.name}</td>
                        <td className="py-2 pr-4 text-xs max-w-xs truncate" title={item.description}>
                          {item.description || '-'}
                        </td>
                        <td className="py-2 pr-4">
                          {item.price_money_amount ? `$${(item.price_money_amount / 100).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 font-mono text-xs">{item.square_catalog_object_id?.substring(0, 12)}...</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-4 text-center text-gray-500">No items imported</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Categories - Show as collapsible/secondary if present */}
          {tier1Data.categories?.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer font-medium text-gray-900 mb-3 flex items-center gap-2">
                <span className="transform transition-transform group-open:rotate-90">▶</span>
                Categories ({tier1Data.categories?.length || 0})
              </summary>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-auto mt-2">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-gray-700 border-b border-gray-300">
                    <tr>
                      <th className="pb-2 pr-4">ID</th>
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Square ID</th>
                      <th className="pb-2">Synced At</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-600">
                    {tier1Data.categories.map((cat) => (
                      <tr key={cat.id} className="border-b border-gray-200">
                        <td className="py-2 pr-4">{cat.id}</td>
                        <td className="py-2 pr-4 font-medium">{cat.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{cat.square_catalog_object_id?.substring(0, 12)}...</td>
                        <td className="py-2">{new Date(cat.last_synced_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Tier 2: Transformed Inventory Items */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold">Tier 2: Transformed Inventory Items</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Normalized inventory items in CostFX format (stored in inventory_items table)
          </p>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-700 border-b border-gray-300">
                <tr>
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Unit</th>
                  <th className="pb-2 pr-4">Unit Cost</th>
                  <th className="pb-2 pr-4">Stock</th>
                  <th className="pb-2">Source</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {tier2Data?.length > 0 ? (
                  tier2Data.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-2 pr-4">{item.id}</td>
                      <td className="py-2 pr-4 font-medium">{item.name}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{item.unit}</td>
                      <td className="py-2 pr-4">${parseFloat(item.unit_cost || 0).toFixed(2)}</td>
                      <td className="py-2 pr-4">{parseFloat(item.current_stock || 0).toFixed(2)}</td>
                      <td className="py-2">
                        <div className="text-xs">
                          <div className="font-mono">{item.source_pos_provider}</div>
                          <div className="text-gray-500">{item.source_pos_item_id}</div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center">
                      <div className="text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                        <p className="font-medium">No inventory items transformed yet</p>
                        <p className="text-sm">Click the &quot;Transform&quot; button to create inventory items from Square data</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {tier2Data?.length > 0 && (
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Total Items:</span> {tier2Data.length}
              </div>
              <div>
                <span className="font-medium">Categories:</span>{' '}
                {[...new Set(tier2Data.map(item => item.category))].length}
              </div>
              <div>
                <span className="font-medium">Units:</span>{' '}
                {[...new Set(tier2Data.map(item => item.unit))].length}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
}

DataReviewPanel.propTypes = {
  connectionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
