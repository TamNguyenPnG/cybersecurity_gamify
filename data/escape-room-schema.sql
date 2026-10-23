CREATE TABLE IF NOT EXISTS escape_rooms (
    email TEXT NOT NULL REFERENCES employees(email),
    room_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    results TEXT NOT NULL DEFAULT '{}',
    attempted INTEGER NOT NULL DEFAULT 0,
    passed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (email, room_id)
);
