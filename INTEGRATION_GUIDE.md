# Natural Language Database Query Chatbot - Integration Guide

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript - Modern UI framework
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - High-quality component library built on Radix UI
- **TanStack Query (React Query)** - Server state management
- **Chart.js** with react-chartjs-2 - Data visualization
- **Wouter** - Lightweight routing

### Backend
- **Node.js 20** with TypeScript
- **Express.js** - Web server framework
- **PostgreSQL** - Database (dual connections):
  - Neon PostgreSQL for app data
  - External Supabase PostgreSQL for query data
- **Azure OpenAI (GPT-4o)** - Natural language understanding
- **pg** - PostgreSQL client for external DB
- **@neondatabase/serverless** - Neon database driver

### Key Features
- Natural language query processing
- 50+ pre-built query templates
- Semantic time parsing ("last week", "next month", etc.)
- Dynamic project size categorization
- Interactive charts (bar, line, pie)
- Tabular data display
- Summary statistics
- CSV export capability

---

## 🔌 Integration Methods

### Method 1: iframe Embedding (Simplest)

**Best for:** Quickly embedding the chatbot in any website without code changes

```html
<!-- Basic iframe -->
<iframe 
  src="https://your-chatbot-url.replit.app/embed" 
  width="100%" 
  height="600px" 
  frameborder="0"
  style="border: 1px solid #ccc; border-radius: 8px;"
></iframe>

<!-- Full-page iframe -->
<iframe 
  src="https://your-chatbot-url.replit.app/embed" 
  style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; border: none;"
></iframe>
```

