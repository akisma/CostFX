---
name: Feature Task
about: Create a comprehensive feature task with both product and technical acceptance criteria
title: 'Task [NUMBER]: [FEATURE NAME]'
labels: ['enhancement']
assignees: ''

---

**Priority:** [P0 - Critical | P1 - High | P2 - Medium | P3 - Low]  
**Estimate:** [X days/hours]  
**Dependencies:** [Task/Issue numbers or "None"]

## Product Acceptance Criteria (Customer Value)

**User Story:** As a [user type], I want [capability] so that [business value].

**Acceptance Scenarios:**
- [ ] **[Scenario Name]**: Given [context], When [action], Then [expected outcome with specific success criteria]
- [ ] **[Scenario Name]**: Given [edge case context], When [action], Then [expected handling]
- [ ] **[Scenario Name]**: Given [performance context], When [action], Then [performance expectation with metrics]

## Technical Implementation Checklist (Developer Tasks)

**Description:**
[Brief technical description of what needs to be implemented]

**Technical Acceptance Criteria:**
- [ ] [Specific technical deliverable with measurable completion criteria]
- [ ] [API endpoint, service, or component to create]
- [ ] [Error handling and edge case coverage]
- [ ] [Performance requirements and optimizations]
- [ ] [Security considerations and implementations]
- [ ] [Testing requirements (unit, integration, etc.)]

**Technical Details:**
```javascript
// Files to create/modify:
src/[path]/[filename].js
src/[path]/[filename].js

// API endpoints:
GET|POST|PUT|DELETE /api/v1/[endpoint]

// Database changes:
// - Table: [table_name]
// - Migration: [migration_description]
```

**Phase:** [Phase Number] - [Phase Name] ([Duration])
**Epic:** [Epic Name]

**Definition of Done:**
- [ ] Product acceptance scenarios validated
- [ ] All technical acceptance criteria completed
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Deployed to staging and tested
- [ ] Performance benchmarks met
- [ ] Security review completed (if applicable)

**Additional Notes:**
[Any additional context, constraints, or considerations]
