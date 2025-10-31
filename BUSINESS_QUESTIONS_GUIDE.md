# Comprehensive Business Questions Guide
## Natural Language Database Query System

This guide documents all business questions that can be asked using natural language, organized by business category.

---

## 📊 DATABASE SCHEMA OVERVIEW

**Available Columns:**
- **Request Category** - Project category/domain (e.g., Transportation, Energy, Water)
- **Project Name** - Unique project identifier
- **Client** - Client name or CLID (Client ID like "CLID 1573")
- **Status** - Project status (Won, Lost, Lead, Submitted, Proposal Development, etc.)
- **Fee** - Project value in dollars
- **Company** - Operating company/OPCO handling the project
- **Point Of Contact** - Person managing the project
- **Win %** - Probability of winning (0-100%)
- **Project Type** - Type of work (Design, Construction, Consulting, etc.)
- **Start Date** - Project start date
- **State Lookup** - Geographic location (state code)
- **Tags** - Comma-separated descriptive tags
- **Description** - Project description text

---

## ✅ CURRENTLY SUPPORTED QUESTIONS

### 1. TIME-BASED QUERIES

#### By Year
- "Show me all projects in 2024"
- "Projects from 2023"
- "What happened in 2022?"

#### By Date Range
- "Projects in the last 6 months"
- "Show me next 10 months"
- "Projects from January to March"
- "Q1 2024 projects"
- "Last year projects"

#### By Quarter
- "Q3 2024 projects"
- "Show me first quarter 2025"
- "What's in Q4?"

#### Multiple Years
- "Projects in 2022, 2023, and 2024"
- "Show me last 3 years"

**Example Questions:**
```
- "Top 10 projects starting in next ten months"
- "Show all mega sized projects starting in the next year"
- "Projects completed in last quarter"
```

---

### 2. SIZE & VALUE QUERIES

#### By Project Size (Dynamic Percentiles)
- "Show me small projects"
- "Micro sized projects"
- "Large projects only"
- "Mega projects"
- "Medium-sized opportunities"

Size categories are calculated dynamically from database percentiles:
- **Micro**: < 35,000
- **Small**: 35,000 - 90,000
- **Medium**: 90,000 - 250,000
- **Large**: 250,000 - 1,319,919
- **Mega**: > 1,319,919

#### By Fee Range
- "Projects over $500,000"
- "Projects between $100k and $500k"
- "Under $50,000 projects"

#### Size Distribution
- "Show me project size distribution"
- "How many projects in each size category?"

**Example Questions:**
```
- "Small projects in California"
- "Mega projects with high win rates"
- "Medium-sized transportation projects"
```

---

### 3. RANKING & TOP QUERIES

#### Largest/Smallest Projects
- "Top 5 largest projects"
- "Biggest 10 projects"
- "Smallest 3 projects"
- "Lowest value opportunities"

#### By Geographic Region
- "Largest projects in California"
- "Top 5 in Texas"
- "Biggest projects in NY"

#### By Category
- "Largest transportation projects"
- "Top 10 in energy sector"
- "Biggest water projects"

#### By Tags
- "Largest projects with Rail tag"
- "Top sustainability projects"

**Example Questions:**
```
- "Top 10 projects in California worth over $1M"
- "5 largest mega projects in last 6 months"
- "Smallest active projects in Texas"
```

---

### 4. STATUS-BASED QUERIES

#### By Status
- "Show me won projects"
- "All lost opportunities"
- "Active leads"
- "Submitted proposals"
- "Projects in proposal development"

#### Status Breakdown
- "What's our status distribution?"
- "How many projects by status?"
- "Status overview"

#### Win Rate Filtered
- "Won projects with over 80% win rate"
- "Lost projects that had high confidence"

#### Over-Optimistic Losses
- "Show projects we lost despite high win rates"
- "Over-confident losses"

#### Top Predicted Wins
- "Top 10 projects most likely to win"
- "Best opportunities by win probability"

