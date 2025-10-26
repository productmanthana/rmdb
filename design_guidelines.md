# Design Guidelines: Natural Language Database Query Chatbot

## Design System & Principles

**Approach**: Material Design with data visualization focus for utility-driven, high-information-density interfaces.

**Core Principles**:
1. Clarity over decoration - every element serves data presentation
2. Conversational efficiency - frictionless natural interaction
3. Data transparency - raw data always accessible
4. Professional credibility - enterprise-grade polish
5. Embeddable-first - works standalone AND in iframes

---

## Typography

### Fonts
- **Primary**: Inter (body, UI, chat)
- **Monospace**: JetBrains Mono (JSON, code)

### Scale
- H1: `text-3xl font-semibold` (30px) - Page titles
- H2: `text-2xl font-semibold` (24px) - Sections
- H3: `text-xl font-medium` (20px) - Cards, charts
- Body Large: `text-base` (16px) - Chat messages
- Body: `text-sm` (14px) - UI labels
- Small: `text-xs` (12px) - Timestamps, metadata
- Code: `text-sm font-mono` / `text-xs font-mono`

---

## Layout & Spacing

### Spacing Scale (Tailwind units)
- **2**: Micro (related elements, icon padding)
- **4**: Small (card padding, form fields)
- **6**: Medium (sections, components)
- **8**: Large (layout divisions, panels)
- **12**: XL (page margins desktop)
- **16**: XXL (hero sections)
- **24**: XXXL (landing page sections)

### Grid Structure
```
Desktop:
┌─────────────────────────────┐
│ Header (h-16)               │
├──────────┬──────────────────┤
│ Sidebar  │ Chat Area        │
│ (w-80)   │ (flex-1)         │
│          │ Messages         │
│ Examples │ Input            │
│ History  │ Output Panel     │
│ Settings │                  │
└──────────┴──────────────────┘
```

**Breakpoints**:
- Mobile (base): Single column, collapsible sidebar
- Tablet (md: 768px): w-64 sidebar
- Desktop (lg: 1024px): w-80 sidebar
- Wide (xl: 1280px): Expanded output

**Chat**: `max-w-4xl mx-auto` centered, full-height overflow
**Output Panel**: `grid grid-cols-1 lg:grid-cols-2 gap-6`

---

## Components

### Chat Interface

**Container**: `flex flex-col min-h-screen` with sticky header/input

**Message Bubbles**:
- User: Right-aligned, `max-w-2xl p-4 rounded-2xl`
- Bot: Left-aligned, `max-w-3xl p-4 rounded-xl`
- Spacing: `space-y-4`
- Avatar: `w-8 h-8 rounded-full`
- Timestamp: `text-xs mt-1`

**Input Area**:
- Textarea: `min-h-12 max-h-32` auto-resize
- Send button: Absolute right, `rounded-full p-3`
- Placeholder: "Ask about your data in natural language..."

**Loading States**:
- Typing indicator: Animated dots, pulse animation
- Message: "Bot is thinking..."

### Data Visualization

**Chart Container**:
- Aspect: 16:9 (line/bar), 1:1 (pie)
- Structure: `p-6 rounded-lg`
- Title: `text-xl font-medium mb-4`
- Chart.js with `responsive: true`

**Controls**: `flex justify-between items-center mb-4`
- Type selector: Button group, `rounded-full`
- View toggle: Chart | Raw Data (active state)
- Export: Download icon + label

**Raw Data Panel**:
- Container: `h-96 overflow-y-auto p-4`
- Code: `font-mono text-xs` with syntax highlighting
- Copy button: Top-right sticky

**Dual View**:
```
┌──────────────┬──────────────┐
│ Chart View   │ Raw Data     │
│ Interactive  │ Scrollable   │
│ Chart.js     │ JSON         │
│ [Export]     │ [Copy]       │
└──────────────┴──────────────┘
```

### Sidebar

**Query Examples**:
- Collapsible accordion
- Icon: Lightbulb/sparkles (Heroicons)
- Text: `text-sm` with hover, `space-y-2`
- Categories: Date, Aggregations, Comparisons

