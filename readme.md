# 🏢 Rent Roll Chat Assistant

A conversational AI interface for rental property data analysis. Chat naturally about your rent roll data using the Model Context Protocol (MCP) - just like Claude Desktop!

## ✨ Features

- **Natural Language Queries** - Ask anything about your rental data
- **Smart SQL Generation** - AI automatically writes database queries
- **MCP Integration** - Uses Model Context Protocol for data access
- **Zero Hardcoding** - Handles any question dynamically

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
# Add your OpenAI API key
echo "OPENAI_API_KEY=your-openai-key-here" > .env
```

### 3. Load Your Data
```bash
# Load rent roll data into SQLite database
npm run load-data
```

### 4. Start Chat Interface
```bash
# Start the conversational interface
npm run web
```

### 5. Open Browser
Visit: **http://localhost:3000**


```

## 🔧 Available Scripts

- `npm run web` - Start conversational interface
- `npm run mcp` - Start MCP server only
- `npm run load-data` - Load JSONL data to database

## 🎯 How It Works

1. **You ask a question** in natural language
2. **AI understands** your intent and rental data context
3. **MCP server** executes the query securely
4. **Results formatted** and presented conversationally



## 📋 Prerequisites

- **Claude Desktop** version 0.7.0 or later (MCP support required)
- **Node.js** 18+ with npm
- **Rent roll data** in JSONL format

```

# For claude desktop

### 1.Load data

```
npm run load-data
```

### 2. Setup Claude Desktop Integration

```bash
# Configure Claude Desktop automatically
npm run setup-claude
```

### 3. Restart Claude Desktop

**Important**: Completely quit and restart Claude Desktop (not just close the window).

### 4. Test the Connection

In Claude Desktop, you should see "rent-roll" appear in the connection menu. Try asking:

- "Get vacant units"
- "Show me occupancy statistics"
- "Search for 2-bedroom units"

## 📊 Available Tools


### Sample Questions You Can Ask 

```
"How many vacant units do we have?"
"What is our current occupancy rate?"
"Show me all 2-bedroom units with their rent"
"Find all tenants with leases expiring in 2025"
"What's our total monthly revenue?"
"Which units have the highest rent?"
"Show me units by tenant name containing 'Smith'"
"Give me a revenue analysis with projections"
```

## 🗄️ Database Schema

The system expects rent roll data with these columns:

```sql
CREATE TABLE rent_roll (
  id INTEGER PRIMARY KEY,
  unit INTEGER NOT NULL,           -- Unit number
  name TEXT NOT NULL,              -- Tenant name
  type TEXT NOT NULL,              -- Unit type (1x1.1, 2x2.4, etc.)
  sq_ft INTEGER,                   -- Square footage
  monthly_rent REAL,               -- Monthly rent amount
  deposit REAL,                    -- Security deposit
  moved_in TEXT,                   -- Move-in date
  lease_ends TEXT,                 -- Lease end date
  status TEXT NOT NULL,            -- Occupancy status
  created_at DATETIME,
  updated_at DATETIME
);
```

### Status Codes
- `'O'` = Occupied
- `'VU'` = Vacant Unit
- `'NU'` = Notice/Unknown
- `'VR'` = Vacant Ready




## ⚙️ Configuration

### Environment Variables (`.env`)
```env
DB_PATH=./rent_roll.db
```

### Claude Desktop Config
Location: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

```json
{
  "mcpServers": {
    "rent-roll": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/full/absolute/path/to/your/project",
      "env": {
        "DB_PATH": "/full/absolute/path/to/your/project/rent_roll.db"
      }
    }
  }
}
```

## 🔧 Development

### Available Scripts

```bash
npm run mcp              # Start MCP server
npm run load-data        # Load JSONL data into SQLite
npm run setup-claude     # Configure Claude Desktop
npm run build           # Compile TypeScript
```

### Testing the MCP Server

```bash
# Test server startup (should run without errors)
npm run mcp


```

## 🛠️ Troubleshooting

### MCP Server Not Connecting
1. Verify Claude Desktop version 0.7.0+
2. Check that `rent_roll.db` exists and has data
3. Ensure absolute paths in Claude Desktop config
4. Completely restart Claude Desktop





---
