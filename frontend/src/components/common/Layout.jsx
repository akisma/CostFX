import { NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'
import { 
  LayoutDashboard, 
  Package, 
  ChefHat, 
  BarChart3, 
  TrendingUp,
  AlertTriangle,
  Calendar
} from 'lucide-react'

const Layout = ({ children }) => {
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Recipes', href: '/recipes', icon: ChefHat },
    { 
      name: 'Analysis', 
      icon: BarChart3,
      children: [
        { name: 'Cost Analysis', href: '/analysis/costs', icon: TrendingUp },
        { name: 'Waste Analysis', href: '/analysis/waste', icon: AlertTriangle },
        { name: 'Forecast', href: '/analysis/forecast', icon: Calendar }
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b border-gray-200">
            <ChefHat className="h-8 w-8 text-primary-500" />
            <span className="ml-3 text-xl font-semibold text-gray-900">CostFX</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <div>
                    <div className="flex items-center px-3 py-2 text-sm font-medium text-gray-600">
                      <item.icon className="h-5 w-5 mr-3" />
                      {item.name}
                    </div>
                    <div className="ml-6 space-y-1">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.name}
                          to={child.href}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                              isActive
                                ? 'bg-primary-50 text-primary-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                          }
                        >
                          <child.icon className="h-4 w-4 mr-3" />
                          {child.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                ) : (
                  <NavLink
                    to={item.href}
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </NavLink>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired
}

export default Layout