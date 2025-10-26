# Natural Language Database Query Chatbot

## Overview

This is a natural language database query system that allows users to ask questions in plain English and receive structured data responses with visualizations. The application uses Azure OpenAI (GPT-4o) for natural language understanding while performing all calculations (dates, numbers, ranges) in TypeScript/Python. It features a chat interface with support for data tables, charts, and raw JSON views, and is designed to work both as a standalone application and embedded via iframes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool

**UI Library**: Shadcn/UI components built on Radix UI primitives, styled with Tailwind CSS using the "new-york" theme preset

**Design System**: Material Design-inspired approach focused on data visualization and high-information-density interfaces. Uses Inter font for UI/body text and JetBrains Mono for code/JSON display.

**Routing**: Wouter for lightweight client-side routing with two main routes:
- `/` - Main chat interface
- `/embed` - Embeddable version of the chat interface

**State Management**: TanStack Query (React Query) for server state management and caching

**Data Visualization**: Chart.js with react-chartjs-2 wrappers for rendering bar, line, and pie charts

**Key Design Decisions**:
- **Embeddable-first**: Application is designed to work both standalone and in iframes
- **Tab-based data views**: Results displayed in three tabs (Table, Chart, Raw JSON) for data transparency
- **Responsive layout**: Mobile-friendly with breakpoint at 768px
- **Material Design principles**: Clarity over decoration, every element serves data presentation

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js

**API Design**: RESTful API with a single primary endpoint (`POST /api/query`) that accepts natural language questions

**Query Processing Pipeline**:
1. **Request Validation**: Zod schema validation for incoming requests
2. **Natural Language Classification**: Azure OpenAI classifies query intent and extracts parameters
3. **Date/Number Calculation**: All temporal and numerical calculations performed in TypeScript (not delegated to AI)
4. **SQL Generation**: Query templates populated with validated parameters
5. **External Database Execution**: SQL executed against external PostgreSQL database
6. **Response Formatting**: Data packaged with chart configurations and summary statistics

**Key Architectural Components**:
- **QueryEngine**: Core orchestration class that manages the query processing pipeline
- **SemanticTimeParser**: Handles natural language time references ("last week", "next month", etc.)
- **AzureOpenAIClient**: Wrapper for Azure OpenAI API interactions, limited to text understanding only
- **Query Templates**: Predefined SQL templates for different query types (by year, by status, by company, etc.)

**Separation of Concerns**:
- Azure OpenAI is used exclusively for understanding user intent and extracting entities
- All calculations (date arithmetic, number ranges, aggregations) are performed in TypeScript
- This ensures deterministic, testable behavior and reduces AI hallucination risks

### Data Storage Solutions

**Primary Database**: Neon Postgres (serverless PostgreSQL) for application data
- Accessed via `@neondatabase/serverless` with WebSocket support
- Connection pooling configured
- Drizzle ORM for type-safe database operations

**External Database**: Supabase PostgreSQL for queried data
- Separate connection pool managed via `pg` library
- Configuration:
  - Host: aws-1-us-east-1.pooler.supabase.com
  - Port: 6543
  - Connection pooling with max 20 connections
  - SSL disabled (internal network)
  - 10-second connection timeout

**Database Schema Management**: Drizzle Kit for migrations and schema management
- Schema defined in `shared/schema.ts`
- Migrations stored in `./migrations` directory
- Push-based deployment with `db:push` script

**Design Rationale**:
- Dual database approach separates application state from analytical data
- External database allows querying production data without affecting application performance
- Connection pooling prevents connection exhaustion under load

### Authentication and Authorization

**Current Implementation**: In-memory user storage (`MemStorage` class)
- UUID-based user IDs
- Username-based lookups
- No persistent storage (development/demo mode)

**Future Considerations**: The storage interface (`IStorage`) is designed to be swapped for database-backed implementations without changing application code.

### External Dependencies

#### Third-Party Services

**Azure OpenAI (GPT-4o)**:
- **Purpose**: Natural language understanding and query classification only
- **Endpoint**: aiage-mh4lk8m5-eastus2.cognitiveservices.azure.com
- **API Version**: 2024-12-01-preview
- **Deployment**: gpt-4o
- **Usage Pattern**: Function calling for structured query parameter extraction
- **Key Constraint**: AI is NOT used for calculations; only for semantic understanding

#### External Databases

**Supabase PostgreSQL**:
- **Purpose**: External data source for analytical queries
- **Schema**: "Sample" table with fields including Start Date, Fee, Status, Company
- **Access Pattern**: Read-only queries via dedicated connection pool

**Neon PostgreSQL**:
- **Purpose**: Application database (sessions, users, metadata)
- **Driver**: @neondatabase/serverless with WebSocket support

#### UI Component Libraries

**Radix UI**: Headless UI primitives (30+ components imported)
- Accordion, Dialog, Dropdown, Popover, Tabs, Toast, Tooltip, etc.
- Provides accessibility and keyboard navigation out of the box

**Chart.js**: Data visualization library
- Supports bar, line, and pie charts
- Configured with custom Material Design color schemes

#### Development Dependencies

**Vite Plugins**:
- `@vitejs/plugin-react` - React Fast Refresh
- `@replit/vite-plugin-runtime-error-modal` - Enhanced error overlays
- `@replit/vite-plugin-cartographer` - Development tooling (Replit-specific)
- `@replit/vite-plugin-dev-banner` - Development mode banner

**Build Tools**:
- **TypeScript**: Strict mode enabled with ESNext modules
- **Tailwind CSS**: Utility-first styling with custom theme
- **PostCSS**: CSS processing with autoprefixer
- **esbuild**: Fast server-side bundling for production

**Code Quality**:
- Zod for runtime type validation
- React Hook Form with Zod resolvers for form validation
- TypeScript path aliases for clean imports (@/, @shared/, @assets/)