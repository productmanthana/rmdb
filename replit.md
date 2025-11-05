# Natural Language Database Query Chatbot

## Overview

This project is a natural language database query system that translates plain English questions into structured data responses with visualizations. It utilizes Azure OpenAI (GPT-4o) for natural language understanding, while all calculations are performed in TypeScript/Python. The application features a chat interface displaying data tables, charts, and raw JSON, and is designed for both standalone and embedded use. The business vision is to empower users with intuitive data access, reduce reliance on technical teams for ad-hoc reports, and unlock insights efficiently.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React and TypeScript using Vite, featuring Shadcn/UI components (built on Radix UI) styled with Tailwind CSS. It adopts a Material Design-inspired approach for data visualization, prioritizing clarity and high information density. Wouter handles client-side routing, and TanStack Query manages server state. Chart.js with react-chartjs-2 is used for data visualization, supporting bar, line, and pie charts. Key design decisions include embeddable-first functionality, tab-based data views (Table, Chart, Raw JSON), and a responsive layout. Virtual scrolling is implemented for large datasets (20,000+ rows) to ensure smooth performance.

### Backend

The backend uses Express.js with TypeScript, providing a RESTful API with a primary endpoint (`POST /api/query`). The query processing pipeline involves Zod for validation, Azure OpenAI for query intent classification and parameter extraction, TypeScript for date/number calculations, SQL generation from 98 predefined templates, external PostgreSQL execution, and formatted response packaging. The core `QueryEngine` orchestrates this process. Azure OpenAI is exclusively used for understanding user intent, not for calculations.

### Data Storage

The application uses a dual-database approach:
- **Browser localStorage**: Chat history is persisted client-side using browser's localStorage API, providing a simple, database-free chat persistence solution. This stores chat metadata, messages, and follow-up questions under the key `rmone_chats`.
- **Supabase PostgreSQL**: Serves as the external data source for analytical queries.

### No Authentication Required

The application requires no authentication or database setup. Chat history is localStorage-based, meaning no server-side sessions or user accounts are needed, making it anonymous and friction-free. Chats persist until browser data is cleared.

## External Dependencies

### Third-Party Services

- **Azure OpenAI (GPT-4o)**: Used for natural language understanding, intent classification, and structured query parameter extraction.
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

- **Vite**: Build tool for frontend development.
- **TypeScript**: Ensures type safety throughout the codebase.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Zod**: Runtime type validation.

## Recent Improvements (November 5, 2025)

### Multi-Word Tag Handling
- **Fixed tag parsing to treat phrases without commas as single tags**: "aviation pavement curbs and gutters" is now one tag
  - **Problem**: Tag names like "aviation pavement curbs and gutters" were being split into 4 separate words
  - **Solution**: Updated AI prompt to use commas as delimiters, not spaces or "and"
  - **Rules**:
    - **Has commas** → Split on commas: "Rail, Transit, Hospital" → 3 separate tags
    - **No commas** → One multi-word tag: "aviation pavement curbs and gutters" → 1 tag
  - **Impact**: Correctly searches for exact multi-word tag names like "aviation pavement curbs and gutters"

### Column-Specific Query Support
- **Enhanced "provide only X" queries to select specific columns**: Follow-up questions can now request individual columns
  - **Problem**: "Provide only the projects" returned all columns instead of just "Project Name"
  - **Solution**: Improved `select_specific_columns` function to map user terms to exact column names
  - **Mappings**: 
    - "projects"/"project names" → "Project Name"
    - "tags" → "Tags"
    - "clients"/"client names" → "Client"
    - "fee"/"fees"/"cost" → "Fee"
  - **Examples**: 
    - "provide only the projects" → SELECT "Project Name"
    - "show just tags" → SELECT "Tags"
    - "display fee and client" → SELECT "Fee", "Client"
  - **Context preservation**: Filters from previous query are maintained (e.g., tag filters + column selection)

### Tag Replacement in Follow-Up Queries
- **Fixed SmartMerge to replace tags instead of combining them**: Follow-up tag queries now correctly replace previous tags
  - **Problem**: Query 1: "tag X and Y" (5457 results) → Query 2: "tag Y only" still showed both X and Y
  - **Solution**: Moved `tags` from ADDITIVE_PARAMS to REPLACEABLE_PARAMS in SmartMerge logic
  - **Behavior**:
    - **Query 1**: "tags aviation pavement curbs and gutters, amusement park structures" → Both tags
    - **Query 2**: "tags amusement park structures and equipment" → **Only** amusement park tag (replaces previous)
  - **Impact**: Users can now narrow down tag searches in follow-up questions without carrying forward unwanted tags

### Context Preservation with Column Selection
- **Fixed SmartMerge to preserve filters when selecting columns**: Column selection queries maintain previous filters
  - **Problem**: Query 1: "tag X" (5319 results) → Query 2: "show only projects" returned ALL 16,237 projects (lost filter)
  - **Solution**: Enhanced SmartMerge to only drop tags when NEW tags are explicitly provided, not when other params (like columns) are added
  - **Behavior**:
    - **Query 1**: "tags amusement park" → 5319 results
    - **Query 2**: "provide the project data only" → SELECT "Project Name" with same tag filter (5319 results) ✅
    - **Query 3**: "tags X" → Replaces previous tag (different results) ✅
  - **Impact**: Users can refine displayed columns without losing their carefully built filters

## Recent Improvements (November 4, 2025)

### Large Dataset Storage Error Handling
- **Centered alert dialog for localStorage limits**: Friendly message appears only when storage is truly full
  - **Problem**: Queries with 16,000+ rows exceeded browser storage limits, causing blank screens when clicked in sidebar
  - **Solution**: Implemented quota-specific error detection with centered alert dialog
  - **User Experience**:
    - **During query**: No interruption - users can continue conversations without popups
    - **When clicking sidebar**: Centered alert dialog (not corner toast) appears only for chats that exceeded quota
    - Message: "This chat contains too much data (16,000+ rows) and exceeds browser storage limits"
    - Single "Got it" button for acknowledgment
  - **Technical**: 
    - Specifically detects `QuotaExceededError` (not all save errors)
    - Only marks chats as "too large" when storage quota is actually reached
    - Won't show popup for smaller datasets (800 rows) - only when browser's ~10MB limit is hit
    - Silently tracks affected chats, uses AlertDialog for center-screen visibility

### Follow-Up Query Context Preservation  
- **Fixed context preservation for multi-step queries**: Follow-up questions now maintain filters from previous queries
  - **Problem**: "Get all projects by tag X" (112 results) → "Sort by win %" returned all 16,237 projects
  - **Solution**: Modified `handleSameAttributeQuery` to extract and return tag values in `extracted_args`
  - **Impact**: SmartMerge now preserves tags, categories, status from two-step queries
  - **Example**: Query 1 finds 112 healthcare projects → Query 2 sorts only those 112 by win %

### Virtual Scrolling & Column Layout
- **Optimized rendering for large datasets**: Smooth 60 FPS performance with 20,000+ rows
  - Single-column results (Description) use full width with text wrapping
  - Multi-column results use 150px fixed width for consistent alignment
  - CSS Grid layout with proper column templates

### Space-Insensitive PID Matching
- **Flexible PID search**: "pid1204" matches "PID 1204" (with or without spaces)
  - SQL uses `REPLACE("Project Name"::text, ' ', '')` for normalization
  - Applies to all PID-based queries and reference lookups