# agents.md

## Purpose

This project is a web application for creating and managing **trackable items**.

A trackable item is a shareable resource that can collect structured responses from people and can also track usage through an API. The platform supports both:

1. **Public or restricted form-based submissions**
2. **API-based usage tracking with API keys**

The goal of the codebase is to remain **clean, simple, generic, and highly maintainable**. Favor clarity over cleverness. Build reusable abstractions only when they genuinely reduce duplication and improve consistency.

---

## Core Product Concepts

### Trackable Items
Users can log in and create trackable items.

Each trackable item may include:

- A title, description, and basic metadata
- Sharing/access configuration
- A customizable public-facing form
- Usage tracking data
- Submission history
- API usage history

### Share Options
A trackable item can be shared in one or more ways:

- Private to the owner
- Shared with specific users
- Shared with specific email addresses
- Public to anyone with the link

Design access control so it is explicit, composable, and easy to extend.

### Custom Form Components
Each trackable item can define a simple form shown on its public page.

Supported form component types may include:

- Quick rating
- Checkboxes
- Notes / text input

Form components should be modeled generically so new component types can be added later without rewriting the system.

Responses submitted through these forms should be stored as tracked responses associated with the trackable item.

### API Usage Tracking
Authenticated users can create API keys from their account.

These API keys are used to track item usage through a tRPC-based API flow. The primary behavior is:

- Client provides an item identifier and API key
- The system validates permissions and API key ownership/access
- The system increments a usage counter for that item
- The system stores a usage event with timestamp and metadata from the payload

Usage tracking should support:

- Aggregate counts
- Event history
- Metadata attached to each event
- Future reporting and analytics

---

## Tech Constraints

### Required Stack
- Use **tRPC only**
- Do **not** create traditional server routes / REST routes
- Use **Tailwind CSS only**
- Favor TypeScript-first design throughout the codebase

### Architectural Expectations
- Keep code **clean, DRY, and predictable**
- Prefer **simple abstractions** over premature generalization
- Use **helpers**, **connectors**, and **shared utilities** where appropriate
- Keep domain logic out of UI components
- Keep transport concerns out of business logic
- Keep validation close to boundaries
- Keep types explicit and reusable

---

## Coding Principles

### 1. Simplicity First
Choose the simplest design that cleanly supports current requirements.

Do not over-engineer for hypothetical future features, but do avoid designs that make obvious future expansion painful.

### 2. Strong Separation of Concerns
Organize code so responsibilities are clear:

- **UI components** render data and collect input
- **Procedures / routers** define application entry points
- **Services** contain business logic
- **Repositories / data helpers** handle persistence
- **Validators / schemas** define input and output contracts
- **Authorization helpers** centralize permission checks

### 3. Reuse Through Good Boundaries
Avoid duplication, but do not hide simple behavior behind unnecessary abstraction.

Good candidates for reuse:
- Access control checks
- Form component parsing/validation
- API key validation
- Usage event creation
- Shared query patterns
- UI primitives and layout patterns

### 4. Generic, Extensible Domain Modeling
Model systems in a way that allows future expansion.

Examples:
- Form components should be type-driven and extensible
- Share settings should not assume only one sharing mode
- Usage tracking should support additional event types later
- Metadata should allow structured extension without breaking current behavior

### 5. Explicitness Over Magic
Prefer readable code and obvious data flow.

- Avoid hidden side effects
- Avoid tightly coupled modules
- Avoid unclear utility layers
- Name things based on domain meaning, not implementation accidents

---

## Recommended Domain Structure

Use domain-oriented organization rather than grouping everything by technical type only.

Example high-level domains:

- `auth`
- `trackable-items`
- `sharing`
- `form-components`
- `responses`
- `api-keys`
- `usage-tracking`

Within each domain, keep a consistent structure where helpful, such as:

- router / procedures
- service
- db access layer
- schemas
- types
- helpers

Exact folder names can vary, but the structure should make it obvious where domain logic lives.

---

## Domain Rules

### Trackable Items
- A trackable item belongs to an authenticated user account
- Owners can create, update, archive, and view their items
- Access rules determine whether another person may view or submit to the item

### Sharing
Treat sharing as a first-class domain.

Support these concepts cleanly:
- owner access
- allowed users
- allowed email recipients
- link-based access

All reads and writes involving a trackable item must go through clear authorization checks.

Do not scatter access logic across random components or procedures.

### Form Components
Form components should be represented by a discriminated type or equivalent structure.