**History**:
- List: `max-h-64 overflow-y-auto`
- Items: `p-3 rounded-lg` with hover
- Text: `max-w-xs truncate`, timestamp `text-xs`

**Settings**:
- Toggles: Auto-refresh, show raw data, debug mode
- DB connection indicator
- API status badge

### Embeddable Widget

**Standalone Layout**:
- Header: `h-12` (compact)
- No sidebar default (configurable)
- Tabs instead of dual-view: Chart | Data
- Minimal chrome

**Sizing Presets**:
- Small: 400×500px (chat only)
- Medium: 600×700px (chat + chart)
- Large: 800×900px (full featured)
- Full: 100%×100vh

**Integration**:
- Responsive iframe with aspect-ratio
- postMessage API for communication
- Scoped CSS, no external deps in parent

**Embed Generator**:
- Tabs: iframe | JavaScript
- Code with syntax highlighting, copy button
- Options: Width/height sliders, theme, feature toggles

### Utility Components

**Loading**:
- Skeleton: Pulsing shapes
- Spinner: `w-4 h-4 animate-spin`

**Empty State**:
- `flex items-center justify-center`
- Icon: `w-16 h-16`
- Text: `text-xl font-medium`, `text-sm max-w-md`
- CTA: "Try an example query"

**Error**:
- Alert: `rounded-lg p-4`
- Icon: `w-5 h-5` exclamation-circle
- Message: `text-sm font-medium`
- Retry/dismiss action, toggle stack trace

**Success**:
- Toast: Bottom-right positioned
- Green checkmark, auto-dismiss 3s
- Slide-in animation

---

## Navigation

**Header**: `h-16 p-4`
- Logo left (`h-8`)
- Nav center (Chat, Analytics, Docs, API)
- User/settings right with dropdown

**Sidebar**:
- Collapsible mobile (hamburger)
- `sticky top-16`
- Sections with `border-t` dividers
- Active: Left border accent

---

## Responsive Design

**Mobile (<768px)**:
- Single column, drawer sidebar
- Stacked chart/data
- Touch targets `min-h-12`
- Bottom sheet for settings

**Tablet (768-1024px)**:
- `w-64` sidebar
- 1-column grid
- `p-4` padding

**Desktop (1024px+)**:
- `w-80` sidebar
- 2-column views
- Hover states, keyboard shortcuts

---

## Accessibility

**Focus**:
- Visible `ring-2` on interactive elements
- Skip to content link
- Focus trap in modals
- Keyboard navigation in history

**Screen Readers**:
- Semantic HTML (header, main, aside)
- ARIA labels on icon buttons
- `aria-live="polite"` for chat messages
- Chart descriptions via `aria-describedby`

**Text**:
- Always-visible labels
- Error messages with `aria-describedby`
- Autocomplete attributes
- 4.5:1 min contrast ratio

---

## Animations

**Use Sparingly** - Functional only:
- Message send: `translate-y-4→0 duration-200`
- Chart render: `opacity-0→100 duration-300`
- Typing indicator: `pulse duration-1000 infinite`
- Panel toggle: `max-height duration-200`
- Toast: Slide-in `duration-300`

**No animations**: Hover, clicks, tabs, data updates

---

## Images

**Landing Hero** (16:9 desktop, 4:3 mobile):
- Full-width screenshot showing query + chart + dual-view
- Example: "Show me sales trends for last 6 months"
- Gradient overlay for text readability

**Feature Showcase** (1:1, 3-column):
- Line chart, bar chart, pie chart in app context

**Widget Demo** (16:9):
- Split-screen: Embedded widget (left) + code generator (right)

**Trust Elements**:
- Company logos (grayscale, small)

---

## Page-Specific

**Main App**:
- Chat interface at viewport top
- Sidebar visible desktop default
- Empty state with example prompts
- Progressive disclosure for settings

**Landing** (if created):
- Hero: 80vh screenshot + headline + CTA
- Features: 3-column grid
- Live demo: Working embedded widget
- Integration: Code samples with highlighting
- FAQ: Accordion
- Footer: Comprehensive links

---

**Token Budget**: ~1,850 tokens (within 2,000 limit)