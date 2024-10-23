CREATE TABLE IF NOT EXISTS urls (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    target_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, target_url)
);
