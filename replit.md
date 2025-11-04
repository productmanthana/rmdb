# Natural Language Database Query Chatbot

## Overview

This project is a natural language database query system that translates plain English questions into structured data responses with visualizations. It utilizes Azure OpenAI (GPT-4o) for natural language understanding, while all calculations are performed in TypeScript/Python. The application features a chat interface displaying data tables, charts, and raw JSON, and is designed for both standalone and embedded use. The business vision is to empower users with intuitive data access, reduce reliance on technical teams for ad-hoc reports, and unlock insights efficiently.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript using Vite, featuring Shadcn/UI components (built on Radix UI) styled with Tailwind CSS (new-york theme). It adopts a Material Design-inspired approach for data visualization, prioritizing clarity and high information density. Wouter handles lightweight client-side routing, and TanStack Query manages server state. Chart.js with react-chartjs-2 is used for data visualization, supporting bar, line, and pie charts. Key design decisions include embeddable-first functionality, tab-based data views (Table, Chart, Raw JSON), responsive layout, and virtual scrolling for large datasets.

### Backend

The backend uses Express.js with TypeScript. It provides a RESTful API with a primary endpoint (`POST /api/query`) for natural language questions. The query processing pipeline involves Zod for validation, Azure OpenAI for query intent classification and parameter extraction, TypeScript for date/number calculations, SQL generation from templates, external PostgreSQL execution, and formatted response packaging. The core `QueryEngine` orchestrates this process. The system relies on 98 predefined SQL query templates for comprehensive business intelligence scenarios. Azure OpenAI is exclusively used for understanding user intent, not for calculations, ensuring deterministic behavior. The system also handles space-insensitive PID matching and supports column-specific queries.

### Data Storage

The application uses a dual-database approach:
- **Browser localStorage**: Chat history is persisted client-side using browser's localStorage API. This provides a simple, database-free chat persistence solution, storing chat metadata and truncated messages for large datasets.
- **Supabase PostgreSQL**: External data source for analytical queries, accessed via the `pg` library with a dedicated connection pool.
- **Neon PostgreSQL**: Serves as the application database for storing metadata and user information.

### No Authentication Required

The application requires no authentication or database setup due to localStorage-based chat history and lack of server-side sessions or user accounts.

## External Dependencies

### Third-Party Services

- **Azure OpenAI (GPT-4o)**: Used solely for natural language understanding, intent classification, and structured query parameter extraction.
  - Endpoint: `aiage-mh4lk8m5-eastus2.cognitiveservices.azure.com`
  - API Version: `2024-12-01-preview`
  - Deployment: `gpt-4o`

### External Databases

- **Supabase PostgreSQL**: Provides the external data for analytical queries.
- **Neon PostgreSQL**: Serves as the application database for storing metadata and user information.

### UI Component Libraries

- **Radix UI**: Headless UI primitives for accessible and robust components.
- **Chart.js**: Core library for data visualization, with `react-chartjs-2` for React integration.
- **@tanstack/react-virtual**: Implemented for virtual scrolling to handle large datasets efficiently.

### Development Dependencies

- **Vite**: Build tool with plugins for React Fast Refresh and Replit-specific functionalities.
- **TypeScript**: Ensures type safety throughout the codebase.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Zod**: Runtime type validation.

## Recent Improvements

### Recent Changes (November 4, 2025)

#### Large Dataset localStorage Handling
- **Fixed localStorage quota errors for large datasets**: Chat history now saves successfully for queries with 500+ rows
  - **Problem**: Queries like "get all projects" (16,237 rows) exceeded browser localStorage limit (5-10MB), causing silent save failures
  - **Solution**: 
    - Implemented data size limiting in `chatStorage.ts` - datasets >500 rows store only metadata, not full data array
    - Added `_data_truncated` and `_original_count` flags to track when data was too large
    - Added user-friendly notices in UI when data was truncated
  - **User experience**: 
    - Summary statistics, charts, and SQL logs still persist and display correctly
    - Blue info alert explains why data table is not available for large datasets
    - Small datasets (≤500 rows) continue to work normally with full data persistence
  - Chat sidebar now shows all chats reliably, even those with large result sets

