// setup-claude-config.ts - Simplified Claude Desktop Configuration
import fs from 'fs';
import path from 'path';
import os from 'os';
import 'dotenv/config';

const projectPath = process.cwd();
const openaiKey = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

interface MCPServerConfig {
  command: string;
  args: string[];
  cwd: string;
  env: {
    OPENAI_API_KEY: string;
    DB_PATH: string;
  };
}

interface ClaudeConfig {
  mcpServers?: {
    [key: string]: MCPServerConfig;
  };
}

const config: ClaudeConfig = {
  mcpServers: {
    "rent-roll": {
      command: "npm",
      args: ["run", "mcp"],
      cwd: projectPath,
      env: {
        OPENAI_API_KEY: openaiKey,
        DB_PATH: path.join(projectPath, "rent_roll.db")
      }
    }
  }
};

// Determine Claude Desktop config path based on OS
function getClaudeConfigPath(): string {
  const platform = os.platform();
  
  switch (platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32':
      return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    default:
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
  }
}

async function setupClaudeConfig(): Promise<void> {
  const claudeConfigPath = getClaudeConfigPath();

  try {
    // Create directory if it doesn't exist
    const configDir = path.dirname(claudeConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Read existing config or create new one
    let existingConfig: ClaudeConfig = {};
    if (fs.existsSync(claudeConfigPath)) {
      existingConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
    }

    // Merge configurations
    const finalConfig: ClaudeConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        ...config.mcpServers
      }
    };

    // Write config
    fs.writeFileSync(claudeConfigPath, JSON.stringify(finalConfig, null, 2));
    
    console.log('✅ Claude Desktop configuration updated!');
    console.log(`📍 Config file: ${claudeConfigPath}`);
    console.log(`🏠 Project path: ${projectPath}`);
    console.log(`🔑 OpenAI API Key: ${openaiKey === 'your-openai-api-key-here' ? '❌ NOT SET' : '✅ Found'}`);
    console.log('');
    console.log('📝 Next steps:');
    if (openaiKey === 'your-openai-api-key-here') {
      console.log('1. ⚠️  Set OPENAI_API_KEY in your .env file');
    } else {
      console.log('1. ✅ OpenAI API key is configured');
    }
    console.log('2. Make sure database exists: npm run load-data');
    console.log('3. Restart Claude Desktop application');
    console.log('4. Open frontend.html to see example queries');
    console.log('5. Copy questions and paste them in Claude Desktop chat!');
    
  } catch (error) {
    console.error('❌ Error setting up Claude Desktop config:', error);
    console.log('');
    console.log('💡 Manual setup:');
    console.log(`Create this file: ${claudeConfigPath}`);
    console.log('With this content:');
    console.log(JSON.stringify(config, null, 2));
  }
}

// Run setup
setupClaudeConfig();