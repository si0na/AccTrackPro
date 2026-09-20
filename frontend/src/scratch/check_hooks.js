const fs = require('fs');
const path = require('path');

function getAllFiles(dir, ext = '.tsx') {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(filePath);
    }
  });
  return results;
}

const files = getAllFiles('c:\\Users\\siona.thomas\\Downloads\\account_management_opportunity-tracker\\frontend\\src');
console.log(`Scanning ${files.length} tsx files for hooks after return...`);

const hookRegex = /\b(useState|useEffect|useMemo|useCallback|useContext|useRef|useReducer|useCRM|useSqaRecord|useSqaRecords)\b/;
const returnRegex = /^\s*if\s*\(.*\)\s*return\b/;
const earlyReturnBlockRegex = /^\s*return\s*\(|\bif\s*\(.*\)\s*{\s*return\b/;

let issuesFound = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  let hasSeenTopReturn = false;
  let topReturnLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for component-level early returns like `if (loading) return ...;` or `if (!record) return ...;`
    // Note: We ignore returns inside functions/callbacks.
    if (!hasSeenTopReturn && (
      (line.includes('if (') && line.includes('return') && !line.includes('=>') && !line.includes('function')) ||
      (line.trim().startsWith('if (!') && lines[i+1]?.includes('return'))
    )) {
      // Check if this looks like a top-level component render check
      // Simple heuristic: return contains JSX `<` or `<Card>` or `<Loading`
      const lookahead = lines.slice(i, i + 10).join('\n');
      if (lookahead.includes('<') && (lookahead.includes('Card') || lookahead.includes('div') || lookahead.includes('Loading') || lookahead.includes('Error'))) {
        hasSeenTopReturn = true;
        topReturnLine = i + 1;
      }
    }

    if (hasSeenTopReturn) {
      if (hookRegex.test(line) && !line.includes('import')) {
        console.log(`POSSIBLE HOOK VIOLATION in ${file}:${i+1}`);
        console.log(`  Top return at line ${topReturnLine}: ${lines[topReturnLine-1].trim()}`);
        console.log(`  Hook at line ${i+1}: ${line.trim()}`);
        issuesFound++;
      }
    }
  }
});

console.log(`Scan complete. Found ${issuesFound} potential hook violations.`);