**Example Questions:**
```
- "Won projects in California last year"
- "Active leads with mega size"
- "Lost transportation projects in 2023"
```

---

### 5. WIN RATE ANALYSIS

#### By Win Rate Range
- "Projects with 70-90% win rate"
- "High confidence opportunities"
- "Over 50% win probability"

#### By Client & Status & Win Rate
- "CLID 1573 submitted projects with >60% win rate"
- "Active clients with high win rates"

#### Clients by Highest Win Rate
- "Which clients have the best win rates?"
- "Top 20 clients by success probability"

**Example Questions:**
```
- "High win rate transportation projects"
- "Projects with >80% win rate in Texas"
- "Medium projects with 60-80% confidence"
```

---

### 6. CATEGORY & PROJECT TYPE

#### By Request Category
- "Transportation projects"
- "Energy sector opportunities"
- "Water and wastewater projects"
- "Show me healthcare projects"

#### By Project Type
- "Design projects"
- "Construction management"
- "Consulting opportunities"

#### Multiple Categories
- "Transportation and infrastructure projects"
- "Energy OR water projects"

#### Revenue by Category
- "Total revenue in transportation"
- "How much in energy sector?"

**Example Questions:**
```
- "Large transportation projects in California"
- "Energy projects with high win rates"
- "Consulting opportunities in last 6 months"
```

---

### 7. TAG-BASED QUERIES

#### Single Tag
- "Projects with Rail tag"
- "Sustainability projects"
- "Innovation initiatives"

#### Multiple Tags (AND logic)
- "Projects with Rail AND Transit tags"
- "Sustainability and Innovation projects"

#### Top Tags by Value
- "Which tags generate most revenue?"
- "Top 10 tags by project count"

**Example Questions:**
```
- "Large Rail projects in California"
- "Transit projects won in 2024"
- "Sustainability AND Innovation tagged projects"
```

---

### 8. COMPANY/OPCO ANALYSIS

#### By Company
- "ACME Corp projects"
- "Show me BuildCo opportunities"

#### Company Comparison
- "Compare revenue between all companies"
- "Company performance overview"

#### OPCO Revenue Comparison
- "Compare ACME and BuildCo"
- "Revenue by operating company"

**Example Questions:**
```
- "ACME Corp mega projects"
- "BuildCo won projects in Texas"
- "Compare performance across OPCOs"
```

---

### 9. CLIENT ANALYSIS

#### By Client/CLID
- "CLID 1573 projects"
- "Show me XYZ Corporation projects"

#### By Client & Fee Range
- "CLID 1573 projects over $500k"
- "High-value projects for XYZ Corp"

#### Clients with Best Win Rates
- "Top 20 clients by win rate"
- "Which clients are easiest to win?"

**Example Questions:**
```
- "CLID 1573 mega projects in California"
- "XYZ Corp projects with >70% win rate"
- "All clients with over $1M projects"
```

---

### 10. GEOGRAPHIC/REGIONAL

#### By State
- "California projects"
- "Show me Texas opportunities"
- "NY projects"

#### Largest in Region
- "Top 10 projects in California"
- "Biggest opportunities in Texas"

**Example Questions:**
```
- "California transportation projects over $1M"
- "Texas mega projects in last year"
- "Won projects in NY with high value"
```

---

### 11. COMPLEX MULTI-FILTER QUERIES

The system supports **ANY combination** of filters:

**Available Filters:**
- Size (Micro, Small, Medium, Large, Mega)
- Status (Won, Lost, Lead, Submitted, etc.)
- State/Location (CA, TX, NY, etc.)
- Company/OPCO
- Client/CLID
- Categories
- Tags
- Fee range (min/max)
- Win rate range (min/max)
- Date range
- Limit (top N)

**Example Complex Questions:**
```
- "Mega sized transportation projects in California with >70% win rate"
- "Won projects over $1M in Texas from last 6 months"
- "Small to medium Rail projects with 60-80% win rate for CLID 1573"
- "Lost mega projects in energy sector that had >80% confidence"
- "Active leads under $500k in CA, TX, or NY"
```

