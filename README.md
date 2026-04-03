# Trackables

Trackables is an open source app for collecting structured responses and tracking API usage in one place.

It is built for teams that want simple forms, event logging, and a self-hostable setup without a large amount of product overhead.

Hosted version: [trackables.org](https://trackables.org)

## What It Does

Trackables supports two main workflows:

- Form-based collection for feedback, surveys, and structured submissions
- API-based event tracking with API keys, metadata, and history

## Big Features

### Forms and Responses

- Create trackable forms for feedback, surveys, and intake flows
- Build forms from reusable field types like ratings, checkboxes, notes, and short text
- Share forms publicly or keep them restricted
- Allow anonymous responses when needed
- Review submitted responses inside the dashboard

### API Usage Tracking

- Create API ingestion trackables for logs and usage events
- Generate API keys for authenticated workspaces
- Store both aggregate counts and individual events
- Attach metadata to events for filtering and later analysis
- Explore usage history from the dashboard

### Sharing and Access

- Organize trackables inside workspaces
- Invite teammates and manage access with workspace roles
- Support public access, private access, and more controlled sharing flows

### Operations and Integrations

- Query logged events with filtering and grouping support
- Configure webhooks for trackable events
- Use the built-in MCP tooling for agent workflows
- Run the app in multiple languages

## Good Fit For

- Feedback forms
- Survey collection
- Shared internal intake forms
- Lightweight event or log tracking
- Small teams that want to self-host their own data collection tools

## Stack

- Next.js
- TypeScript
- tRPC
- PostgreSQL
- Redis
- Tailwind CSS
- Clerk for authentication

## Self-Hosting

Trackables can be self-hosted with Docker. The repository includes working example files to get started:

- [example/docker-compose.yml](/example/docker-compose.yml)
- [example/.env.example](/example/.env.example)
- [example/trackables.config.example.json](/example/trackables.config.example.json)

### Requirements

- Docker and Docker Compose
- PostgreSQL
- Redis
- A Clerk application for authentication

### Basic Setup

1. Copy [example/.env.example](/example/.env.example) to `.env` and fill in your secrets and connection values.
2. Copy [example/trackables.config.example.json](/example/trackables.config.example.json) to `config.json`.
3. Keep secrets and infrastructure wiring in `.env`. Keep app behavior, plan metadata, limits, queue settings, and billing display config in `config.json`.
4. Create a Clerk app and add your publishable key, secret key, and webhook signing secret.
5. Create a Clerk webhook pointing to `https://<your-domain>/api/clerk/webhook`.
6. Subscribe that webhook to `user.created`, `user.updated`, and `user.deleted`.
7. If you want paid billing, enable it in `config.json` and add the Lemon Squeezy API key and webhook secret to `.env`.
8. Copy [example/docker-compose.yml](/example/docker-compose.yml) into your deployment directory. It reads container environment variables from `.env` via `env_file`, mounts `config.json` into the container at `/config.json`, and relies on app-side defaults instead of Compose-side env defaulting.
9. Start the stack with `docker compose up -d`.

After startup, open your app URL and sign in. Clerk handles authentication, while Trackables stores its app data in PostgreSQL and uses Redis for caching and queued work. The app reads deploy-time product/runtime settings from the external JSON config on startup, fills in omitted fields with app defaults, and fails fast only when the file is missing or contains invalid explicit values.

## Contributing

Contributions are welcome. If you want to improve Trackables, open an issue or submit a pull request.
