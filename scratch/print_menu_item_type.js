
import { readFileSync } from 'fs';

const content = readFileSync('src/types/database.ts', 'utf8');
const index = content.indexOf('interface MenuItem');
if (index !== -1) {
  console.log(content.substring(index, content.indexOf('}', index + 20) + 1));
} else {
  console.log("MenuItem interface not found.");
}
