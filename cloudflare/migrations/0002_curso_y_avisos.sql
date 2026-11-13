CREATE TABLE courses (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, state TEXT NOT NULL, revision TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE course_backups (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, state TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX backups_user ON course_backups(user_id,created_at);
CREATE TABLE push_devices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, subscription TEXT NOT NULL, prefs TEXT NOT NULL, timezone TEXT NOT NULL, updated_at INTEGER NOT NULL, last_test_at INTEGER);
CREATE INDEX devices_user ON push_devices(user_id);
CREATE TABLE push_jobs (id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE, event_key TEXT NOT NULL, payload TEXT NOT NULL, run_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, claim_id TEXT, lease_until INTEGER, UNIQUE(device_id,event_key));
CREATE INDEX jobs_due ON push_jobs(status,run_at);