**Pros:**
- No coding required
- Works on any platform (WordPress, Wix, Squarespace, etc.)
- Isolated styling (won't conflict with your site)
- Easy to resize and position

**Cons:**
- Limited customization
- Cross-origin restrictions may apply

---

### Method 2: JavaScript Snippet (Dynamic)

**Best for:** More integrated experience with dynamic loading

```html
<!-- Add a container where you want the chatbot -->
<div id="chatbot-container"></div>

<!-- Load the chatbot script -->
<script src="https://your-chatbot-url.replit.app/api/embed/snippet"></script>

<!-- Or with custom configuration -->
<script>
  window.chatbotConfig = {
    containerId: 'chatbot-container',
    width: '100%',
    height: '600px',
    theme: 'light' // or 'dark'
  };
</script>
<script src="https://your-chatbot-url.replit.app/api/embed/snippet"></script>
```

**Pros:**
- More flexible positioning
- Can be loaded dynamically
- Customizable via configuration

**Cons:**
- Requires JavaScript support
- Slightly more complex setup

---

### Method 3: React Component Integration

**Best for:** React applications where you want full control

```bash
# Install dependencies in your React project
npm install @tanstack/react-query chart.js react-chartjs-2
```

```typescript
// Copy the chat component and utilities
// From this project, copy:
// - client/src/pages/chat.tsx
// - client/src/components/ChartVisualization.tsx
// - shared/schema.ts (types)

import ChatPage from './components/ChatPage';

function App() {
  return (
    <div className="App">
      <ChatPage />
    </div>
  );
}
```

**Configuration:**

```typescript
// Update the API endpoint in your component
const queryMutation = useMutation({
  mutationFn: async (question: string) => {
    const res = await fetch('https://your-chatbot-url.replit.app/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    return res.json();
  }
});
```

**Pros:**
- Full customization
- Native React integration
- Can modify UI/UX freely
- No iframe overhead

**Cons:**
- Requires React knowledge
- More setup required
- Need to handle API calls

---

### Method 4: REST API Integration

**Best for:** Custom applications, mobile apps, or non-JavaScript environments

**Endpoint:** `POST https://your-chatbot-url.replit.app/api/query`

**Request:**
```json
{
  "question": "Show me projects from last year"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Found 150 projects from 2024",
  "data": [
    {
      "Project Name": "Highway Expansion",
      "Fee": 5000000,
      "Status": "Active",
      "Start Date": "2024-03-15"
    }
  ],
  "summary": {
    "total_records": 150,
    "total_value": 450000000,
    "avg_fee": 3000000
  },
  "chart_config": {
    "type": "bar",
    "labels": ["Q1", "Q2", "Q3", "Q4"],
    "datasets": [{
      "label": "Projects by Quarter",
      "data": [35, 42, 38, 35]
    }]
  }
}
```

**Example in Python:**
```python
import requests

response = requests.post(
    'https://your-chatbot-url.replit.app/api/query',
    json={'question': 'Top 10 largest projects'}
)

data = response.json()
if data['success']:
    for project in data['data']:
        print(f"{project['Project Name']}: ${project['Fee']:,}")
```

**Example in cURL:**
```bash
curl -X POST https://your-chatbot-url.replit.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Show me projects from last year"}'
```

**Pros:**
- Language agnostic
- Full control over data processing
- Can integrate with any platform
- Build custom UIs

**Cons:**
- Need to build your own UI
- Handle chart rendering yourself
- More development work

---

## 🌍 Deployment Options

### Deploy on Replit (Current Platform)

**Steps:**
1. Your app is already running on Replit
2. Click "Publish" button in Replit interface
3. Your app will be available at: `https://your-repl-name.replit.app`

**Pros:**
- Zero configuration
- Automatic HTTPS
- Built-in database
- Free tier available

---

### Deploy on Render.com

See RENDER_DEPLOYMENT.md for complete instructions.

**Quick Overview:**
1. Push code to GitHub
2. Connect GitHub repo to Render
3. Configure environment variables
4. Deploy automatically

**Pros:**
- Free tier with generous limits
- Auto-deploy from Git
- Custom domains
- Professional hosting

---

## 🔒 Security Considerations

### Environment Variables
Never commit these to version control:

```bash
# Azure OpenAI
AZURE_OPENAI_KEY=your-key
AZURE_OPENAI_ENDPOINT=your-endpoint
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# External Database
EXTERNAL_DB_HOST=your-host
EXTERNAL_DB_PORT=6543
EXTERNAL_DB_NAME=postgres
EXTERNAL_DB_USER=your-user
EXTERNAL_DB_PASSWORD=your-password
```

### CORS Configuration
If integrating via API, configure CORS in `server/index.ts`:

```typescript
import cors from 'cors';

app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true
}));
```

---

## 📝 Customization Examples

### Custom Styling (iframe)
```html
<iframe 
  src="https://your-chatbot-url.replit.app/embed?theme=dark" 
  style="
    width: 800px; 
    height: 600px; 
    border: 2px solid #333; 
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  "
></iframe>
```

### Widget-Style Integration
```html
<!-- Floating chat widget in bottom-right corner -->
<div id="chat-widget" style="
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  height: 600px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-radius: 12px;
  overflow: hidden;
  z-index: 1000;
">
  <iframe 
    src="https://your-chatbot-url.replit.app/embed" 
    width="100%" 
    height="100%" 
    frameborder="0"
  ></iframe>
</div>

<!-- Toggle button -->
<button onclick="document.getElementById('chat-widget').style.display = 
  document.getElementById('chat-widget').style.display === 'none' ? 'block' : 'none'"
  style="
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 1001;
    padding: 12px 20px;
    background: #0070f3;
    color: white;
    border: none;
    border-radius: 24px;
    cursor: pointer;
  "
>
  💬 Ask AI
</button>
```

---

## 🧪 Testing Integration

### Test the API
```bash
# Test health endpoint
curl https://your-chatbot-url.replit.app/api/health

# Test query endpoint
curl -X POST https://your-chatbot-url.replit.app/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "Show me all projects"}'
```

### Test iframe
```html
<!-- test.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Chatbot Test</title>
</head>
<body>
  <h1>Testing Chatbot Integration</h1>
  <iframe 
    src="https://your-chatbot-url.replit.app/embed" 
    width="100%" 
    height="600px" 
    frameborder="0"
  ></iframe>
</body>
</html>
```

---

## 📞 Support & Questions

- Review `replit.md` for technical architecture
- Check backend logic in `server/utils/query-engine.ts`
- See query templates in `server/utils/query-engine.ts` (50+ examples)
- Frontend component: `client/src/pages/chat.tsx`

---

## 🎯 Quick Start Checklist

- [ ] Choose integration method (iframe, JavaScript, React, or API)
- [ ] Set up environment variables
- [ ] Test API endpoint with curl or Postman
- [ ] Configure CORS if using direct API calls
- [ ] Deploy to production (Replit or Render)
- [ ] Update database connection if needed
- [ ] Test queries with your actual data
- [ ] Customize styling/branding as needed

Your chatbot is ready to integrate! 🚀
