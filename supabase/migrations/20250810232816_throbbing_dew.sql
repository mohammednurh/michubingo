-- Enable RLS and required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for authentication and roles
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email text UNIQUE NOT NULL,
    username text UNIQUE NOT NULL,
    full_name text NOT NULL,
    role text NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin', 'cashier')),
    is_enabled boolean DEFAULT true,
    subscription_months integer DEFAULT 0,
    subscription_price_birr decimal(10,2) DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Card templates (1-200 cards)
CREATE TABLE IF NOT EXISTS card_templates (
    id integer PRIMARY KEY,
    card_id text UNIQUE NOT NULL, -- card_1, card_2, etc.
    numbers integer[][] NOT NULL, -- 5x5 grid of numbers
    created_at timestamptz DEFAULT now()
);

-- Game patterns
CREATE TABLE IF NOT EXISTS game_patterns (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    pattern boolean[][] NOT NULL, -- 5x5 grid of true/false
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Games
CREATE TABLE IF NOT EXISTS games (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id uuid NOT NULL REFERENCES users(id),
    title text NOT NULL,
    number_range integer NOT NULL DEFAULT 75 CHECK (number_range IN (75, 90, 100, 200)),
    selected_cards integer[] NOT NULL,
    patterns uuid[] NOT NULL,
    betting_amount_birr decimal(10,2) NOT NULL,
    caller_mode text NOT NULL DEFAULT 'manual' CHECK (caller_mode IN ('manual', 'automatic')),
    auto_interval_seconds integer DEFAULT 3,
    caller_voice_enabled boolean DEFAULT true,
    caller_voice_type text DEFAULT 'female',
    last_calls_display integer DEFAULT 5,
    status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'paused', 'ended')),
    call_sequence jsonb DEFAULT '[]'::jsonb,
    winners jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    started_at timestamptz,
    ended_at timestamptz
);

-- Game calls
CREATE TABLE IF NOT EXISTS game_calls (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    number integer NOT NULL,
    letter text NOT NULL,
    call_order integer NOT NULL,
    called_at timestamptz DEFAULT now()
);

-- Player sessions (for tracking players without auth)
CREATE TABLE IF NOT EXISTS player_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    session_token text UNIQUE NOT NULL,
    selected_cards integer[] NOT NULL,
    is_locked boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Bingo claims
CREATE TABLE IF NOT EXISTS bingo_claims (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_session_id uuid REFERENCES player_sessions(id),
    card_id integer NOT NULL,
    pattern_id uuid NOT NULL REFERENCES game_patterns(id),
    marked_numbers integer[] NOT NULL,
    claim_timestamp timestamptz DEFAULT now(),
    validation_result text CHECK (validation_result IN ('pending', 'valid', 'invalid')),
    validated_at timestamptz,
    validated_by uuid REFERENCES users(id)
);

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    key text UNIQUE NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage users" ON users FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (id = auth.uid());

-- Games policies
CREATE POLICY "Anyone can read active games" ON games FOR SELECT USING (status IN ('active', 'paused'));
CREATE POLICY "Cashiers can manage their games" ON games FOR ALL TO authenticated USING (host_id = auth.uid());
CREATE POLICY "Admins can read all games" ON games FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Game calls policies
CREATE POLICY "Anyone can read game calls" ON game_calls FOR SELECT USING (true);
CREATE POLICY "Hosts can manage game calls" ON game_calls FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM games WHERE id = game_calls.game_id AND host_id = auth.uid()
    )
);

-- Player sessions policies
CREATE POLICY "Anyone can manage player sessions" ON player_sessions FOR ALL USING (true);

-- Bingo claims policies
CREATE POLICY "Anyone can read bingo claims" ON bingo_claims FOR SELECT USING (true);
CREATE POLICY "Anyone can insert bingo claims" ON bingo_claims FOR INSERT WITH CHECK (true);
CREATE POLICY "Hosts can validate claims" ON bingo_claims FOR UPDATE TO authenticated USING (
    EXISTS (
        SELECT 1 FROM games WHERE id = bingo_claims.game_id AND host_id = auth.uid()
    )
);

-- Card templates policies
CREATE POLICY "Anyone can read card templates" ON card_templates FOR SELECT USING (true);
CREATE POLICY "Admins can manage card templates" ON card_templates FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Game patterns policies
CREATE POLICY "Anyone can read game patterns" ON game_patterns FOR SELECT USING (true);
CREATE POLICY "Admins can manage game patterns" ON game_patterns FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
);

