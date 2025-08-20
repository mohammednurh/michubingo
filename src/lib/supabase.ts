import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Real-time channel for game updates
export const createGameChannel = (gameId: string) => {
  return supabase.channel(`game-${gameId}`, {
    config: {
      presence: { key: gameId },
      broadcast: { self: true },
    },
  });
};

// Database types
export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'cashier_admin' | 'cashier';
  is_enabled: boolean;
  subscription_months: number;
  subscription_price_birr: number;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  host_id: string;
  title: string;
  number_range: number;
  selected_cards: number[];
  patterns: string[];
  betting_amount_birr: number;
  caller_mode: 'manual' | 'automatic';
  auto_interval_seconds: number;
  caller_voice_enabled: boolean;
  caller_voice_type: string;
  last_calls_display: number;
  status: 'setup' | 'active' | 'paused' | 'ended';
  call_sequence: GameCall[];
  winners: any[];
  created_at: string;
  started_at?: string;
  ended_at?: string;
}

export interface GameCall {
  number: number;
  letter: string;
  call_order: number;
  called_at: string;
}

export interface GamePattern {
  id: string;
  name: string;
  description: string;
  pattern: boolean[][];
  is_default: boolean;
}

export interface CardTemplate {
  id: number;
  card_id: string;
  numbers: number[][];
  locked?: boolean;   // add this
  created_at: string;
}

export interface PlayerSession {
  id: string;
  game_id: string;
  session_token: string;
  selected_cards: number[];
  is_locked: boolean;
  created_at: string;
}

export interface BingoClaim {
  id: string;
  game_id: string;
  player_session_id?: string;
  card_id: number;
  pattern_id: string;
  marked_numbers: number[];
  claim_timestamp: string;
  validation_result?: 'pending' | 'valid' | 'invalid';
  validated_at?: string;
  validated_by?: string;
}