# Rule: Generate / update a task file
 
## Goal
 
To guide an AI assistant in providing a detailed, task analysis in Markdown format based on an existing task information. The task updates should guide a developer through implementation.
 
## Output
 
- **Format:** Markdown (`.md`)
- **Location:** `.claude/tasks/$ARGUMENTS`
- **Filename:** `task.md`
 
## Process
 
1.  **Receive task reference:** The user points the AI to a specific task file.

2.  **Analyze task objective:** The AI reads and analyzes the task Objective, Goals, and Implementation Details.

3.  **Identify Relevant Guides:** Based on the task information and goals, identify the relevant `README.md`, `CLAUDE.md`,
and `STYLEGUIDE.md` files that need to be following during the planning and implementation and planning of this task. List them
in the `Relevant Guides` section. Analyze their content before proceeding.

4.  **Ask relevant questions:** Based on the task information, think deeply to identify any potential questions that would assist in defining the task plan. Limit to under 20 questions. Document those questions under the Discussion section. Update the task file.

5.  **Identify Relevant Files:** Based on the task information and goals, identify potential files that will need to be created or modified. List these under the `Relevant Files` section, including corresponding test files if applicable.

6.  **Identify Relevant Documentation:** Based on the task information and goals, identify potential documentation resources from Context7 that will need sourced. List these under the `Relevant Documentation` section.

7.  **Wait for Confirmation:** Pause and wait for the user to respond with "Go". When proceeding, review the answers to the questions
generated in step 4. Think deeply to determine if any follow-up questions are necessary. If so, return to step 4.

8.  **Generate Parent Goals:** Based on the analysis, update the task file and generate the main, high-level goals required to implement the feature. Use your judgement on how many high-level goals to use. It's likely to be less than 10. Present these goals to the user in the specified format (without sub-goals yet). Inform the user: "I have generated the high-level goals based on the task. Ready to generate the sub-goals? Respond with 'Go' to proceed."

9.  **Wait for Confirmation:** Pause and wait for the user to respond with "Go".

10.  **Generate Sub-Goals:** Once the user confirms, break down each parent goal into smaller, actionable sub-goals necessary to complete the parent goal. Ensure sub-goals logically follow from the parent goal and cover the implementation details implied by
the remainder of the file. Update the task file.
 
## Output Format
 
- The generated task file **MUST** follow the structure outlined in the root `CLAUDE.md`. However, do **NOT** fill in sections
  that have not yet been reached in the Process steps.
 
## Interaction Model

- **NEVER** update the task file unless explicitly instructed by "Update the task file" in a Process step.

- You **MUST** complete the Process steps step-by-step (sequentially). Do not skip ahead.

- The process explicitly requires a pause when "Wait for Confirmation" steps are reached. This ensures the high-level plan aligns with user expectations before diving into details.

- **DO NOT BEGIN IMPLEMENTATION** on any of the goals.

- Do **NOT** fill in sections that have not yet been reached in the Process steps.
 
## Target Audience
 
Assume the primary reader of the task list is a **junior developer** who will implement the feature.
 