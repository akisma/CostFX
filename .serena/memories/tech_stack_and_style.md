# Tech Stack & Conventions
- Backend: Node.js 18+, Express, Sequelize ORM, PostgreSQL, Redis (optional), Vitest for tests, ESLint (eslint:recommended, no unused vars, prefer const), services hold business logic.
- Frontend: React 18, Vite, Redux Toolkit, React Query, Tailwind, Vitest + Testing Library, ESLint with React plugins (no warnings allowed).
- Shared patterns: Service layer for business logic, models keep schema only, heavy use of custom hooks/components for frontend, Swagger docs required for APIs.
- Process rules: Follow .claude/claude.md (research → plan → implement, ask before coding, spawn agents for parallel work, never skip tests, no TODOs, add docs to docs/TECHNICAL_DOCUMENTATION.md only).
- Coding style: Meaningful names, early returns, no hard-coded secrets, no versioned function names, add concise comments only for complex logic.
