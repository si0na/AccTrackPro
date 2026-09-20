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

const hookRegex = /\b(useState|useEffect|useMemo|useCallback|useContext|useRef|useReducer|useCRM|useSqaRecord|useSqaRecords)\b/;

let issues = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  let returnsInComponent = [];
  let inComponent = false;
  let componentName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Simple component detection
    const match = line.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*:\s*React\.FC|(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*(?:React\.)?(?:memo|forwardRef)?\(?|function\s+([A-Z]\w+)/);
    if (match) {
      inComponent = true;
      componentName = match[1] || match[2] || match[3];
      returnsInComponent = [];
    }

    if (inComponent) {
      // Check for return statement returning JSX, string, null or object (early component return)
      const isReturnStatement = (
        line.trim().startsWith('return') ||
        (line.includes('if (') && line.includes('return') && (line.includes('<') || line.includes('null') || line.includes('undefined'))) ||
        (line.trim().startsWith('if (!') && lines[i+1]?.trim().startsWith('return'))
      );

      // We exclude returns inside callbacks/methods by checking indentation level (4 spaces max for root component level)
      const indent = line.search(/\S/);
      if (isReturnStatement && indent <= 6 && !line.includes('=>') && !line.includes('function') && !line.includes('.map(') && !line.includes('.filter(')) {
        returnsInComponent.push({ line: i + 1, code: line.trim() });
      }

      if (returnsInComponent.length > 0 && hookRegex.test(line) && !line.includes('import') && !line.includes('//')) {
        // Exclude hooks inside the return statement itself (none should exist, but check)
        issues.push({
          file: path.relative(process.cwd(), file),
          component: componentName,
          hookLine: i + 1,
          hookCode: line.trim(),
          returns: returnsInComponent.slice()
        });
      }
    }
  }
});

console.log(`Scanned files. Found ${issues.length} potential hook order violations:\n`);
issues.forEach(iss => {
  console.log(`[${iss.file}] Component: ${iss.component}`);
  iss.returns.forEach(r => console.log(`  Early Return at L${r.line}: ${r.code}`));
  console.log(`  ---> Hook called at L${iss.hookLine}: ${iss.hookCode}\n`);
});
