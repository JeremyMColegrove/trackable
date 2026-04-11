# Trackables

Trackables is an open source app for collecting structured responses and tracking API usage in one place.

It is built for teams that want simple forms, event logging, and a self-hostable setup without a large amount of product overhead.

Detailed setup guides, self-hosting documentation, and other operational docs live on the website so there is a single source of truth.

Hosted version: [trackables.org](https://trackables.org)

## What It Does

Trackables supports two main workflows:

- Form-based collection for feedback, surveys, and structured submissions
- API-based event tracking with API keys, metadata, and history

## Features

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

## Documentation

- Main site: [trackables.org](https://trackables.org)
- Self-hosting guide: [trackables.org/self-hosting](https://trackables.org/self-hosting)
- Config reference: [trackables.org/self-hosting/config](https://trackables.org/self-hosting/config)

## Tech Stack

- Next.js
- TypeScript
- tRPC
- PostgreSQL
- Redis
- Tailwind CSS
- better-auth

## Contributing

Contributions are welcome. Open an issue or submit a pull request.
