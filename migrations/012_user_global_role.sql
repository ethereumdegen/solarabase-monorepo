-- Add global role column to users (default 'user', manually set 'admin' in DB)
CREATE TYPE user_role AS ENUM ('user', 'admin');
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user';
