import os
import re

HOOK_NAMES = {'useState', 'useEffect', 'useMemo', 'useCallback', 'useContext', 'useRef', 'useReducer', 'useCRM', 'useSqaRecord', 'useSqaRecords'}

def scan_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.splitlines()
    violations = []

    # Simple stack of component blocks
    comp_name = None
    early_returns = []

    for idx, line in enumerate(lines):
        line_num = idx + 1
        stripped = line.strip()

        # Check for Component definition
        m = re.search(r'(?:export\s+)?(?:const|function)\s+([A-Z]\w+)', line)
        if m:
            comp_name = m.group(1)
            early_returns = []

        if not comp_name:
            continue

        indent = len(line) - len(line.lstrip())

        # Check if line is a component-level return (returning JSX or component fallback)
        # e.g., indent 2 or 4 spaces: `return (` or `return <` or `if (...) return`
        if indent <= 6:
            if (stripped.startswith('return ') or stripped.startswith('return(') or ('return' in stripped and 'if (' in stripped)) and not stripped.startswith('//'):
                # Check if it returns JSX or null
                if '<' in stripped or 'null' in stripped or 'Card' in stripped or 'div' in stripped or 'Loading' in stripped:
                    # Exclude functions returning string/boolean like helpers
                    if not re.search(r'return\s+(?:true|false|""|\'\'|0|1|[a-zA-Z0-9_\.]+\s*;)', stripped):
                        early_returns.append((line_num, stripped))

        # Check for hook call
        for hook in HOOK_NAMES:
            if re.search(rf'\b{hook}\b', stripped) and not stripped.startswith('//') and not stripped.startswith('*') and 'import' not in stripped:
                if early_returns:
                    violations.append({
                        'file': os.path.relpath(filepath),
                        'component': comp_name,
                        'returns': list(early_returns),
                        'hook_line': line_num,
                        'hook': hook,
                        'hook_code': stripped
                    })

    return violations

def main():
    root_dir = r"c:\Users\siona.thomas\Downloads\account_management_opportunity-tracker\frontend\src"
    all_violations = []
    
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if fname.endswith('.tsx'):
                fp = os.path.join(dirpath, fname)
                v = scan_file(fp)
                if v:
                    all_violations.extend(v)

    # Filter unique
    seen = set()
    print(f"Total violations found: {len(all_violations)}\n")
    for v in all_violations:
        key = (v['file'], v['component'], v['hook_line'])
        if key in seen:
            continue
        seen.add(key)
        print(f"File: {v['file']} | Component: {v['component']}")
        for r_line, r_code in v['returns']:
            print(f"  Return at L{r_line}: {r_code}")
        print(f"  ---> HOOK '{v['hook']}' at L{v['hook_line']}: {v['hook_code']}\n")

if __name__ == '__main__':
    main()