---

### 12. AGGREGATION & ANALYTICS

#### Weighted Revenue Projection
- "Show me pipeline value weighted by win rate"
- "Predicted revenue by status"

#### Year Comparison
- "Compare 2023 vs 2024"
- "Year over year comparison"

#### Size Distribution
- "How are projects distributed by size?"
- "Size breakdown"

#### Status Breakdown
- "Projects by status"
- "Status distribution"

**Example Questions:**
```
- "What's our weighted pipeline value?"
- "Compare transportation revenue 2023 vs 2024"
- "Show project count by size and status"
```

---

### 13. FOLLOW-UP QUESTIONS (Max 3 per query)

After any query, you can ask up to **3 follow-up refinements**:

**Follow-up Pattern:**
1. **Original**: "Top 10 projects in 2024"
2. **Follow-up 1**: "in California" ✅
3. **Follow-up 2**: "mega sized only" ✅
4. **Follow-up 3**: "with high win rates" ✅

**Follow-ups Support ALL Filters:**
- Add location: "in California"
- Add size: "mega sized only"
- Add status: "only won projects"
- Add win rate: "with >70% confidence"
- Add tags: "with Rail tag"
- Add date: "from last 6 months"
- Change limit: "just top 3"
- Add client: "for CLID 1573"

**Example Follow-up Chains:**
```
Q1: "Large projects"
F1: "in California"
F2: "transportation only"
F3: "won status"

Q1: "Show me 2024 projects"
F1: "mega sized"
F2: "in Texas"
F3: "with >80% win rate"
```

---

## 🔨 PLANNED BUSINESS QUESTIONS (To Be Implemented)

### A. POINT OF CONTACT (POC) ANALYSIS

**Top Performing POCs**
- "Which POCs have the highest win rates?"
- "Top 10 project managers by revenue"
- "Who manages the most projects?"
- "Best POC in California?"

**POC Performance Metrics**
- "John Smith's win rate"
- "How many projects does Jane handle?"
- "POC performance comparison"

**Example Use Cases:**
```
- "Show me Sarah's mega projects"
- "Which POC has best win rate in Texas?"
- "Top 5 POCs by total project value"
```

---

### B. DESCRIPTION KEYWORD SEARCH

**Text Search in Descriptions**
- "Projects mentioning 'bridge'"
- "Descriptions containing 'solar'"
- "Search for 'wastewater treatment'"

**Combined with Filters**
- "Transportation projects mentioning 'highway' in California"
- "Mega projects with 'renewable' in description"

**Example Use Cases:**
```
- "Find all bridge projects over $1M"
- "Projects mentioning 'sustainable' in Texas"
- "Search descriptions for 'transit hub'"
```

---

### C. TREND & GROWTH ANALYSIS

**Year-over-Year Growth**
- "Year over year revenue growth"
- "Compare 2024 vs 2023 performance"
- "YoY project count increase"

**Monthly Trends**
- "Revenue by month for 2024"
- "Projects per month trend"
- "Monthly win rate changes"

**Quarter Comparisons**
- "Compare Q1 vs Q2 2024"
- "Quarter over quarter growth"
- "Best performing quarter"

**Example Use Cases:**
```
- "Show me YoY growth in transportation"
- "Monthly revenue trend for California"
- "Compare Q4 2023 vs Q4 2024"
```

---

### D. CONVERSION FUNNEL ANALYSIS

**Pipeline Progression**
- "Lead to won conversion rate"
- "How many leads become wins?"
- "Conversion funnel breakdown"

**Stage Analysis**
- "Average time from lead to win"
- "Proposal to win success rate"
- "Where do we lose most projects?"

**Example Use Cases:**
```
- "Show conversion rate for mega projects"
- "Lead to win rate in California"
- "Proposal success rate by category"
```

