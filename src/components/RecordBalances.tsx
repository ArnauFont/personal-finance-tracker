'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { useCurrency } from '@/context/CurrencyContext';
import { BankStatementUpload } from './BankStatementUpload';

interface BalanceInput {
  accountId: string;
  amount: string;
}

export const RecordBalances = () => {
  const { accounts, balances, getAccountsWithBalances, updateMultipleBalances } = useFinance();
  const { formatCurrency } = useCurrency();
  const [balanceInputs, setBalanceInputs] = useState<BalanceInput[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize balance inputs when accounts change
  useEffect(() => {
    const accountsWithBalances = getAccountsWithBalances();
    setBalanceInputs(
      accountsWithBalances.map(account => ({
        accountId: account.id,
        amount: account.currentBalance.toString(),
      }))
    );
  }, [accounts, getAccountsWithBalances]);

  const handleAmountChange = (accountId: string, value: string) => {
    // Allow empty string, numbers, and decimal points
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      setBalanceInputs(prev =>
        prev.map(input =>
          input.accountId === accountId ? { ...input, amount: value } : input
        )
      );
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updates = balanceInputs
        .filter(input => input.amount.trim() !== '')
        .map(input => ({
          accountId: input.accountId,
          amount: parseFloat(input.amount) || 0,
        }));

      if (updates.length > 0) {
        const balanceDate = new Date(selectedDate);
        const targetDateString = balanceDate.toISOString().split('T')[0];
        const hasExistingBalances = balances.some(
          balance => balance.date.toISOString().split('T')[0] === targetDateString
        );

        if (hasExistingBalances) {
          const confirmReplace = window.confirm(
            'Balances already exist for this date. Do you want to replace them?'
          );

          if (!confirmReplace) {
            return;
          }

          updateMultipleBalances(updates, balanceDate, true);
        } else {
          updateMultipleBalances(updates, balanceDate);
        }

        setSuccessMessage(
          `Successfully updated ${updates.length} account balance${updates.length > 1 ? 's' : ''} for ${balanceDate.toLocaleDateString()}`
        );
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error updating balances:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedAccounts = getAccountsWithBalances().reduce((groups, account) => {
    if (!groups[account.type]) {
      groups[account.type] = {};
    }
    if (!groups[account.type][account.category]) {
      groups[account.type][account.category] = [];
    }
    groups[account.type][account.category].push(account);
    return groups;
  }, {} as Record<string, Record<string, { id: string; name: string; type: string; category: string; currentBalance: number }[]>>);

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-neutral-400 text-lg mb-4">No accounts to update</div>
        <p className="text-gray-400 dark:text-neutral-500">Add some accounts first to record their balances.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg dark:shadow-neutral-900/50 p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-neutral-100 mb-2">Record Account Balances</h1>
          <p className="text-gray-600 dark:text-neutral-400">Update the current balances for your accounts</p>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md">
            {successMessage}
          </div>
        )}

        <div className="mb-6">
          <label htmlFor="balance-date" className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">
            Balance Date
          </label>
          <input
            type="date"
            id="balance-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100"
          />
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Record balances for this specific date. Defaults to today.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {Object.entries(groupedAccounts).map(([type, categories]) => (
            <div key={type} className="border dark:border-neutral-600 rounded-lg p-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-neutral-100 mb-4 capitalize">
                {type === 'asset' ? 'Assets' : type === 'liability' ? 'Liabilities' : 'Equity'}
              </h2>

              {Object.entries(categories).map(([category, categoryAccounts]) => (
                <div key={category} className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-neutral-300 mb-3">{category}</h3>
                  <div className="space-y-3">
                    {categoryAccounts.map((account) => {
                      const input = balanceInputs.find(input => input.accountId === account.id);
                      const currentBalance = account.currentBalance;

                      return (
                        <div key={account.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-700/50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-800 dark:text-neutral-200">{account.name}</div>
                            <div className="text-sm text-gray-500 dark:text-neutral-400">
                              Current: {formatCurrency(currentBalance)}
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <label htmlFor={`balance-${account.id}`} className="text-sm font-medium text-gray-700 dark:text-neutral-300">
                              New Balance:
                            </label>
                            <input
                              type="text"
                              id={`balance-${account.id}`}
                              value={input?.amount || ''}
                              onChange={(e) => handleAmountChange(account.id, e.target.value)}
                              className="w-32 px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right bg-white dark:bg-neutral-700 text-gray-900 dark:text-neutral-100"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="flex justify-center pt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Updating...' : 'Update All Balances'}
            </button>
          </div>
        </form>
      </div>

      <BankStatementUpload />
    </div>
  );
};
