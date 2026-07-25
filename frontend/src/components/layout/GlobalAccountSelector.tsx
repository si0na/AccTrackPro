/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { SearchableSelect } from '@/components/ui';

const ALL_ACCOUNTS_LABEL = 'All Accounts';

/**
 * Global, app-wide Account scope selector shown in the header. Selecting an
 * account narrows every module (Dashboard, Accounts, Opportunities,
 * Stakeholders, Action Items, Reports) to that account; "All Accounts"
 * restores the user's full permitted dataset. Account names are unique per
 * user (see migration 020), so mapping the picked label back to an id is
 * unambiguous.
 */
export const GlobalAccountSelector: React.FC = () => {
  const { accounts, globalAccountId, setGlobalAccountId } = useCRM();

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  );
  const options = useMemo(
    () => [ALL_ACCOUNTS_LABEL, ...sortedAccounts.map(a => a.name)],
    [sortedAccounts],
  );

  const selectedName = globalAccountId === 'All'
    ? ALL_ACCOUNTS_LABEL
    : accounts.find(a => a.id === globalAccountId)?.name ?? ALL_ACCOUNTS_LABEL;

  const handleChange = (name: string) => {
    if (name === ALL_ACCOUNTS_LABEL) {
      setGlobalAccountId('All');
      return;
    }
    const match = sortedAccounts.find(a => a.name === name);
    setGlobalAccountId(match ? match.id : 'All');
  };

  return (
    <div className="flex items-center gap-2 w-64 shrink-0">
      <Building2 className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
      <SearchableSelect
        value={selectedName}
        onChange={handleChange}
        options={options}
        required
        placeholder="Search accounts…"
        aria-label="Global account scope"
        className="w-full"
      />
    </div>
  );
};
