# Executing on the goals in a task file
 
Guidelines for managing goal lists in task files to track progress on completing a task
 
## Input
 
- **Format:** Markdown (`.md`)
- **Location:** `.claude/tasks/$ARGUMENTS`
- **Filename:** `task.md`

## Task Implementation
- **Load background information**: **BEFORE** executing the goals, load the relevant background information
  1. Read the content from every Relevant Guide.
  2. Load Relevant Documentation resources using context7  

- **One parent goal at a time:** Do **NOT** start the next parent goal until you ask the user for permission and they say “yes” or "y"

- **Completion protocol:**  
  1. When you finish a **sub-goal**, immediately mark it as completed by changing `[ ]` to `[x]`.  
  2. If **all** sub-goals underneath a parent goal are now `[x]`, also mark the **parent goal** as completed.  

- Stop after each parent goal and wait for the user’s go‑ahead.
 
## Goal List Maintenance
 
1. **Update the goal list as you work:**
   - Mark goals and sub-goals as completed (`[x]`) per the protocol above.
   - Add new goals and sub-goals as they emerge.
 
2. **Maintain the “Relevant Files” section:**
   - List every file created or modified.
   - Give each file a one‑line description of its purpose.

## AI Instructions
 
When working with goal lists, the AI must:
 
1. Regularly update the goal list file after finishing any significant work.

2. Follow the completion protocol:
   - Mark each finished **goal** `[x]`.
   - Mark the **parent goal** `[x]` once **all** its sub-goals are `[x]`.

3. Add newly discovered goals.

4. Keep “Relevant Files” accurate and up to date.

5. Before starting work, check which sub-goal is next.

6. After implementing a sub-goal, update the file and then pause for user approval.