import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Settings = {
  minBettingAmount: number; // birr
  commissionRate: number;   // 0.2 means 20%
};

const DEFAULT_SETTINGS: Settings = {
  minBettingAmount: 10,
  commissionRate: 0.15,
};

interface SettingsContextValue extends Settings {
  loading: boolean;
  refresh: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

// DB ↔ TS mapping
const KEY_MAP: Record<keyof Settings, string> = {
  minBettingAmount: 'min_betting_amount',
  commissionRate: 'commission_rate',
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Load settings from DB
  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value');

      if (error) throw error;

      const map = new Map<string, any>();
      (data || []).forEach((row: any) => map.set(row.key, row.value));

      const next: Settings = {
        minBettingAmount: Number(map.get(KEY_MAP.minBettingAmount)) || DEFAULT_SETTINGS.minBettingAmount,
        commissionRate: map.has(KEY_MAP.commissionRate)
          ? Number(map.get(KEY_MAP.commissionRate))
          : DEFAULT_SETTINGS.commissionRate,
      };

      setSettings(next);
    } catch (e) {
      console.error('Failed to load settings:', e);
      setSettings(DEFAULT_SETTINGS); // fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Update settings in DB
  const update = async (partial: Partial<Settings>) => {
    const next = { ...settings, ...partial };

    const upserts = Object.entries(partial).map(([k, v]) => ({
      key: KEY_MAP[k as keyof Settings],
      value: v,
    }));

    const { error } = await supabase
      .from('system_settings')
      .upsert(upserts, { onConflict: 'key' });

    if (error) throw error;

    setSettings(next);
  };

  const ctx: SettingsContextValue = useMemo(
    () => ({
      ...settings,
      loading,
      refresh: load,
      update,
    }),
    [settings, loading]
  );

  return (
    <SettingsContext.Provider value={ctx}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
