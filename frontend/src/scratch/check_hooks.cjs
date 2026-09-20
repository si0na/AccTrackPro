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
console.log(`Scanning ${files.length} tsx files for strict React hooks violations...`);

const hookNames = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useContext', 'useRef', 'useReducer', 'useCRM', 'useSqaRecord', 'useSqaRecords'];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  let inComponent = false;
  let componentName = '';
  let returnsBeforeHooks = [];
  let bracketDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Simple component detector
    const compMatch = line.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*(?:React\.)?(?:memo\(|forwardRef\()?/);
    const fnMatch = line.match(/function\s+([A-Z]\w+)/);
    const fcMatch = line.match(/(?:export\s+)?const\s+([A-Z]\w+)\s*:\s*React\.FC/);
    if (compMatch || fnMatch || fcMatch) {
      inComponent = true;
      componentName = (compMatch && compMatch[1]) || (fnMatch && fnMatch[1]) || (fcMatch && fcMatch[1]);
      returnsBeforeHooks = [];
    }

    if (inComponent) {
      // Look for early returns returning JSX or null at root component level
      if (line.match(/\bif\s*\(.*\)\s*return\b/) || (line.includes('if (') && line.includes('{') && lines[i+1]?.includes('return'))) {
        const lookahead = lines.slice(i, i + 8).join(' ');
        if (lookahead.includes('return') && (lookahead.includes('<') || lookahead.includes('null'))) {
          // Verify it's not inside a helper function or callback
          // Check indentation
          const indent = line.search(/\S/);
          if (indent <= 4) {
            returnsBeforeHooks.push({ line: i + 1, content: line.trim() });
          }
        }
      }

      // Check if a hook is used
      for (const hook of hookNames) {
        const hookRegex = new RegExp(`\\b${hook}\\b`);
        if (hookRegex.test(line) && !line.includes('import') && !line.includes('//') && !line.includes('*')) {
          if (returnsBeforeHooks.length > 0) {
            console.log(`CRITICAL HOOK VIOLATION in ${path.relative(process.cwd(), file)} [${componentName}]:`);
            returnsBeforeHooks.forEach(r => {
              console.log(`  Early Return at L${r.line}: ${r.content}`);
            });
            console.log(`  HOOK CALLED AFTER RETURN at L${i+1}: ${line.trim()}\n`);
          }
        }
      }
    }
  }
});
