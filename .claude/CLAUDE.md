# Development Partnership

## 🚨 CRITICAL RULE #1 - NEVER BREAK THIS 🚨

### WAIT FOR USER APPROVAL BEFORE IMPLEMENTING

**YOU MUST NEVER IMPLEMENT CODE CHANGES WITHOUT EXPLICIT USER PERMISSION**

When you identify a problem and have multiple solution options:

1. ✅ **PRESENT OPTIONS** - Explain the different approaches clearly
2. ✅ **RECOMMEND** - Share which option you think is best and why  
3. ✅ **WAIT** - Stop and wait for the user to choose
4. ❌ **DO NOT IMPLEMENT** - Never proceed with code changes without permission

### VIOLATION EXAMPLES TO AVOID:
- "I'll create a simpler approach..." (then implementing it)
- "Let me modify the deployment workflow..." (then doing it)  
- "The cleanest approach is X" (then implementing X without asking)

### CORRECT BEHAVIOR:
- "I see the issue. Here are 3 options: A, B, C. I recommend B because... Which would you like me to implement?"
- "We could solve this by: 1) X approach, 2) Y approach, 3) Z approach. Should I proceed with one of these?"

### WHEN YOU CAN IMPLEMENT WITHOUT ASKING:
- User explicitly says "do it", "go ahead", "implement that", etc.
- User asks for a specific implementation by name
- You're fixing obvious typos or syntax errors in code already being written

### REMEMBER:
- The user values their autonomy and decision-making control
- Technical correctness doesn't override the need for permission
- Always ask before creating new files or modifying existing code
- Present options, recommend, then STOP and WAIT

**READ THIS BEFORE EVERY RESPONSE WHERE YOU IDENTIFY A SOLUTION TO IMPLEMENT**

---

We're building production-quality code together. Your role is to create maintainable, efficient solutions while catching potential issues early.

When you seem stuck or overly complex, I'll redirect you - my guidance helps you stay on track.

## 🚨 AUTOMATED CHECKS ARE MANDATORY
**ALL hook issues are BLOCKING - EVERYTHING must be ✅ GREEN!**  
No errors. No formatting issues. No linting problems. Zero tolerance.  
These are not suggestions. Fix ALL issues before continuing.

## CRITICAL WORKFLOW - ALWAYS FOLLOW THIS!

### Research → Plan → Implement
**NEVER JUMP STRAIGHT TO CODING!** Always follow this sequence:
1. **Research**: Explore the codebase, understand existing patterns
2. **Plan**: Create a detailed implementation plan and verify it with me  
3. **Implement**: Execute the plan with validation checkpoints

When asked to implement any feature, you'll first say: "Let me research the codebase and create a plan before implementing."

For complex architectural decisions or challenging problems, use **"ultrathink"** to engage maximum reasoning capacity. Say: "Let me ultrathink about this architecture before proposing a solution."

### USE MULTIPLE AGENTS!
*Leverage subagents aggressively* for better results:

* Spawn agents to explore different parts of the codebase in parallel
* Use one agent to write tests while another implements features
* Delegate research tasks: "I'll have an agent investigate the database schema while I analyze the API structure"
* For complex refactors: One agent identifies changes, another implements them

Say: "I'll spawn agents to tackle different aspects of this problem" whenever a task has multiple independent parts.

### Reality Checkpoints
**Stop and validate** at these moments:
- After implementing a complete feature
- Before starting a new major component  
- When something feels wrong
- Before declaring "done"
- **WHEN HOOKS FAIL WITH ERRORS** ❌

Run: `npm run lint && npm run build && npm test`

> Why: You can lose track of what's actually working. These checkpoints prevent cascading failures.

### 🚨 CRITICAL: Hook Failures Are BLOCKING
**When hooks report ANY issues, you MUST:**
1. **STOP IMMEDIATELY** - Do not continue with other tasks
2. **FIX ALL ISSUES** - Address every ❌ issue until everything is ✅ GREEN
3. **VERIFY THE FIX** - Re-run the failed command to confirm it's fixed
4. **CONTINUE ORIGINAL TASK** - Return to what you were doing before the interrupt
5. **NEVER IGNORE** - There are NO warnings, only requirements

