# Natural Language Database Query Chatbot

## Overview
This project is a natural language database query system designed to translate plain English questions into structured data responses with visualizations. It leverages Azure OpenAI (GPT-4o) for natural language understanding, while all calculations are performed in TypeScript/Python. The application features a chat interface displaying data tables, charts, and raw JSON, and is designed for both standalone and embedded use. The business vision is to empower users with intuitive data access, reduce reliance on technical teams for ad-hoc reports, and unlock insights efficiently.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
The frontend is built with React and TypeScript using Vite, featuring Shadcn/UI components (built on Radix UI) styled with Tailwind CSS. It adopts a Material Design-inspired approach for data visualization, prioritizing clarity and high information density. Wouter handles client-side routing, and TanStack Query manages server state. Chart.js with react-chartjs-2 is used for data visualization, supporting various chart types including bar, line, pie, area, doughnut, radar, scatter, and bubble charts.

#### Key Pages
- **Chat Interface** (`/`): Main conversational query interface with follow-up questions, multiple view tabs (Response, Chart, Logs), and chat history management
- **Dashboard** (`/dashboard`): Power BI-style analytics dashboard with comprehensive visualizations of the entire database, including summary cards, distribution charts, timeline trends, and geographic analysis
- **Conversations** (`/conversations`): Multi-channel messaging management page for Email, SMS, and WhatsApp integration via Twilio Conversations API
- **Embed View** (`/embed`): Embeddable version of the chat interface for integration into other applications

Key design decisions include embeddable-first functionality, tab-based data views (Table, Chart, Raw JSON), and a responsive layout. Virtual scrolling is implemented for large datasets (20,000+ rows). The UI includes interactive chart customization such as real-time chart type switching, four color schemes, legend control, and flexible tooltip formatting. Charts can also be exported as PNG images. A `ChartComparison` component allows viewing the same data in multiple chart types simultaneously.

### Backend
The backend uses Express.js with TypeScript, providing a RESTful API with a primary endpoint (`POST /api/query`). The query processing pipeline involves Zod for validation, Azure OpenAI for query intent classification and parameter extraction, TypeScript for date/number calculations, SQL generation from 98 predefined templates, external PostgreSQL execution, and formatted response packaging. The core `QueryEngine` orchestrates this process. Azure OpenAI is exclusively used for understanding user intent, not for calculations.

#### Reliability & Error Handling
The system implements comprehensive retry logic for transient network failures:
- **Azure OpenAI Retries**: Up to 3 automatic retry attempts for classification failures, with exponential backoff (1s, 2s, 3s delays)
- **Database Connection Retries**: Up to 3 automatic retry attempts for Supabase PostgreSQL connection failures
- **Transient Error Detection**: Automatically detects and retries AggregateError, connection timeouts, and network errors
- **Increased Timeouts**: Database connection timeout increased from 10s to 30s, with 60s query timeout
- **Connection Pool**: Configured with max 20 connections, 30s idle timeout for optimal resource usage
This ensures queries succeed even when Azure OpenAI or Supabase experience intermittent connectivity issues.

#### Email-Based Conversational Interface
The application features a direct email-based query system using SendGrid Inbound Parse with conversation threading:
- **Email Address**: `aiagent@em1008.vyaasai.com` - Users send natural language queries directly via email
- **SendGrid Inbound Parse Configuration**:
  - Subdomain: `em1008` (authenticated domain)
  - Domain: `vyaasai.com`
  - Webhook URL: `https://chat-chart-bot-productmanthana.replit.app/webhook/sendgrid/inbound`
  - Spam Check: **DISABLED** (must be disabled for proper email delivery)
  - POST raw MIME: **DISABLED** (must be disabled for parsing to work)
- **Webhook Endpoint**: `POST /webhook/sendgrid/inbound` receives incoming emails via SendGrid's Inbound Parse
- **Email Threading & Context Retention**: 
  - Tracks email conversations by sender email address in `email_conversations` and `email_messages` tables
  - Remembers previous queries and their responses for follow-up questions
  - Context is automatically extracted from the last message in the conversation thread
  - Users can ask follow-up questions naturally (e.g., "What about in California?" after asking about projects)
  - Works identically to SMS/WhatsApp threading but via email
- **Email Response Format**: Professional HTML emails with:
  - Summary statistics cards (total records, total value, average fee, win rate)
  - Full data tables with all query results
  - AI-generated insights and analysis
  - SQL query details for transparency
  - Purple-themed responsive design
  - "Reply to this email to ask follow-up questions!" footer message
- **Response Sender**: Emails are sent FROM `aiagent@vyaasai.com` (verified sender in SendGrid)
- **Deployment**: Production app at `https://chat-chart-bot-productmanthana.replit.app`

