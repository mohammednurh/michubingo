-- Demo users for Bingo System
-- Run this in your Supabase SQL Editor after setting up the main schema

-- Insert demo users into auth.users (this requires admin access)
-- Note: In production Supabase, you should create these users through the Auth UI or API
-- This is a reference for the accounts that should be created

-- Demo Admin User
-- Email: admin@bingo.et
-- Password: admin123
-- Role: admin

-- Demo Cashier User  
-- Email: cashier@bingo.et
-- Password: cashier123
-- Role: cashier

-- Since we cannot directly insert into auth.users via SQL in hosted Supabase,
-- you need to create these users through one of these methods:

-- METHOD 1: Use Supabase Dashboard
-- 1. Go to Authentication > Users in your Supabase dashboard
-- 2. Click "Add user" 
-- 3. Create user with email: admin@bingo.et, password: admin123
-- 4. Create user with email: cashier@bingo.et, password: cashier123

-- METHOD 2: Use the signup functionality we'll add to the app

-- After creating the users in Supabase Auth, we need to insert their profiles
-- You'll need to get the actual UUIDs from the auth.users table and replace the UUIDs below

-- First, check what users exist:
-- SELECT id, email FROM auth.users;

-- Then insert profiles (replace the UUIDs with actual ones from auth.users):
-- INSERT INTO profiles (id, email, role, subscription_months, subscription_price_birr, is_active)
-- VALUES 
--   ('your-admin-uuid-here', 'admin@bingo.et', 'admin', 12, 1200, true),
--   ('your-cashier-uuid-here', 'cashier@bingo.et', 'cashier', 1, 100, true);

-- For now, let's create a trigger to automatically create profiles for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, subscription_months, subscription_price_birr, is_active)
  VALUES (
    new.id,
    new.email,
    CASE 
      WHEN new.email = 'admin@bingo.et' THEN 'admin'
      WHEN new.email = 'cashier@bingo.et' THEN 'cashier'
      ELSE 'cashier'
    END,
    CASE 
      WHEN new.email = 'admin@bingo.et' THEN 12
      ELSE 1
    END,
    CASE 
      WHEN new.email = 'admin@bingo.et' THEN 1200
      ELSE 100
    END,
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();