---

### E. PIPELINE VALUE ANALYSIS

**Weighted Pipeline**
- "Total pipeline value weighted by win %"
- "Expected revenue from active pipeline"
- "Probability-adjusted pipeline"

**By Status**
- "Pipeline value by status"
- "Submitted proposals total value"
- "Lead stage pipeline"

**By Time Period**
- "Next quarter weighted pipeline"
- "2024 remaining pipeline value"

**Example Use Cases:**
```
- "What's our Q1 2025 weighted pipeline?"
- "Expected revenue from transportation pipeline"
- "Mega project pipeline value"
```

---

### F. CLIENT RETENTION ANALYSIS

**Repeat vs New Clients**
- "Which clients are repeat customers?"
- "New vs returning client ratio"
- "Client lifetime value"

**Client Patterns**
- "Clients with most projects"
- "Average project value per client"
- "Client churn analysis"

**Example Use Cases:**
```
- "Show me repeat clients in California"
- "Which clients have >5 projects?"
- "New clients in 2024"
```

---

### G. MARKET SHARE BY REGION

**Regional Performance**
- "Revenue by state"
- "Top 5 states by project count"
- "Geographic revenue distribution"

**Regional Comparisons**
- "Compare California vs Texas performance"
- "Which region has highest win rate?"
- "Regional market penetration"

**Example Use Cases:**
```
- "Show revenue distribution across states"
- "Top performing regions for transportation"
- "Win rate comparison by geography"
```

---

### H. RISK ANALYSIS

**High-Risk Projects**
- "High-value projects with low win rates"
- "Projects over $1M with <40% confidence"
- "Risky pursuits"

**Over-Confident Analysis**
- "Projects we lost despite >70% confidence"
- "Calibration of win rate predictions"

**Resource Allocation**
- "Should we pursue this based on win rate?"
- "Risk-adjusted opportunity ranking"

**Example Use Cases:**
```
- "Mega projects with <50% win rate"
- "High-risk high-reward opportunities"
- "Projects we should abandon"
```

---

### I. PROJECT TYPE PERFORMANCE

**By Project Type**
- "Which project types are most profitable?"
- "Design vs construction revenue"
- "Best performing project types"

**Type + Category**
- "Design projects in transportation"
- "Construction win rate by category"

**Example Use Cases:**
```
- "Consulting revenue by state"
- "Design project win rates"
- "Most profitable project type"
```

---

### J. MONTH-BASED QUERIES

**By Month**
- "Projects starting in January"
- "Show me March projects"
- "Revenue by month"

**Multi-Month**
- "Projects from Jan-Mar 2024"
- "Summer projects (Jun-Aug)"

**Example Use Cases:**
```
- "January 2024 transportation projects"
- "Monthly revenue for California"
- "Projects starting next month"
```

---

## 📝 BUSINESS INTELLIGENCE EXAMPLES

### Executive Dashboard Questions
```
1. "What's our total pipeline value weighted by win probability?"
2. "Compare YoY revenue growth by category"
3. "Show me top 10 opportunities by expected value"
4. "Which regions have the highest win rates?"
5. "What's our conversion rate from lead to win?"
```

### Sales Team Questions
```
1. "Show me all active leads over $500k"
2. "Which clients should we prioritize based on win rate?"
3. "Projects we're most likely to win this quarter"
4. "High-value low-risk opportunities"
5. "My POC performance metrics"
```

### Operations Questions
```
1. "Projects starting in next 3 months by region"
2. "Resource allocation by project type"
3. "Which categories need more focus?"
4. "Where are we losing most often?"
5. "Best performing project types"
```

### Strategic Planning Questions
```
1. "Market share by geography"
2. "Category growth trends"
3. "Client retention rates"
4. "Emerging opportunities by tags"
5. "Competitor win patterns (via loss analysis)"
```

---

## 🎯 QUERY CAPABILITIES SUMMARY

