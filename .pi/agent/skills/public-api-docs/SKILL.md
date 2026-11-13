---
name: public-api-docs
description: Write concise, idiomatic documentation for public APIs when generating or modifying code. Use for public functions, classes, modules, types, and similar entities in any language.
---

# Document public code APIs

When generating or modifying code, add or update documentation for public API entities introduced or changed by the work. Treat an entity as public if its language-specific visibility modifier makes it public, or, where visibility modifiers do not apply, if it is exported or part of the module/package's public API.

Use the documentation convention and syntax idiomatic to the implementation language and project. Follow nearby examples when available. Write the documentation in the language used by the surrounding source documentation; if there is no clear convention, use the language of the codebase's existing comments.

Keep each documentation block concise: normally 3–5 lines and never more than 10 lines. Count the rendered documentation/comment lines, including delimiters or tags where practical. Do not pad documentation to reach a target length.

For public functions and methods, explain what the function does and include key implementation or behavioral details a caller or maintainer needs to know. Document important inputs, outputs, side effects, errors, invariants, or edge cases when relevant; do not restate an obvious signature line by line.

For public classes, modules, interfaces, types, and similar entities, explain their responsibility and intended purpose. Describe notable lifecycle, ownership, or usage constraints when relevant.

Do not add API documentation to private/internal entities unless needed to explain a non-obvious constraint. When changing an existing public entity, update stale documentation to match the new behavior. Avoid duplicating information already clear from the name, type signature, or nearby docs. Preserve project-specific style and do not invent guarantees or behavior.