#### Follow-Up Query Context Preservation
- **Fixed follow-up queries to preserve tag filters**: Follow-up questions now maintain filters from previous queries
  - **Problem**: "Take the first project and get all related by tag" (112 results) → "Sort THEM BY WIN %" returned all 16,237 projects instead of just the 112
  - **Solution**: Modified `handleSameAttributeQuery` to extract and store tag values in `extracted_args` field
  - System now preserves extracted values (tags, category, status, etc.) for follow-up queries
  - Added `{additional_filters}` support to `get_top_projects_by_win_rate` template
  - **Example workflow**:
    - Query 1: "Take the first project and get all related by tag" → Returns 112 projects with tags ["Healthcare", "Medical", "Hospital", "Large"]
    - Query 2: "Sort THEM BY WIN %" → Now correctly sorts only those 112 projects by Win %, not all 16,237 projects
  - Follow-up queries like "limit to 10", "show only mega sized", "sort by win rate" now properly apply to the filtered dataset from the previous query

#### Space-Insensitive PID Matching & Column-Specific Queries
- **Fixed PID matching to ignore spaces**: "pid1204" now correctly matches "PID 1204" in the database
  - **Problem**: Queries like "description of pid1204" failed because the database stores it as "PID 1204" with a space
  - **Solution**: Updated SQL queries to remove spaces from both search terms and database values before comparison
  - Uses `REPLACE("Project Name"::text, ' ', '')` to normalize spacing
  - Works for both Project Name and Internal Id fields
- **Added column-specific query function**: New capability to request specific columns from projects
  - **New function**: `get_project_column_by_id` - retrieves a single column value for a project
  - **Usage examples**:
    - "description of PID 1204" → Returns only the Description column
    - "what is the fee for PID 1356?" → Returns only the Fee column
    - "status of pid911" → Returns only the Status column
  - **Supported columns**: Description, Fee, Status, Win %, Start Date, Close Date, Client, Company, Point Of Contact, State Lookup, Tags, Project Type, Request Category, Module Name, LP, Conflict, Co Op, Group, Group Criteria, Email, Internal Id, Is Updated
  - AI automatically classifies requests for specific columns and returns only the requested data
- **Fixed security validation**: Updated SQL security check to allow REPLACE() function while still blocking destructive REPLACE statements
  - **Problem**: Security validator incorrectly blocked queries containing REPLACE() function
  - **Solution**: Changed keyword detection to look for SQL statements (with trailing space) rather than any occurrence of keywords
  - REPLACE() function is now allowed, while "REPLACE " statement is still blocked
- **Fixed single-column display width**: Single-column results now use full width with text wrapping
  - **Problem**: Description and other single-column queries were limited to 150px width, truncating text
  - **Solution**: Dynamic column width - single columns use full width (1fr), multiple columns use fixed 150px
  - Single-column text wraps with `whitespace-normal break-words` for full content visibility
  - Multi-column results maintain 150px fixed width with `whitespace-nowrap` for consistent alignment

#### Virtual Scrolling for Large Datasets (20k+ Rows)
- **Implemented virtual scrolling using @tanstack/react-virtual**: Tables can now smoothly render 20,000+ rows without lag or browser freezing
  - **Problem**: Queries returning 16,000+ rows caused browser freezing during tab switches and laggy scrolling
  - **Solution**: Virtual scrolling renders only ~20-30 visible rows at a time instead of all 20,000, achieving 60 FPS scrolling performance
  - Used `@tanstack/react-virtual` with `estimateSize: 41px` for row height
  - Implemented proper cleanup in useEffect to prevent memory leaks
- **Fixed column alignment**: Converted from HTML table elements to div-based CSS Grid layout
  - **Problem**: HTML table headers became misaligned with data columns during scrolling with sticky positioning
  - **Solution**: CSS Grid with fixed 150px columns ensures perfect header-to-data alignment
  - Grid template columns: `'150px 150px 150px...'` for consistent column widths
- **Fixed UI issues**: 
  - Hidden internal scrollbar (keeping only external scrollbar) for cleaner appearance
  - Increased header z-index to z-20 to prevent overlap during vertical scrolling
  - External horizontal scrollbar syncs perfectly with table content using bidirectional scroll event listeners