### ✅ Fully Supported (Current)
- Time-based filtering (year, quarter, date range, semantic dates)
- Size/Value filtering (dynamic percentiles + fee ranges)
- Geographic filtering (state-level)
- Category/Type filtering
- Tag-based queries (single & multiple)
- Status-based queries
- Win rate analysis
- Client/CLID filtering
- Company/OPCO filtering
- Rankings (top/bottom by any metric)
- Aggregations (count, sum, average)
- Multi-filter combinations (ANY filter + ANY filter)
- Follow-up refinements (up to 3 per query)
- Weighted revenue projections

### 🔨 Planned Enhancements
- POC performance analysis
- Description text search
- Trend/growth analytics
- Conversion funnel metrics
- Pipeline forecasting
- Client retention metrics
- Market share analysis
- Risk scoring
- Project type profitability
- Month-based granularity
- Time-to-win analysis
- Seasonal patterns
- Budget vs actual analysis
- Competitive intelligence

---

## 💡 TIPS FOR ASKING QUESTIONS

### 1. Be Specific About What You Want
✅ "Top 10 mega projects in California with >70% win rate"
❌ "Show me some projects"

### 2. Use Natural Language
✅ "Projects starting in next 6 months"
✅ "Last year transportation projects"
✅ "Mega sized opportunities in Texas"

### 3. Combine Multiple Filters
✅ "Won transportation projects over $1M in CA from 2024"
✅ "Small active leads with Rail tag and high win rates"

### 4. Use Follow-ups for Refinement
1. Start broad: "Show me 2024 projects"
2. Refine: "in California"
3. Refine: "mega sized only"
4. Refine: "transportation category"

### 5. Ask for Analytics
✅ "Compare transportation vs energy revenue"
✅ "Show win rate distribution"
✅ "Pipeline value by status"

### 6. Reference Specific Fields
- Use "CLID" for Client ID
- Use "OPCO" or "Company" for operating company
- Use "tags" for project tags
- Use "categories" for request categories

---

## 🔍 SEARCH PATTERNS RECOGNIZED

The system understands many natural language patterns:

### Time References
- "last 6 months", "next year", "Q3 2024"
- "2023", "2022 and 2023", "from Jan to Mar"
- "soon", "recently", "upcoming"

### Size References
- "small", "large", "mega", "medium", "micro"
- "biggest", "largest", "smallest", "tiniest"

### Status References
- "won", "lost", "active", "leads", "submitted"
- "successful", "unsuccessful", "pending"

### Ranking Words
- "top 10", "best 5", "worst 3"
- "highest", "lowest", "most", "least"

### Filters
- "over $1M", "between $500k and $2M"
- "with >70% win rate", "high confidence"
- "in California", "for CLID 1573"

---

## 📊 SUPPORTED CHART TYPES

### Bar Charts
- Revenue comparisons
- Project counts
- Rankings
- Fee distributions

### Line Charts
- Trends over time (planned)
- Growth trajectories (planned)

### Pie Charts
- Status distribution
- Size distribution
- Category breakdown

---

## 🚀 GETTING STARTED

### Simple Questions (Try These First)
```
1. "Show me all projects"
2. "Top 10 largest projects"
3. "Projects in California"
4. "Won projects"
5. "Projects in 2024"
```

### Intermediate Questions
```
1. "Large transportation projects in California"
2. "Top 5 projects with >80% win rate"
3. "Mega projects in last 6 months"
4. "Active leads over $500k"
5. "Rail projects in Texas"
```

### Advanced Questions
```
1. "Mega transportation projects in CA with >70% win rate from 2024"
2. "Compare revenue between transportation and energy sectors"
3. "Show pipeline value weighted by win probability"
4. "Lost mega projects that had >80% confidence"
5. "Top 10 clients by win rate for small to medium projects"
```

---

**Last Updated:** October 31, 2025
**Total Query Templates:** 40+ templates covering 500+ question variations
**Follow-up Capability:** 3 refinements per query with universal filter support
