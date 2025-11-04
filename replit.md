# Natural Language Database Query Chatbot

## Overview

This project is a natural language database query system that translates plain English questions into structured data responses with visualizations. It utilizes Azure OpenAI (GPT-4o) for natural language understanding, while all calculations are performed in TypeScript/Python. The application features a chat interface displaying data tables, charts, and raw JSON, and is designed for both standalone and embedded use. The business vision is to empower users with intuitive data access, reduce reliance on technical teams for ad-hoc reports, and unlock insights efficiently.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript using Vite, featuring Shadcn/UI components (built on Radix UI) styled with Tailwind CSS (new-york theme). It adopts a Material Design-inspired approach for data visualization, prioritizing clarity and high information density. Wouter handles lightweight client-side routing, and TanStack Query manages server state. Chart.js with react-chartjs-2 is used for data visualization, supporting bar, line, and pie charts. Key design decisions include embeddable-first functionality, tab-based data views (Table, Chart, Raw JSON), and a responsive layout.

### Backend

The backend uses Express.js with TypeScript. It provides a RESTful API with a primary endpoint (`POST /api/query`) for natural language questions. The query processing pipeline involves Zod for validation, Azure OpenAI for query intent classification and parameter extraction, TypeScript for date/number calculations, SQL generation from templates, external PostgreSQL execution, and formatted response packaging. The core `QueryEngine` orchestrates this process. The system relies on 98 predefined SQL query templates for comprehensive business intelligence scenarios. Azure OpenAI is exclusively used for understanding user intent, not for calculations, ensuring deterministic behavior.

### Data Storage

The application uses a dual-database approach:
- **Neon Postgres**: Primary database for application data (chat history, sessions, messages), accessed via `@neondatabase/serverless` and Drizzle ORM.
  - **Chats Table**: Stores chat metadata (id, session_id, title, timestamps)
  - **Messages Table**: Stores individual messages (id, chat_id, type, content, response data)
  - **Session Table**: Automatically managed by `connect-pg-simple` for session persistence
- **Supabase PostgreSQL**: External data source for analytical queries, accessed via the `pg` library with a dedicated connection pool.

### Authentication & Session Management

The application uses **session-based authentication** for transparent chat persistence:
- **Express-session** with PostgreSQL-backed session store (`connect-pg-simple`)
- Each visitor automatically receives a unique session ID (stored in browser cookies)
- Sessions persist for 30 days
- No user login required - completely anonymous and friction-free
- Session data automatically links chats to visitors for personalized history

## External Dependencies

### Third-Party Services

- **Azure OpenAI (GPT-4o)**: Used solely for natural language understanding, intent classification, and structured query parameter extraction. It does not perform calculations.
  - Endpoint: `aiage-mh4lk8m5-eastus2.cognitiveservices.azure.com`
  - API Version: `2024-12-01-preview`
  - Deployment: `gpt-4o`

### External Databases

- **Supabase PostgreSQL**: Provides the external data for analytical queries.
- **Neon PostgreSQL**: Serves as the application database for storing metadata and user information.

### UI Component Libraries

- **Radix UI**: Headless UI primitives for accessible and robust components.
- **Chart.js**: Core library for data visualization, with `react-chartjs-2` for React integration.

### Development Dependencies

- **Vite**: Build tool with plugins for React Fast Refresh and Replit-specific functionalities.
- **TypeScript**: Ensures type safety throughout the codebase.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Zod**: Runtime type validation.

## Recent Improvements

### Chat Persistence (November 4, 2025)
- **Session-based chat history**: All chats now automatically save to PostgreSQL database
  - Chats persist across browser refreshes and sessions (30-day cookie lifetime)
  - No user login required - uses anonymous session tracking
  - Sidebar displays full chat history for current session
  - Database schema: `chats` and `messages` tables with Drizzle ORM
  - Storage layer: `DbStorage` class with CRUD operations for chats/messages
  - API endpoints: GET/POST/DELETE `/api/chats` with session filtering
  - Tested and verified: End-to-end test confirms chats survive page refresh

### Earlier Improvements (November 3, 2025)

### Friendly Rate Limit Error Handling
- **Improved UX for rate limit errors**: Azure OpenAI rate limit errors now show friendly blue info alerts instead of alarming red errors
  - Detects "RateLimitReached" error code and extracts retry-after seconds
  - Frontend displays blue alert with Clock icon: "Our AI service is currently busy. Please try again in X seconds."
  - Applies to both main queries and follow-up questions

### Follow-Up Question UX
- **Clean toggle interface**: Follow-up section uses a single "Hide" button in the top right corner
  - Toggles between "Ask Question" (to expand) and "Hide" (to collapse)
  - Maintains conversation history while allowing users to minimize the section when not needed

### "Completed" Status Mapping Fix
- **Fixed "completed projects" queries**: System now correctly maps "completed" to "Won" status
  - Problem: Database has no "Completed" status (only Won, Lost, Lead, Submitted, In Progress, Proposal Development, Qualified Lead, Hold)
  - Solution: Added automatic mapping for common completion terms → "Won" status
  - Supported terms: "completed", "complete", "finished", "done", "closed" all map to "Won"
  - Example: "Projects completed in 2024" now correctly returns projects with Status="Won"
  - Updated function descriptions to clarify accepted status values