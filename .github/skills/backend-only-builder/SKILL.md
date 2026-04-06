---
name: backend-only-builder
description: 'Build and modify backend features while keeping frontend strictly read-only. Use for API work, database changes, backend bug fixes, and any request that must not edit frontend files unless explicitly authorized.'
argument-hint: 'Describe the backend task and whether frontend edits are explicitly allowed.'
user-invocable: true
disable-model-invocation: false
---

# Backend-Only Builder

## Purpose
Implement backend changes safely while preserving frontend files.

## Use This Skill When
- The task is backend-first: routes, controllers, services, models, database, auth, validation, and server configuration.
- Frontend context is needed only to understand existing API contracts or data flow.
- The user says backend-only, server-side only, API only, or do not touch frontend.

## Scope Rules
1. Write permissions:
- Allowed: `backend/**` and backend-adjacent project files that directly support backend delivery (for example root `README.md` backend docs if requested).
- Not allowed by default: `frontend/**`.

2. Frontend handling:
- Frontend files may be read for context.
- Frontend files must not be edited, created, renamed, or deleted.

3. Override gate:
- Frontend edits are allowed only after the agent asks: `do you want to edit front-end` and the user replies exactly `yes` (lowercase, no spaces).
- Any other response means frontend remains read-only.

## Procedure
1. Confirm boundary in one sentence:
- State that implementation will be backend-only and frontend remains read-only unless explicitly approved.

2. Gather context:
- Read relevant backend files first.
- Read frontend files only when needed to validate API expectations, request/response shapes, or integration assumptions.

3. Plan backend implementation:
- Identify impacted backend modules.
- Note contract impacts (endpoints, payloads, status codes, auth rules).

4. Implement backend changes:
- Edit only backend files.
- Preserve existing API behavior unless requirements call for contract updates.

5. Validate:
- Run backend checks/tests/lint where available.
- Verify that no frontend files were modified.

6. Report outcome:
- Summarize backend files changed.
- Call out any frontend assumptions discovered during read-only review.
- If frontend follow-up is needed, provide recommended changes without editing frontend code.

## Decision Points
- If a fix appears to require frontend changes:
1. Stop before editing frontend.
2. Propose backend-only alternatives first.
3. Ask `do you want to edit front-end`.
4. Proceed only if the reply is exactly `yes`.

- If user later authorizes frontend edits:
1. Confirm that authorization was exactly `yes`.
2. Proceed with minimal frontend changes required.
3. Clearly separate backend and frontend edits in the final summary.

## Completion Checks
- Backend requirement is implemented and validated.
- `frontend/**` has zero file modifications unless explicit user authorization was provided.
- Any contract shifts are documented with clear migration notes.

## Example Prompts
- `/backend-only-builder Add a JWT refresh endpoint and update token rotation in backend only.`
- `/backend-only-builder Fix order creation validation on the server. Read frontend forms if needed but do not modify frontend files.`
- `/backend-only-builder Implement wardrobe item filtering APIs and keep frontend untouched.`
