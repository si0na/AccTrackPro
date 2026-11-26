import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const typesPath = path.resolve(__dirname, '../src/types/index.ts');
const apiPath = path.resolve(__dirname, '../src/api/crm.api.ts');
const tabComponentPath = path.resolve(__dirname, '../src/features/projects/components/ProjectDocumentationTab.tsx');
const modalComponentPath = path.resolve(__dirname, '../src/features/projects/components/ProjectDocumentationModal.tsx');
const projectDetailsPath = path.resolve(__dirname, '../src/features/projects/components/ProjectDetailsView.tsx');
const migrationPath = path.resolve(__dirname, '../../backend/src/database/migrations/117_project_documentation.sql');
const backendServicePath = path.resolve(__dirname, '../../backend/src/modules/projects/project-documentation.service.ts');
const backendControllerPath = path.resolve(__dirname, '../../backend/src/modules/projects/project-documentation.controller.ts');

describe('Project Documentation Feature Integration', () => {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const apiContent = fs.readFileSync(apiPath, 'utf8');
  const tabContent = fs.readFileSync(tabComponentPath, 'utf8');
  const modalContent = fs.readFileSync(modalComponentPath, 'utf8');
  const detailsContent = fs.readFileSync(projectDetailsPath, 'utf8');
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  const backendServiceContent = fs.readFileSync(backendServicePath, 'utf8');
  const backendControllerContent = fs.readFileSync(backendControllerPath, 'utf8');

  test('Database migration defines project_documentation table correctly', () => {
    assert.match(migrationContent, /CREATE TABLE IF NOT EXISTS project_documentation/);
    assert.match(migrationContent, /project_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+projects\(id\)\s+ON DELETE CASCADE/);
    assert.match(migrationContent, /name\s+TEXT\s+NOT NULL/);
    assert.match(migrationContent, /type\s+TEXT\s+NOT NULL\s+CHECK\s*\(type\s+IN\s*\('URL',\s*'FILE'\)\)/);
    assert.match(migrationContent, /url\s+TEXT/);
    assert.match(migrationContent, /file_name\s+TEXT/);
    assert.match(migrationContent, /file_path\s+TEXT/);
    assert.match(migrationContent, /created_by_id\s+TEXT\s+REFERENCES\s+users\(id\)/);
    assert.match(migrationContent, /created_at\s+TIMESTAMPTZ/);
    assert.match(migrationContent, /updated_at\s+TIMESTAMPTZ/);
  });

  test('Frontend types export ProjectDocumentation and ProjectDocumentationType', () => {
    assert.match(typesContent, /export type ProjectDocumentationType = 'URL' | 'FILE'/);
    assert.match(typesContent, /export interface ProjectDocumentation/);
    assert.match(typesContent, /projectId:\s*string/);
    assert.match(typesContent, /name:\s*string/);
    assert.match(typesContent, /type:\s*ProjectDocumentationType/);
    assert.match(typesContent, /createdAt:\s*string/);
    assert.match(typesContent, /updatedAt:\s*string/);
  });

  test('Frontend api exports projectDocumentationApi with required operations', () => {
    assert.match(apiContent, /export const projectDocumentationApi\s*=/);
    assert.match(apiContent, /getAllForProject:\s*\(projectId:\s*string\)/);
    assert.match(apiContent, /createUrl:\s*\(projectId:\s*string/);
    assert.match(apiContent, /uploadFile:\s*\(projectId:\s*string/);
    assert.match(apiContent, /update:\s*\(\s*projectId:\s*string/);
    assert.match(apiContent, /delete:\s*\(projectId:\s*string/);
    assert.match(apiContent, /getFileBlob:\s*\(projectId:\s*string/);
  });

  test('ProjectDetailsView integrates Project Documentation tab and count', () => {
    assert.match(detailsContent, /'documentation'/);
    assert.match(detailsContent, /id:\s*'documentation',\s*label:\s*'Project Documentation'/);
    assert.match(detailsContent, /<ProjectDocumentationTab/);
    assert.match(detailsContent, /projectId=\{project\.id\}/);
  });

  test('ProjectDocumentationTab displays all required columns and actions', () => {
    assert.match(tabContent, /Document Name/);
    assert.match(tabContent, /Document Type/);
    assert.match(tabContent, /URL or File Name/);
    assert.match(tabContent, /Added By/);
    assert.match(tabContent, /Created Date/);
    assert.match(tabContent, /Last Modified Date/);
    assert.match(tabContent, /Actions/);
    assert.match(tabContent, /formatDateTime\(doc\.createdAt\)/);
    assert.match(tabContent, /formatDateTime\(doc\.updatedAt\)/);
    assert.match(tabContent, /handleDownload/);
    assert.match(tabContent, /handleView/);
    assert.match(tabContent, /ConfirmDialog/);
  });

  test('ProjectDocumentationModal supports Option A (Add URL) and Option B (Upload File)', () => {
    assert.match(modalContent, /Option A – Add URL/);
    assert.match(modalContent, /Option B – Upload File/);
    assert.match(modalContent, /Document Name/);
    assert.match(modalContent, /Document URL/);
    assert.match(modalContent, /Upload File/);
    assert.match(modalContent, /Replace File/);
  });

  test('Backend service and controller enforce project access and security', () => {
    assert.match(backendServiceContent, /asserts? project access|projectsService\.findOne/i);
    assert.match(backendServiceContent, /matchesDeclaredMimeType/);
    assert.match(backendServiceContent, /resolveMimeType/);
    assert.match(backendControllerContent, /@RequirePermission\('projects',\s*'view'\)/);
    assert.match(backendControllerContent, /@RequirePermission\('projects',\s*'create'\)/);
    assert.match(backendControllerContent, /@RequirePermission\('projects',\s*'update'\)/);
    assert.match(backendControllerContent, /@RequirePermission\('projects',\s*'delete'\)/);
  });
});
