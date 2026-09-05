
import { readFileSync } from 'fs';

const content = readFileSync('src/types/database.ts', 'utf8');
const lines = content.split('\n');
console.log("=== SEARCHING 'veg' IN database.ts ===");
lines.forEach((line, index) => {
  if (line.toLowerCase().includes('veg')) {
    console.log(`${index + 1}: ${line}`);
  }
});