-- System settings policies
CREATE POLICY "Admins can manage system settings" ON system_settings FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_host_id ON games(host_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_game_calls_game_id ON game_calls(game_id);
CREATE INDEX IF NOT EXISTS idx_game_calls_call_order ON game_calls(game_id, call_order);
CREATE INDEX IF NOT EXISTS idx_player_sessions_game_id ON player_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_claims_game_id ON bingo_claims(game_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default patterns
INSERT INTO game_patterns (name, description, pattern, is_default) VALUES
('Any 1 Line', 'Complete any horizontal, vertical, or diagonal line', 
 '{{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false}}'::boolean[][], 
 true),
('Any 2 Lines', 'Complete any two lines', 
 '{{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false}}'::boolean[][], 
 true),
('Full House', 'Mark all numbers on the card', 
 '{{true,true,true,true,true},{true,true,true,true,true},{true,true,false,true,true},{true,true,true,true,true},{true,true,true,true,true}}'::boolean[][], 
 true),
('Four Corners', 'Mark all four corner numbers', 
 '{{true,false,false,false,true},{false,false,false,false,false},{false,false,false,false,false},{false,false,false,false,false},{true,false,false,false,true}}'::boolean[][], 
 true),
('Cross Pattern', 'Complete a cross shape', 
 '{{false,false,true,false,false},{false,false,true,false,false},{true,true,true,true,true},{false,false,true,false,false},{false,false,true,false,false}}'::boolean[][], 
 true);

-- Insert system settings
INSERT INTO system_settings (key, value) VALUES
('min_betting_amount', '10'),
('default_caller_voice', '"female"'),
('max_cards_per_game', '200'),
('supported_number_ranges', '[75, 90, 100, 200]');

-- Generate card templates (sample cards)
DO $$
DECLARE
    card_num INTEGER;
    numbers INTEGER[][];
    b_nums INTEGER[];
    i_nums INTEGER[];
    n_nums INTEGER[];
    g_nums INTEGER[];
    o_nums INTEGER[];
    temp_array INTEGER[];
BEGIN
    FOR card_num IN 1..50 LOOP
        -- Generate B column (1-15)
        temp_array := ARRAY[]::INTEGER[];
        FOR i IN 1..5 LOOP
            temp_array := array_append(temp_array, card_num + i);
        END LOOP;
        b_nums := temp_array;
        
        -- Generate I column (16-30)
        temp_array := ARRAY[]::INTEGER[];
        FOR i IN 1..5 LOOP
            temp_array := array_append(temp_array, 15 + card_num + i);
        END LOOP;
        i_nums := temp_array;
        
        -- Generate N column (31-45)
        temp_array := ARRAY[]::INTEGER[];
        FOR i IN 1..5 LOOP
            temp_array := array_append(temp_array, 30 + card_num + i);
        END LOOP;
        n_nums := temp_array;
        
        -- Generate G column (46-60)
        temp_array := ARRAY[]::INTEGER[];
        FOR i IN 1..5 LOOP
            temp_array := array_append(temp_array, 45 + card_num + i);
        END LOOP;
        g_nums := temp_array;
        
        -- Generate O column (61-75)
        temp_array := ARRAY[]::INTEGER[];
        FOR i IN 1..5 LOOP
            temp_array := array_append(temp_array, 60 + card_num + i);
        END LOOP;
        o_nums := temp_array;
        
        -- Construct 5x5 grid
        numbers := ARRAY[
            ARRAY[b_nums[1], i_nums[1], n_nums[1], g_nums[1], o_nums[1]],
            ARRAY[b_nums[2], i_nums[2], n_nums[2], g_nums[2], o_nums[2]],
            ARRAY[b_nums[3], i_nums[3], 0, g_nums[3], o_nums[3]], -- Free space in center
            ARRAY[b_nums[4], i_nums[4], n_nums[4], g_nums[4], o_nums[4]],
            ARRAY[b_nums[5], i_nums[5], n_nums[5], g_nums[5], o_nums[5]]
        ];
        
        INSERT INTO card_templates (id, card_id, numbers) 
        VALUES (card_num, 'card_' || card_num, numbers);
    END LOOP;
END $$;