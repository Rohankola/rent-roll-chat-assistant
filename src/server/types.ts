/**
 * Shared TypeScript interface for Rent Roll data
 */

export interface RentRollRecord {
  Unit: number;
  Name: string;
  TYPE: string;
  "SQ FT": number;
  AUTOBILL: number;
  DEPOSIT: number;
  "MOVED IN": string;
  "LEASE ENDS": string;
  STATUS: string;
}