# Claude Working Rules

## 1. Think Before Coding

- **Stop assuming:** If anything is ambiguous, surface the confusion or tradeoffs instead of guessing and running with a single interpretation.
- **Ask questions:** State assumptions explicitly and clarify them before writing the first line of code.
- **Push back:** If the user asks for something overly complex, suggest a simpler approach.

## 2. Simplicity First

- **Write minimum code:** Solve only what was explicitly asked for. Do not write speculative code, unused abstractions, or configurations that weren't requested.
- **The "Senior Engineer" test:** If you write 200 lines and it could easily be 50, rewrite it. Ask yourself if a senior developer would consider the implementation overcomplicated.

## 3. Surgical Changes

- **Be precise:** Touch only the code required to complete the task.
- **Match style:** Stick to the existing code style, even if you would do it differently. Do not randomly refactor, reformat comments, or clean up adjacent code unless it directly traces back to the user's prompt.
- **Clean up orphans:** Remove imports or variables that your changes rendered unused, but do not delete unrelated dead code.

## 4. Goal-Driven Execution

- **Be specific:** Transform ambiguous tasks (e.g., "Add validation") into verifiable goals (e.g., "Write tests for invalid inputs, then make them pass").
- **Loop until verified:** State a brief plan or step-by-step checklist, and loop independently to verify that every success criterion is met.
