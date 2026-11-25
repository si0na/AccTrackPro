import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moduleConfigsPath = path.resolve(__dirname, '../src/features/import-export/moduleConfigs.ts');
const workbookExportPath = path.resolve(__dirname, '../src/features/import-export/workbookExport.ts');
const typesPath = path.resolve(__dirname, '../src/features/import-export/types.ts');
const exportDialogPath = path.resolve(__dirname, '../src/features/import-export/ExportDialog.tsx');
const launcherPath = path.resolve(__dirname, '../src/features/import-export/ImportExportLauncher.tsx');

describe('Projects and Project Action Items Export/Import Frontend Configuration', () => {
  const moduleConfigsContent = fs.readFileSync(moduleConfigsPath, 'utf8');
  const workbookExportContent = fs.readFileSync(workbookExportPath, 'utf8');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const exportDialogContent = fs.readFileSync(exportDialogPath, 'utf8');
  const launcherContent = fs.readFileSync(launcherPath, 'utf8');

  test('MODULE_ORDER includes projects and projectActionItems in dependency order', () => {
    assert.match(typesContent, /'projects'/);
    assert.match(typesContent, /'actionItems'/);
    assert.match(typesContent, /'projectActionItems'/);
    assert.match(
      typesContent,
      /'accounts'[\s\S]*?'stakeholders'[\s\S]*?'opportunities'[\s\S]*?'projects'[\s\S]*?'actionItems'[\s\S]*?'projectActionItems'/,
    );
  });

  test('SHEET_NAMES includes Projects and Project Action Items worksheet names', () => {
    assert.match(typesContent, /projects:\s*'Projects'/);
    assert.match(typesContent, /projectActionItems:\s*'Project Action Items'/);
  });

  test('moduleConfigs defines projectsConfig and projectActionItemsConfig and registers them in IE_CONFIGS', () => {
    assert.match(moduleConfigsContent, /const\s+projectsConfig:\s*ModuleIEConfig\s*=/);
    assert.match(moduleConfigsContent, /const\s+projectActionItemsConfig:\s*ModuleIEConfig\s*=/);
    assert.match(moduleConfigsContent, /projects:\s*projectsConfig/);
    assert.match(moduleConfigsContent, /projectActionItems:\s*projectActionItemsConfig/);
  });

  test('projectsConfig defines mandatory fields and exportColumns with Created Date and Last Modified Date', () => {
    assert.match(moduleConfigsContent, /key:\s*'name',\s*header:\s*'Project Name'/);
    assert.match(moduleConfigsContent, /key:\s*'accountId',\s*header:\s*'Account'/);
    assert.match(moduleConfigsContent, /key:\s*'createdAt',\s*header:\s*'Created Date'/);
    assert.match(moduleConfigsContent, /key:\s*'updatedAt',\s*header:\s*'Last Modified Date'/);
  });

  test('actionItemsConfig does NOT contain projectId, while projectActionItemsConfig requires Project', () => {
    // Isolate actionItemsConfig block
    const actionItemsBlockMatch = moduleConfigsContent.match(/const\s+actionItemsConfig:\s*ModuleIEConfig\s*=[\s\S]*?fields:\s*\[([\s\S]*?)\]/);
    assert.ok(actionItemsBlockMatch, 'actionItemsConfig fields block found');
    assert.doesNotMatch(actionItemsBlockMatch[1], /key:\s*'projectId'/);

    // projectActionItemsConfig has Project field
    assert.match(moduleConfigsContent, /const\s+projectActionItemsConfig[\s\S]*?key:\s*'projectId',\s*header:\s*'Project'/);
    // both have Created Date and Last Modified Date
    assert.match(moduleConfigsContent, /key:\s*'createdAt',\s*header:\s*'Created Date'/);
    assert.match(moduleConfigsContent, /key:\s*'updatedAt',\s*header:\s*'Last Modified Date'/);
  });

  test('workbookExport routes regular action items and project action items to separate sheets', () => {
    // Verifies regular action items filtered to !r.projectId
    assert.match(workbookExportContent, /!r\.projectId/);
    // Verifies project action items filtered to !!r.projectId
    assert.match(workbookExportContent, /!!r\.projectId/);
    assert.match(workbookExportContent, /projectActionItems/);
  });

  test('ExportDialog includes projects and projectActionItems in default export selection', () => {
    assert.match(exportDialogContent, /projects:\s*true/);
    assert.match(exportDialogContent, /projectActionItems:\s*true/);
  });

  test('ImportExportLauncher configures projects and projectActionItems in rowsFor, columnsFor, and counts', () => {
    assert.match(launcherContent, /projects:\s*activeExportRows\.projects\s*\?\?\s*defaultProjects/);
    assert.match(launcherContent, /projectActionItems:\s*\(activeExportRows\.projectActionItems\s*\?\?\s*defaultProjectActionItems\)/);
    assert.match(launcherContent, /projects:\s*projectsColumnConfig/);
    assert.match(launcherContent, /projectActionItems:\s*actionItemsColumnConfig/);
    assert.match(launcherContent, /projects:\s*rowsFor\.projects\.length/);
    assert.match(launcherContent, /projectActionItems:\s*rowsFor\.projectActionItems\.length/);
  });
});
