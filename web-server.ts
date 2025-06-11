// direct-mcp-chat.ts - Direct MCP conversation like Claude Desktop
import express, { Request, Response } from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import OpenAI from 'openai';
import 'dotenv/config';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

let mcpClient: Client | null = null;

// Connect to MCP server
async function initMCP() {
  const transport = new StdioClientTransport({
    command: 'npm',
    args: ['run', 'mcp'],
    env: Object.fromEntries(
      Object.entries(process.env).filter(([_, v]) => typeof v === 'string')
    ) as Record<string, string>
  });
  
  mcpClient = new Client({ name: "chat-client", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(transport);
  console.log('✅ Connected to MCP server');
}

// Get database schema info
async function getDatabaseInfo() {
  if (!mcpClient) throw new Error('MCP not connected');
  
  // Get schema information from MCP
  try {
    const resources = await mcpClient.listResources();
    const schemaResource = resources.resources.find(r => r.uri === 'schema://rent_roll');
    if (schemaResource) {
      const schema = await mcpClient.readResource({ uri: 'schema://rent_roll' });
      return schema.contents[0]?.text || '';
    }
  } catch (e) {
    console.log('Could not get schema, using basic info');
  }
  
  return `Database: rent_roll table with columns: unit, name, type, sq_ft, monthly_rent, deposit, moved_in, lease_ends, status
Status codes: 'O'=Occupied, 'VU'=Vacant Unit, 'NU'=Notice, 'VR'=Vacant Ready`;
}

// Execute SQL via MCP
async function executeSQL(sql: string) {
  if (!mcpClient) throw new Error('MCP not connected');
  
  const result = await mcpClient.callTool({
    name: 'custom_sql_query',
    arguments: { sql }
  });
  
  return result.content?.[0]?.text || '';
}

// Main chat endpoint - works like Claude Desktop
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    console.log(`💬 User: "${message}"`);

    // Get database context
    const dbInfo = await getDatabaseInfo();
    
    // Use LLM to understand the question and generate SQL
    const prompt = `You are a helpful assistant for rental property data analysis. The user has a SQLite database with rental property information.

Database Information:
${dbInfo}

User Question: "${message}"

Please help answer this question. If you need to query the database, write a SQL query. Otherwise, provide a helpful response.

If you need to query data, respond with:
SQL: your_sql_query_here
EXPLANATION: what this query does

If no SQL is needed, just provide a helpful answer.

Examples:
- "who is the first tenant?" → SQL: SELECT * FROM rent_roll ORDER BY unit LIMIT 1
- "how many vacant units?" → SQL: SELECT COUNT(*) as vacant_count FROM rent_roll WHERE status IN ('VU', 'VR')
- "show me unit 110" → SQL: SELECT * FROM rent_roll WHERE unit = 110`;

    const llmResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1
    });

    const llmContent = llmResponse.choices[0].message.content || '';
    console.log(`🧠 LLM Response: ${llmContent}`);

    // Check if LLM wants to run SQL
    const sqlMatch = llmContent.match(/SQL:\s*(.+?)(?:\n|$)/i);
    
    if (sqlMatch) {
      const sql = sqlMatch[1].trim();
      console.log(`🗄️ Executing SQL: ${sql}`);
      
      try {
        const sqlResult = await executeSQL(sql);
        console.log(`✅ SQL Result received`);
        
        // Ask LLM to format the result nicely
        const formatPrompt = `The user asked: "${message}"

I ran this SQL query: ${sql}

Raw result from database:
${sqlResult}

Please format this result in a friendly, readable way for the user. If it's tabular data, present it nicely. If it's a single answer, explain it clearly.`;

        const formatResponse = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: formatPrompt }],
          temperature: 0.1
        });

        const formattedAnswer = formatResponse.choices[0].message.content || sqlResult;

        res.json({
          success: true,
          response: {
            type: 'text',
            message: formattedAnswer,
            data: { sql_executed: sql, raw_result: sqlResult }
          }
        });

      } catch (sqlError) {
        console.error('SQL Error:', sqlError);
        res.json({
          success: true,
          response: {
            type: 'text',
            message: `I tried to query the database but encountered an error: ${
              sqlError instanceof Error ? sqlError.message : String(sqlError)
            }. Let me try to help you in another way.`,
            data: {}
          }
        });
      }
    } else {
      // No SQL needed, just return LLM response
      res.json({
        success: true,
        response: {
          type: 'text',
          message: llmContent,
          data: {}
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      response: {
        type: 'error',
        message: 'Sorry, I encountered an error. Please try again.',
        data: {}
      }
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mcp_connected: !!mcpClient });
});

// Serve chat interface
app.get('/', (req, res) => {
  res.sendFile('chat.html', { root: 'public' });
});

// Start server
async function start() {
  await initMCP();
  app.listen(port, () => {
    console.log(`🌐 Direct MCP Chat running at http://localhost:${port}`);
    console.log(`💬 Chat naturally - just like Claude Desktop!`);
    console.log(`🗄️ Connected to rent roll database via MCP`);
  });
}

start().catch(console.error);