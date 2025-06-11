// src/mcp/server-simple.ts - No OpenAI dependency
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'better-sqlite3';

// Initialize database
const dbPath = process.env.DB_PATH || './rent_roll.db';
const db = new Database(dbPath);

const server = new Server(
  {
    name: 'rent-roll-mcp-simple',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper function to execute SQL safely
function executeQuery(sql: string, params: any[] = []): any[] {
  try {
    return db.prepare(sql).all(params);
  } catch (error) {
    throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'schema://rent_roll',
        name: 'Database Schema',
        description: 'Complete schema and sample data from rent_roll database',
        mimeType: 'text/plain'
      }
    ]
  };
});

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri === 'schema://rent_roll') {
    try {
      const totalUnits = executeQuery('SELECT COUNT(*) as count FROM rent_roll')[0].count;
      const occupiedUnits = executeQuery("SELECT COUNT(*) as count FROM rent_roll WHERE status = 'O'")[0].count;
      const vacantUnits = executeQuery("SELECT COUNT(*) as count FROM rent_roll WHERE status IN ('VU', 'VR')")[0].count;
      const occupancyRate = ((occupiedUnits / totalUnits) * 100).toFixed(1);
      
      const statusBreakdown = executeQuery(`
        SELECT status, COUNT(*) as count 
        FROM rent_roll 
        GROUP BY status
      `);
      
      const sampleData = executeQuery('SELECT * FROM rent_roll LIMIT 3');
      
      const content = `# Rent Roll Database Overview

## Quick Stats
- **Total Units:** ${totalUnits}
- **Occupied:** ${occupiedUnits} (${occupancyRate}%)
- **Vacant:** ${vacantUnits}

## Status Codes
- 'O' = Occupied
- 'VU' = Vacant Unit  
- 'NU' = Notice/Unknown
- 'VR' = Vacant Ready

## Status Breakdown
${statusBreakdown.map((s: any) => `- ${s.status}: ${s.count} units`).join('\n')}

## Available Columns
- unit: Unit number
- name: Tenant name
- type: Unit type (1x1.1, 1x1.2, 1x1.3, 2x2.1, etc.)
- sq_ft: Square footage
- monthly_rent: Monthly rent amount
- deposit: Security deposit
- moved_in: Move-in date
- lease_ends: Lease end date
- status: Occupancy status

## Sample Data
${JSON.stringify(sampleData, null, 2)}`;

      return {
        contents: [{
          uri,
          mimeType: 'text/plain',
          text: content
        }]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to read schema: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_vacant_units',
        description: 'Get all vacant rental units',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_occupancy_stats',
        description: 'Get occupancy rate and statistics',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'search_units_by_type',
        description: 'Search for units by type (1-bedroom, 2-bedroom, etc.)',
        inputSchema: {
          type: 'object',
          properties: {
            unit_type: {
              type: 'string',
              description: 'Unit type: "1-bedroom" or "2-bedroom" or specific like "1x1.1"'
            }
          },
          required: ['unit_type']
        }
      },
      {
        name: 'search_by_tenant_name',
        description: 'Search for units by tenant name',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Tenant name to search for (partial matches allowed)'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'get_lease_expirations',
        description: 'Get leases expiring in a specific year',
        inputSchema: {
          type: 'object',
          properties: {
            year: {
              type: 'string',
              description: 'Year to check (e.g., "2025")'
            }
          },
          required: ['year']
        }
      },
      {
        name: 'get_revenue_analysis',
        description: 'Get rental revenue analysis',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'custom_sql_query',
        description: 'Execute a custom SQL query on the rent roll data',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'SQL query to execute'
            }
          },
          required: ['sql']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_vacant_units': {
      const results = executeQuery(`
        SELECT unit, name, type, sq_ft, status 
        FROM rent_roll 
        WHERE status IN ('VU', 'VR')
        ORDER BY unit
      `);
      
      return {
        content: [
          {
            type: 'text',
            text: `**Vacant Units: ${results.length} units available**

${results.map(unit => 
  `• **Unit ${unit.unit}** - ${unit.type} (${unit.sq_ft} sq ft) - Status: ${unit.status === 'VU' ? 'Vacant Unit' : 'Vacant Ready'}`
).join('\n')}

**Details:**
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\``
          }
        ]
      };
    }

    case 'get_occupancy_stats': {
      const total = executeQuery("SELECT COUNT(*) as count FROM rent_roll")[0].count;
      const occupied = executeQuery("SELECT COUNT(*) as count FROM rent_roll WHERE status = 'O'")[0].count;
      const vacant = executeQuery("SELECT COUNT(*) as count FROM rent_roll WHERE status IN ('VU', 'VR')")[0].count;
      const notice = executeQuery("SELECT COUNT(*) as count FROM rent_roll WHERE status = 'NU'")[0].count;
      const rate = ((occupied / total) * 100).toFixed(1);
      
      return {
        content: [
          {
            type: 'text',
            text: `**📊 Occupancy Statistics**

**Overall Rate:** ${rate}% occupied

**Breakdown:**
• **Total Units:** ${total}
• **Occupied:** ${occupied} units
• **Vacant Available:** ${vacant} units  
• **Notice/Pending:** ${notice} units

**Vacancy Rate:** ${(100 - parseFloat(rate)).toFixed(1)}%`
          }
        ]
      };
    }

    case 'search_units_by_type': {
      if (!args || typeof args.unit_type !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'unit_type is required');
      }

      let sql = '';
      const searchType = args.unit_type.toLowerCase();
      
      if (searchType.includes('1-bedroom') || searchType.includes('1 bedroom')) {
        sql = "SELECT * FROM rent_roll WHERE type LIKE '1x1%' ORDER BY unit";
      } else if (searchType.includes('2-bedroom') || searchType.includes('2 bedroom')) {
        sql = "SELECT * FROM rent_roll WHERE type LIKE '2x2%' ORDER BY unit";
      } else {
        sql = "SELECT * FROM rent_roll WHERE type LIKE ? ORDER BY unit";
      }

      const results = sql.includes('?') 
        ? executeQuery(sql, [`%${args.unit_type}%`])
        : executeQuery(sql);
      
      return {
        content: [
          {
            type: 'text',
            text: `**Units matching "${args.unit_type}": ${results.length} found**

${results.slice(0, 10).map(unit => 
  `• **Unit ${unit.unit}** - ${unit.name} - ${unit.type} (${unit.sq_ft} sq ft) - $${unit.monthly_rent}/month - ${unit.status === 'O' ? 'Occupied' : 'Vacant'}`
).join('\n')}

${results.length > 10 ? `\n*Showing first 10 of ${results.length} results*` : ''}

**Full Data:**
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\``
          }
        ]
      };
    }

    case 'search_by_tenant_name': {
      if (!args || typeof args.name !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'name is required');
      }

      const results = executeQuery(
        "SELECT * FROM rent_roll WHERE name LIKE ? ORDER BY unit", 
        [`%${args.name}%`]
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `**Tenants matching "${args.name}": ${results.length} found**

${results.map(unit => 
  `• **${unit.name}** - Unit ${unit.unit} - ${unit.type} - $${unit.monthly_rent}/month`
).join('\n')}

**Details:**
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\``
          }
        ]
      };
    }

    case 'get_lease_expirations': {
      if (!args || typeof args.year !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'year is required');
      }

      const results = executeQuery(
        "SELECT * FROM rent_roll WHERE lease_ends LIKE ? AND status = 'O' ORDER BY lease_ends", 
        [`%${args.year}%`]
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `**Leases expiring in ${args.year}: ${results.length} leases**

${results.map(unit => 
  `• **${unit.name}** - Unit ${unit.unit} - Expires: ${unit.lease_ends} - $${unit.monthly_rent}/month`
).join('\n')}

**Details:**
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\``
          }
        ]
      };
    }

    case 'get_revenue_analysis': {
      const occupiedRevenue = executeQuery(`
        SELECT SUM(monthly_rent) as total_revenue, COUNT(*) as occupied_count 
        FROM rent_roll 
        WHERE status = 'O' AND monthly_rent > 0
      `)[0];

      const potentialRevenue = executeQuery(`
        SELECT SUM(monthly_rent) as total_potential 
        FROM rent_roll 
        WHERE monthly_rent > 0
      `)[0];

      const avgRent = executeQuery(`
        SELECT AVG(monthly_rent) as avg_rent 
        FROM rent_roll 
        WHERE status = 'O' AND monthly_rent > 0
      `)[0];

      const lossFromVacancy = potentialRevenue.total_potential - occupiedRevenue.total_revenue;
      
      return {
        content: [
          {
            type: 'text',
            text: `**💰 Revenue Analysis**

**Current Monthly Revenue:** $${occupiedRevenue.total_revenue?.toLocaleString() || 0}
**Potential Monthly Revenue:** $${potentialRevenue.total_potential?.toLocaleString() || 0}
**Revenue Loss from Vacancy:** $${lossFromVacancy?.toLocaleString() || 0}

**Average Rent:** $${avgRent.avg_rent?.toFixed(2) || 0}/month
**Occupied Units Generating Revenue:** ${occupiedRevenue.occupied_count}

**Annual Projections:**
• Current Annual Revenue: $${((occupiedRevenue.total_revenue || 0) * 12).toLocaleString()}
• Potential Annual Revenue: $${((potentialRevenue.total_potential || 0) * 12).toLocaleString()}`
          }
        ]
      };
    }

    case 'custom_sql_query': {
      if (!args || typeof args.sql !== 'string') {
        throw new McpError(ErrorCode.InvalidParams, 'SQL query is required');
      }

      try {
        const results = executeQuery(args.sql);
        return {
          content: [
            {
              type: 'text',
              text: `**SQL Query:** \`${args.sql}\`

**Results:** ${results.length} rows returned

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\``
            }
          ]
        };
      } catch (error) {
        throw new McpError(ErrorCode.InternalError, `Query failed: ${error}`);
      }
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

// Start the MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  db.close();
  process.exit(1);
});