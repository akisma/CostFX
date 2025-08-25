# Restaurant AI Operations System - CostFX

An AI-powered restaurant operations optimization system that provides actionable insights on food waste, cost optimization, inventory management, and operational efficiency.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- Docker and Docker Compose
- OpenAI API key (for AI agents)
- Pinecone account (optional, for advanced features)

### Installation

1. **Clone and setup**
```bash
cd /Users/jessjacobs/Desktop/CostFX
npm install
```

2. **Environment configuration**
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
```

3. **Start services**
```bash
# Start database and Redis
npm run docker:up

# Run database migrations and seed data
npm run db:migrate
npm run db:seed

# Start development servers (backend + frontend)
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api-docs

### Alternative Setup (One Command)
```bash
npm run setup
```

## 📁 Project Structure

```
CostFX/
├── backend/          # Node.js API server
│   ├── src/
│   │   ├── config/   # Database, Redis configuration
│   │   ├── models/   # Sequelize models
│   │   ├── routes/   # API routes
│   │   ├── controllers/ # Route handlers
│   │   ├── agents/   # AI agent implementations
│   │   ├── services/ # Business logic
│   │   └── middleware/ # Express middleware
│   └── tests/        # Backend tests
├── frontend/         # React application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── services/   # API services
│   │   ├── store/      # Redux store
│   │   └── hooks/      # Custom React hooks
│   └── tests/        # Frontend tests
└── shared/           # Shared types and utilities
```

## 🧠 AI Agents

The system includes specialized AI agents:

1. **Inventory Agent** - Stock management, waste prediction, ordering optimization
2. **Cost Agent** - Dish profitability analysis, cost-saving opportunities  
3. **Forecast Agent** - Demand prediction, prep time calculations
4. **Recipe Agent** - Standardization, scaling, consistency monitoring

## 📊 Key Features

- **Food Waste Analysis** - Track waste patterns and identify reduction opportunities
- **Cost Per Dish Calculation** - Real-time profitability analysis
- **Intelligent Ordering** - AI-powered purchase recommendations
- **Prep Time Forecasting** - Optimize kitchen operations
- **Real-time Dashboard** - Monitor key metrics and alerts

## 🛠 Development

### Available Scripts

**Root level:**
- `npm run dev` - Start both backend and frontend
- `npm run test` - Run all tests
- `npm run build` - Build for production
- `npm run setup` - Complete setup from scratch

**Backend:**
- `npm run dev` - Start development server with hot reload
- `npm test` - Run backend tests
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

**Frontend:**
- `npm run dev` - Start Vite development server
- `npm test` - Run frontend tests with Vitest
- `npm run build` - Build for production

## 📈 Data Collection Format

For Dave's recipe and operational data collection:

### Recipe Format
```json
{
  "name": "Chicken Parmesan",
  "category": "main_course",
  "servingSize": 1,
  "prepTimeMinutes": 20,
  "cookTimeMinutes": 25,
  "ingredients": [
    {
      "name": "Chicken Breast",
      "quantity": 6,
      "unit": "oz",
      "preparationMethod": "pounded thin"
    }
  ]
}
```

### Ingredient Database Structure
```json
{
  "name": "Chicken Breast",
  "category": "protein",
  "unitType": "weight",
  "standardUnit": "lb",
  "avgCostPerUnit": 4.50,
  "storageType": "refrigerated",
  "shelfLifeDays": 5,
  "typicalWastePercentage": 0.03
}
```

## 🧪 Testing

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
cd backend && npm run test:coverage
cd frontend && npm run test:coverage
```

## 🔧 Tech Stack

### Backend
- Node.js with Express
- PostgreSQL for primary data storage
- Redis for caching
- Sequelize ORM
- OpenAI API for AI agents
- Winston for logging

### Frontend
- React 18 with Hooks
- Vite for development and builds
- Redux Toolkit for state management
- React Query for server state
- Tailwind CSS for styling
- Recharts for data visualization

### Development
- Jest for backend testing
- Vitest for frontend testing
- ESLint for code quality
- Docker for development environment

## 📝 Next Steps

1. **Complete the missing files** - Several placeholder components and models need implementation
2. **Set up OpenAI integration** - Configure AI agents with your API key
3. **Database setup** - Create initial migrations and seed data
4. **Data collection** - Work with Dave to standardize recipe and operational data
5. **Agent training** - Feed business logic and industry benchmarks into AI agents

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Run tests and linting
5. Submit a pull request

## 📞 Support

For questions about setup or development:
- Check the project documentation
- Review the API endpoints at `/api/v1`
- Test the development environment with `npm run dev`

---

**Built for restaurant operations optimization with AI-powered insights.**