#### Multi-Channel Messaging (Twilio Conversations)
The application also supports unified messaging across SMS and WhatsApp using Twilio Conversations API:
- **Twilio Conversations Service** (`server/services/twilio-conversations.ts`): Manages conversation creation, participant management, and message sending across all channels
- **Webhook Endpoints**: 
  - `POST /webhook/twilio/conversations`: Receives incoming messages from SMS and WhatsApp
  - `POST /webhook/twilio/status`: Tracks message delivery status
  - `GET /api/twilio/status`: Checks Twilio configuration status
- **Channel-Specific Formatting**: Responses are automatically formatted based on the channel:
  - **SMS**: Concise text with top 3 results and summary stats (160-character friendly)
  - **WhatsApp**: Rich formatting with Markdown (bold, italics), up to 5 results with emojis
- **Database Tracking**: All conversations and messages are stored in `twilio_conversations` and `twilio_messages` tables
- **Unified QueryEngine**: Uses the same natural language processing pipeline for all channels

### Data Storage
The application uses a multi-database approach:
- **Browser localStorage**: Chat history is persisted client-side, storing chat metadata, messages, and follow-up questions.
- **Supabase PostgreSQL**: Serves as the external data source for analytical queries.
- **Neon PostgreSQL**: Stores conversation history and message tracking:
  - `twilio_conversations`: SMS/WhatsApp conversation metadata, channel type, and participant information
  - `twilio_messages`: Complete message history with query responses for SMS/WhatsApp channels
  - `email_conversations`: Email conversation metadata tracking by sender email address
  - `email_messages`: Complete email message history with query responses for email threading

### No Authentication Required
The application requires no authentication or database setup. Chat history is localStorage-based, meaning no server-side sessions or user accounts are needed, making it anonymous and friction-free. Chats persist until browser data is cleared.

### Feature Specifications
- **Follow-Up Questions**: Follow-up questions are **fully functional and identical** across all tabs (Response, Chart, Logs). Each follow-up response includes:
  - **Complete tabs structure**: Response (data table + AI analysis), Chart (visualization), and Logs (SQL query details)
  - **Summary statistics**: Records, Total Value, Avg Fee, Win Rate displayed as cards
  - **Interactive data table**: Copy CSV and Maximize buttons, virtual scrolling for large datasets
  - **Chart visualization**: Full ChartComparison component with all customization options
  - **SQL logs**: Syntax-highlighted SQL query, parameters, and raw JSON response
  - **Input form**: Textarea with Enter to submit, Shift+Enter for new line
  - **Limit tracking**: Shows "X/3 follow-up questions used" counter and limit reached message
  - **Seamless workflow**: Ask follow-ups from any tab without switching, see complete responses right there
- **Multi-Word Tag Handling**: The system correctly parses multi-word tags (e.g., "aviation pavement curbs and gutters") as single entities.
- **Column-Specific Query Support**: Users can request specific columns (e.g., "provide only the projects") while preserving previous filters.
- **Tag Replacement**: Follow-up queries involving tags now correctly replace previous tags instead of combining them.
- **Context Preservation**: Filters are maintained when selecting columns in follow-up queries.
- **Large Dataset Handling**: Error handling for localStorage limits is implemented, displaying a friendly message when storage is truly full for very large datasets.
- **Space-Insensitive PID Matching**: PID searches are flexible, matching "pid1204" with "PID 1204" (with or without spaces).
- **Ordinal Query Support**: The system correctly handles ordinal ranking queries like "second best", "third largest", "5th biggest", etc. by using SQL OFFSET to skip the appropriate number of results. Examples: "best" returns the highest-fee project, "second best" skips the first and returns the second-highest, "third largest" returns the third-highest, and so on.

## External Dependencies

### Third-Party Services
- **Azure OpenAI (GPT-4o)**: Used for natural language understanding, intent classification, and structured query parameter extraction.
- **Twilio Conversations API**: Unified messaging platform enabling Email, SMS, and WhatsApp channels with a single API.
- **SendGrid**: Email delivery service (owned by Twilio) for email-based queries and responses.

### External Databases
- **Supabase PostgreSQL**: Provides external data for analytical queries.
- **Neon PostgreSQL**: Serves as the application database for storing metadata and user information.

### UI Component Libraries
- **Radix UI**: Headless UI primitives.
- **Chart.js**: Core library for data visualization, with `react-chartjs-2` for React integration.

### Development Dependencies
- **Vite**: Build tool for frontend development.
- **TypeScript**: Ensures type safety.
- **Tailwind CSS**: Utility-first CSS framework.
- **Zod**: Runtime type validation.