This includes:
- Formatting issues (eslint, black, prettier, etc.)
- Linting violations (golangci-lint, eslint, etc.)
- Forbidden patterns (time.Sleep, panic(), interface{})
- ALL other checks

Your code must be 100% clean. No exceptions.

**Recovery Protocol:**
- When interrupted by a hook failure, maintain awareness of your original task
- After fixing all issues and verifying the fix, continue where you left off
- Use the todo list to track both the fix and your original task

## Working Memory Management

### When context gets long:
- Re-read this CLAUDE.md file
- Summarize progress in a PROGRESS.md file in this directory (.claude)
- Document current state before major changes
- Add knowledge to your Knowledge Graph MCP as it pertains to what we're working on, decisions made, what's done, what's next, etc; follow best practices.

### Maintain TODO.md:
```
## Current Task
- [ ] What we're doing RIGHT NOW

## Completed  
- [x] What's actually done and tested

## Next Steps
- [ ] What comes next
```

### ALL summary docs must go in /docs, not placed at the root!

## CODE & PROCESS SPECIFIC RULES

### FORBIDDEN - NEVER DO THESE:
- **NO hardcoding secrets or credentials EVER!!**
- **NO** keeping old and new code together
- **NO** versioned function names (processV2, handleNew)
- **NO** leaving test, debug, or scratch files around!
- **NO** TODOs in final code
- **NO** files with .skip added or trash lying around

### Required Standards:
- **Delete** old code when replacing it
- **Meaningful names**: `userID` not `id`
- **Early returns** to reduce nesting
- **Concrete types** from constructors: `func NewServer() *Server`
- **Table-driven tests** for complex logic
- **Channels for synchronization**: Use channels to signal readiness, not sleep
- **Select for timeouts**: Use `select` with timeout channels, not sleep loops
- **GIT**: DO NOT EVER INTERACT WITH GIT IN ANY OTHER FASHION THAN READ-ONLY!!! DO NOT STAGE COMMITS, DO NOT MAKE COMMITS.

## Implementation Standards

### Our code is complete when:
- ? All linters pass with zero issues
- ? All tests pass  
- ? Feature works end-to-end
- ? Old code is deleted
- ? Documentation has been provided IN context of the files!
- ? - Knowledge has been added to your Knowledge Graph MCP as it pertains to what we're working on, decisions made, what's done, what's next, etc; follow best practices.

### Testing Strategy
- Complex business logic ? Write tests first
- Simple CRUD ? Write tests after
- Hot paths ? Add benchmarks
- Skip tests for main() and simple CLI parsing

### Project Structure
```
backend/        # Back end
frontend/   # Front end
shared/        # shared code
docs/ # docs
```

### Environment
1. You are working on MAC OS - NOT linux! Don't try to use linux commands locally. Use the Mac OS equivalents.
2. our database is in a DOCKER CONTAINER - interact with it there, not via `psql`.

## Problem-Solving Together

When you're stuck or confused:
1. **Stop** - Don't spiral into complex solutions
2. **Delegate** - Consider spawning agents for parallel investigation
3. **Ultrathink** - For complex problems, say "I need to ultrathink through this challenge" to engage deeper reasoning
4. **Step back** - Re-read the requirements
5. **Simplify** - The simple solution is usually correct
6. **Ask** - "I see two approaches: [A] vs [B]. Which do you prefer?"

My insights on better approaches are valued - please ask for them!

## Performance & Security

### **Measure First**:
- No premature optimization
- Benchmark before claiming something is faster
- Use pprof for real bottlenecks

### **Security Always**:
- Validate all inputs
- Use crypto/rand for randomness
- Prepared statements for SQL (never concatenate!)

## Communication Protocol

### Progress Updates:
```
✓ Implemented authentication (all tests passing)
✓ Added rate limiting  
✗ Found issue with token expiration - investigating
```

### Suggesting Improvements:
"The current approach works, but I notice [observation].
Would you like me to [specific improvement]?"

## Working Together

- This is always a feature branch - no backwards compatibility needed
- When in doubt, we choose clarity over cleverness
- **REMINDER**: If this file hasn't been referenced in 30+ minutes, RE-READ IT!

Avoid complex abstractions or "clever" code. The simple, obvious solution is probably better, and my guidance helps you stay focused on what matters.
