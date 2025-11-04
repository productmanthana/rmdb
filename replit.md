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