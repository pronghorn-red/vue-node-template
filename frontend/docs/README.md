# Frontend Documentation

This directory contains feature documentation for the frontend template. Each document covers a specific feature or system component.

## Available Documentation

### Core Features

- **[Authentication](./authentication.md)** - JWT token management, session recovery, OAuth callbacks, route guards
- **[WebSocket](./websocket.md)** - WebSocket connection management, message routing, task management, reconnection
- **[LLM Integration](./llm-integration.md)** - LLM composable, model selection, streaming (WebSocket/SSE), parallel requests

### User Interface

- **[User Management](./user-management.md)** - Profile management, admin user operations, role management UI
- **[Routing & Navigation](./routing.md)** - Vue Router configuration, route guards, role-based access
- **[Layout & UI Components](./layout-ui.md)** - AppLayout component, navigation, user menu, PrimeVue integration

### Utilities

- **[API Client](./api-client.md)** - Axios instance with automatic token refresh, request/response interceptors
- **[Dark Mode](./dark-mode.md)** - Dark mode composable, system preference detection, Chart.js integration
- **[Internationalization](./internationalization.md)** - Vue I18n setup, English/French support, language switching

## Quick Links

- [Authentication Flow](./authentication.md#how-it-works)
- [WebSocket Connection](./websocket.md#how-it-works)
- [LLM Streaming](./llm-integration.md#how-to-use-it)
- [Route Guards](./routing.md#how-it-works)
- [Dark Mode Setup](./dark-mode.md#configuration)

## Getting Started

1. **Setup Authentication**: See [Authentication](./authentication.md#configuration)
2. **Configure API Client**: See [API Client](./api-client.md#configuration)
3. **Setup Routing**: See [Routing](./routing.md#configuration)
4. **Customize Layout**: See [Layout & UI](./layout-ui.md#extending--modifying)

## Related Documentation

- [Backend Documentation](../backend/docs/README.md) - Backend feature docs
- [Main README](../../README.md) - Project overview and setup
