# PR Review Plan

Given a github pull request: `$PR`

Create plan files based on complexity levels and types of changes. Use the following structure:

1. identify all unresolved comments for the given `$PR`
2. review each PR and it's code context to determine the complexity level and type of changes
3. for each type of complexity, create a plan file in the format `pr-review-plan-{pr}/{complexity}-{change}.md`
4. each plan should include only 1 type of `change`. As an example,
  - pr-review-plan-{pr}/low-no-spawn.md
  - pr-review-plan-{pr}/low-use-zod.md
  - pr-review-plan-{pr}/medium-use-background-task.md
  - pr-review-plan-{pr}/high-create-and-use-aws-eks-client-sdk.md

## Types of Complexity

- low: Simple changes that only require reading the code and effecting only 1 file
- medium: Changes that require reading multiple files, understanding the code context, and may involve some refactoring
- high: Complex changes that require deep understanding of the codebase, multiple files, and may involve significant refactoring or architectural changes