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
- **Browser localStorage**: Chat history is persisted client-side using browser's localStorage API. Chats persist across page refreshes and browser sessions until the user clears browser data. This provides a simple, database-free chat persistence solution.
  - **Stored Data**: Chat metadata (id, title, created_at), messages (id, type, content, response), and follow-up questions
  - **Storage Key**: `rmone_chats`
  - **Implementation**: `client/src/lib/chatStorage.ts`
- **Supabase PostgreSQL**: External data source for analytical queries, accessed via the `pg` library with a dedicated connection pool.

### No Authentication Required

The application requires no authentication or database setup:
- **localStorage-based chat history**: All chat data is stored in the browser
- No server-side sessions or user accounts needed
- Completely anonymous and friction-free
- Chats persist until browser data is cleared
- Works immediately on any deployment (Replit, Render, Vercel, etc.) without database configuration

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

### Recent Changes (November 4, 2025)

#### Ordinal Position Support for Reference Projects
- **Fixed positional queries to use actual row numbers**: "first project", "second project", etc. now use natural database row ordering instead of fee-based sorting
  - **Problem**: "Take the first project and get all related by tag" was returning the highest-fee project, not the actual first row
  - **Solution**: Implemented `parseOrdinalPosition()` helper to distinguish positional queries from superlatives
  - **Positional queries** (natural database order): "first", "second", "third", "1st", "2nd", "10th" → uses OFFSET/LIMIT to get Nth row directly from database without any ORDER BY clause
  - **Superlative queries** (ordered by Fee DESC): "largest", "biggest", "top", "highest fee" → uses ORDER BY Fee to get highest-value project
  - Supports both word-based ("first", "second", "tenth") and numeric ordinals ("1st", "2nd", "3rd", "10th", etc.)
  - Example: "Take the first project and find all projects with the same tags" now correctly uses whatever is in the first row of the database table

#### Follow-up Questions Enhancement
- **Complete feature parity for follow-up questions**: Follow-up question responses now include all the same components as main query responses
  - Summary cards: Records, Total Value, Avg Fee, Avg Win Rate
  - AI Analysis section: Context-aware insights for each follow-up
  - Chart visualizations and data tables
  - Complete SQL logs and raw JSON responses
  - Follow-up questions maintain full conversational context
- **Fixed New Chat state reset**: "New Chat" button now properly clears all follow-up states
  - Resets follow-up visibility, input fields, loading states, and active tabs
  - Main input is immediately available after clicking "New Chat"
  - No residual state from previous chat sessions

#### Unlimited Query Results
- **Removed all query limits**: All database queries now return complete result sets
  - Removed hardcoded LIMIT 50 from default query templates
  - Removed LIMIT 100 from get_all_projects query
  - Removed LIMIT 50 from similarity/pattern analysis queries
  - All queries now return every matching record from the database
  - No artificial restrictions on data retrieval

#### Chat Persistence
- **localStorage-based chat history**: All chats now automatically save to browser's localStorage
  - Chats persist across browser refreshes and browser sessions
  - No user login or database required - completely client-side
  - Sidebar displays full chat history from localStorage
  - Implementation: `client/src/lib/chatStorage.ts` utility class
  - No API endpoints needed for chat storage (backend only handles queries)
  - Deployment-friendly: Works on any platform without database configuration
  - Data cleared only when user explicitly clears browser data

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