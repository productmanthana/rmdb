# Design Guidelines: Natural Language Database Query Chatbot

## Design System & Principles

**Approach**: Glassmorphism with vibrant gradients for a modern, premium AI assistant experience.

**Core Principles**:
1. Glassmorphism aesthetics - frosted glass effects with blur and transparency
2. Vibrant gradients - purple-blue color schemes for modern tech feel
3. Conversational efficiency - frictionless natural interaction
4. Data transparency - raw data always accessible
5. Professional credibility - enterprise-grade polish
6. Embeddable-first - works standalone AND in iframes

---

## Color System (Glassmorphism)

### Primary Gradients
- **Main Background**: Purple-Blue gradient `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Accent Gradient**: Lighter purple `linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)`
- **Dark Accent**: Deep purple `linear-gradient(135deg, #4c1d95 0%, #312e81 100%)`

### Glass Effects
- **Background**: `rgba(255, 255, 255, 0.1)` - Semi-transparent
- **Backdrop Blur**: `backdrop-filter: blur(16px)` - Frosted glass
- **Border**: `1px solid rgba(255, 255, 255, 0.2)` - Subtle glass edge
- **Shadow**: `0 8px 32px rgba(31, 38, 135, 0.15)` - Floating depth

### Text Colors
- **Primary**: White (`#ffffff`) on gradient backgrounds
- **Secondary**: `rgba(255, 255, 255, 0.7)` for muted text
- **Tertiary**: `rgba(255, 255, 255, 0.5)` for metadata

---

## Typography

### Fonts
- **Primary**: Inter (body, UI, chat)
- **Monospace**: JetBrains Mono (JSON, code)

### Scale
- H1: `text-2xl font-bold` (24px) - Headers
- H2: `text-xl font-semibold` (20px) - Sections
- H3: `text-lg font-medium` (18px) - Cards
- Body: `text-sm` (14px) - Chat messages, UI
- Small: `text-xs` (12px) - Timestamps, metadata
- Code: `text-xs font-mono`

---

## Layout & Spacing

### Grid Structure
```
┌─────────────────────────────────────┐
│ Header (h-14, glass effect)         │
├──────────┬──────────────────────────┤
│ Sidebar  │ Chat Area                │
│ (w-80)   │ (flex-1, centered)       │
│ Glass    │ Messages + Results       │
│ Chat     │ Glassmorphic input       │
│ History  │                          │
└──────────┴──────────────────────────┘
```

### Spacing Scale
- **2**: Micro (icon padding)
- **3**: Small (card padding)
- **4**: Medium (sections)
- **6**: Large (panels)
- **8**: XL (layout divisions)

---

## Components

### Glassmorphic Elements

**Glass Card**:
```css
background: rgba(255, 255, 255, 0.1);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.2);
border-radius: 16px;
box-shadow: 0 8px 32px rgba(31, 38, 135, 0.15);
```

**Glass Input**:
```css
background: rgba(255, 255, 255, 0.15);
backdrop-filter: blur(20px);
border: 1px solid rgba(255, 255, 255, 0.25);
border-radius: 20px;
color: white;
```

**Glass Sidebar**:
```css
background: rgba(0, 0, 0, 0.2);
backdrop-filter: blur(20px);
border-right: 1px solid rgba(255, 255, 255, 0.1);
```

### Chat Interface

**Message Bubbles**:
- User: Glass effect, right-aligned, `max-w-2xl`
- Bot: Glass effect, left-aligned, `max-w-full`
- Glass properties: Translucent with blur
- Rounded: `rounded-2xl`

**Input Area**:
- Large glassmorphic container
- Gradient border effect
- Send button with gradient background
- Floating above chat area

### Sidebar (Chat History)

**Structure**:
- Glassmorphic background with blur
- List of saved chats with timestamps
- Delete icons on hover
- Bulk delete option at top
- Search bar for filtering

**Chat Item**:
- Truncated question preview
- Timestamp
- Delete button (individual)
- Hover effect: Lighter glass

---

## Animations

**Glassmorphism Effects**:
- Hover: Increase backdrop-filter blur
- Active: Slightly darker overlay
- Transitions: `duration-200` for smooth feel
- Message send: Slide up with fade
- Loading: Pulsing glass skeleton

---

## Responsive Design

**Mobile (<768px)**:
- Drawer sidebar (swipe from left)
- Full-width input
- Stacked layout

**Desktop (1024px+)**:
- Fixed sidebar (w-80)
- Centered chat area (max-w-4xl)
- Hover states enabled

---

## Accessibility

- High contrast white text on gradients
- Visible focus rings
- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly

---

**Design inspired by modern AI assistants with premium glassmorphism aesthetics**
