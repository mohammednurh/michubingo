import React, { useState, useEffect } from 'react';
import { Save, Percent, Coins } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';

const AdminSettings: React.FC = () => {
  const { commissionRate, minBettingAmount, loading, update, refresh } = useSettings();
  const [localCommission, setLocalCommission] = useState<number>(commissionRate);
  const [localMinBet, setLocalMinBet] = useState<number>(minBettingAmount);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setLocalCommission(commissionRate);
      setLocalMinBet(minBettingAmount);
    }
  }, [commissionRate, minBettingAmount, loading]);

  const onSave = async () => {
    setSaving(true);
    try {
      await update({ commissionRate: localCommission, minBettingAmount: localMinBet });
      await refresh();
      alert('Settings saved successfully');
    } catch (e) {
      console.error(e);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Commission Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Percent className="text-indigo-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Commission Rate</h2>
          </div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-2">
            Percentage (e.g., 20 for 20%)
          </label>
          <input
            type="number"
            value={Math.round(localCommission * 100)}
            onChange={(e) => {
              const val = Math.max(0, Math.min(100, parseFloat(e.target.value || '0')));
              setLocalCommission(isNaN(val) ? 0 : val / 100);
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Current: {(localCommission * 100).toFixed(1)}%</p>
        </div>

        {/* Minimum Betting Amount */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Coins className="text-amber-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Minimum Betting Amount</h2>
          </div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-2">
            Amount in Birr
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={localMinBet}
            onChange={(e) => setLocalMinBet(Math.max(0, parseInt(e.target.value || '0')))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Current: {localMinBet} Birr</p>
        </div>
      </div>

      <div>
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={18} />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
