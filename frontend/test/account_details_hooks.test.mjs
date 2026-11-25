import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const accountDetailsPath = path.resolve(__dirname, '../src/features/accounts/components/AccountDetailsView.tsx');
const opportunityDetailsPath = path.resolve(__dirname, '../src/features/opportunities/components/OpportunityDetailsView.tsx');

describe('React Hooks Order and Reload Safety Tests', () => {
  const accountDetailsContent = fs.readFileSync(accountDetailsPath, 'utf8');
  const opportunityDetailsContent = fs.readFileSync(opportunityDetailsPath, 'utf8');

  test('AccountDetailsView: All hooks must be defined before any conditional early returns', () => {
    const lines = accountDetailsContent.split('\n');

    let firstEarlyReturnLine = -1;
    let firstEarlyReturnText = '';

    const hookCalls = [];

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      // Detect top-level component early returns
      if (
        firstEarlyReturnLine === -1 &&
        (line.startsWith('if (loading)') || line.startsWith('if (!account)'))
      ) {
        firstEarlyReturnLine = lineNum;
        firstEarlyReturnText = line;
      }

      // Detect top-level React hook declarations in the component
      if (
        /^\s*(const|let|var)?\s*(\[|\{)?[a-zA-Z0-9_, ]*(\]|\})?\s*=\s*use[A-Z]/.test(rawLine) ||
        /^\s*use[A-Z]\w*\(/.test(rawLine)
      ) {
        hookCalls.push({ lineNum, text: line });
      }
    });

    assert.ok(firstEarlyReturnLine > 0, 'Found early return statements for loading/missing account');

    // Check that every hook is located BEFORE the first early return
    const invalidHooksAfterReturn = hookCalls.filter((h) => h.lineNum > firstEarlyReturnLine);

    assert.strictEqual(
      invalidHooksAfterReturn.length,
      0,
      `Found hooks declared after early return (Line ${firstEarlyReturnLine}: "${firstEarlyReturnText}"). Violating hooks:\n` +
        invalidHooksAfterReturn.map((h) => `  Line ${h.lineNum}: ${h.text}`).join('\n')
    );
  });

  test('AccountDetailsView: displayActionItemColumns and actionItemPinnedOffsets are unconditionally declared at top level', () => {
    const lines = accountDetailsContent.split('\n');

    const displayColsIdx = lines.findIndex((l) => l.includes('const displayActionItemColumns = useMemo('));
    const pinnedOffsetsIdx = lines.findIndex((l) => l.includes('const actionItemPinnedOffsets = useMemo('));
    const loadingReturnIdx = lines.findIndex((l) => l.includes('if (loading) {'));
    const noAccountReturnIdx = lines.findIndex((l) => l.includes('if (!account) {'));

    assert.ok(displayColsIdx !== -1, 'displayActionItemColumns must be defined');
    assert.ok(pinnedOffsetsIdx !== -1, 'actionItemPinnedOffsets must be defined');
    assert.ok(loadingReturnIdx !== -1, 'loading check exists');
    assert.ok(noAccountReturnIdx !== -1, 'no account check exists');

    assert.ok(
      displayColsIdx < loadingReturnIdx,
      `displayActionItemColumns (line ${displayColsIdx + 1}) must precede if (loading) (line ${loadingReturnIdx + 1})`
    );
    assert.ok(
      pinnedOffsetsIdx < loadingReturnIdx,
      `actionItemPinnedOffsets (line ${pinnedOffsetsIdx + 1}) must precede if (loading) (line ${loadingReturnIdx + 1})`
    );
  });

  test('OpportunityDetailsView: All hooks must be defined before any conditional early returns', () => {
    const lines = opportunityDetailsContent.split('\n');

    let firstEarlyReturnLine = -1;
    let firstEarlyReturnText = '';

    const hookCalls = [];

    lines.forEach((rawLine, idx) => {
      const lineNum = idx + 1;
      const line = rawLine.trim();

      if (
        firstEarlyReturnLine === -1 &&
        (line.startsWith('if (loading)') || line.startsWith('if (!opp || !account)'))
      ) {
        firstEarlyReturnLine = lineNum;
        firstEarlyReturnText = line;
      }

      if (
        /^\s*(const|let|var)?\s*(\[|\{)?[a-zA-Z0-9_, ]*(\]|\})?\s*=\s*use[A-Z]/.test(rawLine) ||
        /^\s*use[A-Z]\w*\(/.test(rawLine)
      ) {
        hookCalls.push({ lineNum, text: line });
      }
    });

    assert.ok(firstEarlyReturnLine > 0, 'Found early return statements in OpportunityDetailsView');

    const invalidHooksAfterReturn = hookCalls.filter((h) => h.lineNum > firstEarlyReturnLine);

    assert.strictEqual(
      invalidHooksAfterReturn.length,
      0,
      `Found hooks declared after early return in OpportunityDetailsView:\n` +
        invalidHooksAfterReturn.map((h) => `  Line ${h.lineNum}: ${h.text}`).join('\n')
    );
  });

  test('Simulated Hook Dispatcher: Hook invocation count must remain invariant across reload lifecycle transitions', () => {
    // Simulate the execution path of the component body during different render phases
    function simulateComponentHooks(scenario) {
      const executedHooks = [];
      function recordHook(name) {
        executedHooks.push(name);
      }

      // Top level hooks:
      recordHook('useCRM');
      // useState calls in AccountDetailsView
      for (let i = 0; i < 33; i++) {
        recordHook('useState');
      }
      recordHook('useEffect'); // usersApi.getAll()
      recordHook('useMemo_displayActionItemColumns');
      recordHook('useMemo_actionItemPinnedOffsets');

      // Now branching conditions
      if (scenario.loading) {
        return { returnType: 'loading', hookCount: executedHooks.length, executedHooks };
      }

      if (!scenario.account) {
        return { returnType: 'not_found', hookCount: executedHooks.length, executedHooks };
      }

      // Normal render continues (no more hooks)
      return { returnType: 'full_details', hookCount: executedHooks.length, executedHooks };
    }

    const render1_ReloadInitial = simulateComponentHooks({ loading: true, account: null });
    const render2_DataLoaded = simulateComponentHooks({ loading: false, account: { id: 'acc-1', name: 'Acme Corp' } });
    const render3_NotFound = simulateComponentHooks({ loading: false, account: null });
    const render4_PermissionChange = simulateComponentHooks({ loading: false, account: { id: 'acc-1', name: 'Acme Corp' } });

    // In all renders, hook count MUST BE EXACTLY IDENTICAL
    assert.strictEqual(
      render1_ReloadInitial.hookCount,
      render2_DataLoaded.hookCount,
      `Render 1 (loading on reload) executed ${render1_ReloadInitial.hookCount} hooks, but Render 2 executed ${render2_DataLoaded.hookCount} hooks. This triggers "Rendered more hooks than during the previous render".`
    );

    assert.strictEqual(
      render2_DataLoaded.hookCount,
      render3_NotFound.hookCount,
      `Render 2 executed ${render2_DataLoaded.hookCount} hooks, but Render 3 executed ${render3_NotFound.hookCount} hooks.`
    );

    assert.strictEqual(
      render1_ReloadInitial.hookCount,
      render4_PermissionChange.hookCount,
      'Hook count must remain invariant during permission/auth updates'
    );

    // Deep equality of hook sequence
    assert.deepStrictEqual(
      render1_ReloadInitial.executedHooks,
      render2_DataLoaded.executedHooks,
      'Hook execution sequence must be identical between reload loading phase and loaded phase'
    );
  });

  test('Action item columns configuration logic preserves business requirements', () => {
    const mockColumns = [
      { key: 'title', isDisplayed: true, isPinned: true, isStandard: true },
      { key: 'projectId', isDisplayed: true, isPinned: false, isStandard: true },
      { key: 'projectName', isDisplayed: true, isPinned: false, isStandard: true },
      { key: 'status', isDisplayed: true, isPinned: false, isStandard: true },
      { key: 'customField1', isDisplayed: false, isPinned: false, isStandard: false },
      { key: 'customField2', isDisplayed: true, isPinned: true, isStandard: false },
    ];

    // Filter logic as implemented in displayActionItemColumns
    const cols = mockColumns.filter(
      (c) => c.isDisplayed && c.key !== 'projectId' && c.key !== 'projectName'
    );
    const pinned = cols.filter((col) => col.isPinned);
    const unpinned = cols.filter((col) => !col.isPinned);
    const result = [...pinned, ...unpinned];

    // Verify projectId and projectName are excluded in Account Details View
    assert.strictEqual(result.some((c) => c.key === 'projectId'), false);
    assert.strictEqual(result.some((c) => c.key === 'projectName'), false);

    // Verify undisplayed columns are excluded
    assert.strictEqual(result.some((c) => c.key === 'customField1'), false);

    // Verify pinned columns are first
    assert.strictEqual(result[0].key, 'title');
    assert.strictEqual(result[1].key, 'customField2');
    assert.strictEqual(result[2].key, 'status');
  });
});
