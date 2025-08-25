import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const ChartContainer = ({ title, data, type = 'line' }) => {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [`$${value}`, name]}
              labelFormatter={(label) => `Day: ${label}`}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="costs" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Costs"
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#22c55e" 
              strokeWidth={2}
              name="Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default ChartContainer