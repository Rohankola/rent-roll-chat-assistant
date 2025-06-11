// src/db/db.ts - Simplified Database Layer
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import { RentRollRecord } from '../server/types.js';

export class RentRollDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'rent_roll.db') {
    this.db = new Database(dbPath);
    this.createTables();
  }

  /**
   * Create the database schema
   */
  private createTables(): void {
    // Create rent_roll table matching JSONL structure exactly
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS rent_roll (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        sq_ft INTEGER,
        monthly_rent REAL,
        deposit REAL,
        moved_in TEXT,
        lease_ends TEXT,
        status TEXT NOT NULL CHECK (status IN ('O', 'VU', 'NU', 'VR')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better query performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_unit ON rent_roll(unit)',
      'CREATE INDEX IF NOT EXISTS idx_status ON rent_roll(status)',
      'CREATE INDEX IF NOT EXISTS idx_type ON rent_roll(type)'
    ];

    this.db.exec(createTableSQL);
    createIndexes.forEach(indexSQL => this.db.exec(indexSQL));
    console.log('✅ Database schema created successfully');
  }

  /**
   * Load JSONL file and insert into database
   */
  async loadFromJsonl(jsonlPath: string): Promise<void> {
    try {
      const content = await fs.readFile(jsonlPath, 'utf8');
      const lines = content.trim().split('\n');
      const records: RentRollRecord[] = lines.map(line => JSON.parse(line));

      // Prepare insert statement
      const insertSQL = `
        INSERT OR REPLACE INTO rent_roll (
          unit, name, type, sq_ft, monthly_rent, deposit,
          moved_in, lease_ends, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const stmt = this.db.prepare(insertSQL);

      // Use transaction for efficiency
      const insertMany = this.db.transaction((records: RentRollRecord[]) => {
        for (const record of records) {
          stmt.run(
            record.Unit,
            record.Name,
            record.TYPE,
            record["SQ FT"],
            record.AUTOBILL, // Store as monthly_rent
            record.DEPOSIT,
            record["MOVED IN"],
            record["LEASE ENDS"],
            record.STATUS
          );
        }
      });

      insertMany(records);
      console.log(`✅ Inserted ${records.length} records from ${jsonlPath} into database`);
    } catch (error) {
      console.error('❌ Error loading JSONL file:', error);
      throw error;
    }
  }

  /**
   * Execute a query and return results
   */
  query(sql: string, params: any[] = []): any[] {
    try {
      return this.db.prepare(sql).all(params);
    } catch (error) {
      throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * CLI interface for database operations
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  const db = new RentRollDatabase();

  switch (command) {
    case 'load-jsonl':
      if (args[1]) {
        await db.loadFromJsonl(args[1]);
      } else {
        console.error('Usage: tsx db.ts load-jsonl <jsonl-file>');
      }
      break;
    default:
      console.log('Usage:');
      console.log('  tsx db.ts load-jsonl <jsonl-file> - Load data from JSONL into SQLite database');
  }
  db.close();
}