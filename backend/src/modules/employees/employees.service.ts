import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface LocalEmployeeDirectoryItem {
  id: string;
  displayName: string;
  givenName: string | null;
  surname: string | null;
  mail: string | null;
  userPrincipalName: string;
  localEmployeeId?: string | null;
  department?: string | null;
  designation?: string | null;
  role?: string | null;
  source: 'local_fallback';
}

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Returns all active employees from the local ReflectOne database (employee_master + users).
   * Serves as a resilient fallback when Microsoft Graph is offline or unauthenticated.
   */
  async getLocalEmployeeDirectory(search?: string): Promise<LocalEmployeeDirectoryItem[]> {
    try {
      // 1. Fetch active registered users
      const usersRes = await this.db.query(
        `SELECT id, name, email, role, department, designation
         FROM users
         WHERE is_deleted = FALSE AND is_active = TRUE
         ORDER BY name ASC`,
      );

      // 2. Fetch employee_master whitelist
      const empMasterRes = await this.db.query(
        `SELECT id, employee_id, name, email, designation, department
         FROM employee_master
         WHERE is_deleted = FALSE
         ORDER BY name ASC`,
      );

      const mapByEmail = new Map<string, LocalEmployeeDirectoryItem>();
      const list: LocalEmployeeDirectoryItem[] = [];

      const parseNameParts = (fullName: string) => {
        const parts = (fullName || '').trim().split(/\s+/);
        if (parts.length === 0 || !parts[0]) return { givenName: null, surname: null };
        if (parts.length === 1) return { givenName: parts[0], surname: null };
        return { givenName: parts[0], surname: parts.slice(1).join(' ') };
      };

      // Ingest employee_master entries first
      for (const row of empMasterRes.rows) {
        const email = (row.email || '').trim().toLowerCase();
        const name = (row.name || email).trim();
        const { givenName, surname } = parseNameParts(name);

        const item: LocalEmployeeDirectoryItem = {
          id: row.id,
          displayName: name,
          givenName,
          surname,
          mail: email || null,
          userPrincipalName: email,
          localEmployeeId: row.id,
          department: row.department || null,
          designation: row.designation || null,
          source: 'local_fallback',
        };

        if (email) {
          mapByEmail.set(email, item);
        }
        list.push(item);
      }

      // Merge / append registered system users
      for (const row of usersRes.rows) {
        const email = (row.email || '').trim().toLowerCase();
        const name = (row.name || email).trim();
        const { givenName, surname } = parseNameParts(name);

        if (email && mapByEmail.has(email)) {
          // Link existing employee_master item with user id & role
          const existing = mapByEmail.get(email)!;
          existing.id = row.id; // prefer user ID for stable lookup
          existing.role = row.role || null;
          if (!existing.department && row.department) existing.department = row.department;
          if (!existing.designation && row.designation) existing.designation = row.designation;
        } else {
          const item: LocalEmployeeDirectoryItem = {
            id: row.id,
            displayName: name,
            givenName,
            surname,
            mail: email || null,
            userPrincipalName: email,
            localEmployeeId: row.id,
            department: row.department || null,
            designation: row.designation || null,
            role: row.role || null,
            source: 'local_fallback',
          };
          if (email) mapByEmail.set(email, item);
          list.push(item);
        }
      }

      // Filter by search query if provided
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        return list.filter(
          (emp) =>
            emp.displayName.toLowerCase().includes(q) ||
            (emp.mail && emp.mail.toLowerCase().includes(q)) ||
            emp.userPrincipalName.toLowerCase().includes(q) ||
            (emp.department && emp.department.toLowerCase().includes(q)) ||
            (emp.designation && emp.designation.toLowerCase().includes(q)),
        );
      }

      return list.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    } catch (err: any) {
      this.logger.error(`Failed to retrieve local employee directory fallback: ${err.message}`, err.stack);
      return [];
    }
  }
}
