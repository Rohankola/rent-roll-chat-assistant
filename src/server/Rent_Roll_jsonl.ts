import * as fs from 'fs/promises';
import { parse } from 'csv-parse';
import { createReadStream } from 'fs';
import { RentRollRecord } from './types.js';

/**
 * Convert Rent Roll CSV to JSONL format
 */
export async function convertRentRollToJsonl(inputPath: string, outputPath: string): Promise<void> {
  const records: RentRollRecord[] = [];
  
  const parser = createReadStream(inputPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        if (context.column === 'Unit') {
          return parseInt(value) || null;
        }
        if (context.column === 'SQ FT') {
          return parseInt(value) || null;
        }
        if (context.column === 'AUTOBILL' || context.column === 'DEPOSIT') {
          const cleanValue = value.toString().replace(/[$,]/g, '');
          return parseFloat(cleanValue) || null;
        }
        return value;
      },
      relax_quotes: true,
      relax_column_count: true,
      from_line: 7
    })
  );

  // Collect all records
  for await (const record of parser) {
    if (record.Unit && record.Name && record.Unit !== 'Unit') {
      const cleanRecord = { ...record };
      delete cleanRecord['']; // Remove empty column
      records.push(cleanRecord);
    }
  }

  // Write JSONL file
  const jsonlContent = records.map(record => JSON.stringify(record)).join('\n');
  await fs.writeFile(outputPath, jsonlContent, 'utf8');
  
  console.log(`Converted ${records.length} rent roll records from CSV to JSONL`);
  console.log(`Output saved to: ${outputPath}`);
  
 
}


// Only run CLI logic if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: tsx jsonl.ts <input.csv> <output.jsonl>');
    console.error('Example: tsx jsonl.ts Anonymized_Rent_Roll.csv rent_roll.jsonl');
    process.exit(1);
  }

  const [inputPath, outputPath] = args;
  
  (async () => {
    try {
      console.log('Converting Rent Roll CSV to JSONL...');
      await convertRentRollToJsonl(inputPath, outputPath);
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}