Each component type should define:
- configuration schema
- display behavior
- submission schema
- normalization/parsing rules

Do not hardcode component behavior in multiple places.

A submission should be validated against the current trackable item form definition.

### Responses
A response belongs to a trackable item.

Responses should store:
- submitted values
- submission timestamp
- submitter context when available
- any useful metadata allowed by the product

Response handling should be generic enough to support all component types.

### API Keys
API keys belong to a user account.

Requirements:
- store securely
- never expose raw secrets after creation unless intentionally designed
- support revocation / disablement
- validate ownership and permissions before usage is accepted

### Usage Tracking
A usage event should be more than just a counter increment.

Store both:
- a fast aggregate count for display/querying
- individual usage events for history and metadata inspection

Each usage event may include:
- timestamp
- item id
- api key id
- payload metadata
- optional source context such as IP, label, or client identifier if supported

Design this area so analytics can be expanded later without reworking the foundation.

---

## tRPC Guidelines

- Use tRPC for all application procedures
- Keep procedures thin
- Move non-trivial logic into services
- Validate all inputs with shared schemas
- Return well-shaped outputs
- Keep authorization checks explicit and consistent
- Separate public procedures from authenticated procedures carefully

Example categories of procedures:
- item management
- share management
- form definition management
- form submission
- API key management
- usage tracking
- analytics/reporting

Do not let routers become large containers of inline business logic.

---

## UI Guidelines

- Use Shadcn and Tailwind CSS only
- Keep components small and composable
- Build reusable primitives for common UI patterns, only if Shadcn does not have the component
- Avoid mixing heavy business logic into React components
- Forms should be driven by schemas/config when possible
- Public submission flows should be simple and minimal
- Authenticated dashboard flows should prioritize clarity and manageability

Prefer:
- clear layout components
- shared empty/loading/error states
- reusable form field renderers where they reduce duplication
- domain-specific components that remain presentational when possible

---

## Data Modeling Guidance

Favor normalized core entities with flexible metadata only where it makes sense.

Likely core entities include:
- user
- trackable item
- share rule / share target
- form component definition
- response
- API key
- usage aggregate
- usage event

Be careful not to overuse JSON blobs where relational structure would be clearer.

Use structured fields for core business data. Use flexible metadata only for peripheral or evolving fields.

---

## Validation and Types

- Define shared schemas at system boundaries
- Infer TypeScript types from schemas where appropriate
- Reuse schemas between tRPC procedures and domain services when it improves consistency
- Validate public submissions strictly
- Validate usage payloads before persistence
- Normalize data before saving when needed

All external input should be treated as untrusted.

## Migration Rules

- AI must **never** hand-write, invent, or manually edit Drizzle migration SQL files or Drizzle metadata snapshots.
- Schema changes may be made in source definitions, but migration artifacts must always be generated by `drizzle-kit`.
- When a schema change requires a migration, use `drizzle-kit generate`; do not create custom generators or manual migration files.

---

## Error Handling

- Fail clearly and predictably
- Use domain-meaningful errors
- Avoid vague generic failures
- Return user-safe messages at the boundary
- Log enough internal context for debugging
- Keep validation, authorization, and business-rule failures distinct

---

## Performance and Maintainability

- Optimize for correctness and clarity first
- Avoid unnecessary queries and repeated access checks
- Centralize common lookups where it reduces duplication
- Be mindful of write-heavy usage tracking paths
- Keep read models and aggregate counters efficient

For usage tracking specifically:
- write paths should be simple and reliable
- aggregate updates should not make event logging fragile
- the design should support future batching or analytics improvements if needed

---

## What to Avoid

- No REST/server routes when tRPC can handle it
- No Tailwind alternatives or mixed styling systems
- No business logic embedded deeply in UI components
- No duplicated authorization logic
- No oversized “god files” or “god services”
- No premature framework-like abstraction layers
- No clever patterns that reduce readability
- No tightly coupling form rendering, validation, and persistence into one module

---

## Preferred Mindset for Agents

When contributing to this codebase:

- Think in terms of **domains**
- Keep logic **small, testable, and composable**
- Create abstractions only when they remove real duplication
- Prefer **generic but understandable** systems
- Keep future extensibility in mind, but do not overbuild
- Preserve a codebase that another engineer can quickly understand

Every change should make the system either:
- simpler,
- clearer,
- more reusable,
- or easier to extend safely.

If an abstraction does not clearly help one of those goals, do not add it.
