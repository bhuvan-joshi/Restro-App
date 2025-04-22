-- Create reasons table if it doesn't exist
CREATE TABLE IF NOT EXISTS reasons (
  reason_id INTEGER PRIMARY KEY AUTOINCREMENT,
  reason TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default reasons for receive type
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Purchase', 'receive');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Return', 'receive');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Transfer', 'receive');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Other', 'receive');

-- Insert default reasons for issue type
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Sale', 'issue');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Damage/Loss', 'issue');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Transfer', 'issue');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Other', 'issue');

-- Insert default reasons for adjust type
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Inventory Count', 'adjust');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Correction', 'adjust');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Damage/Loss', 'adjust');
INSERT OR IGNORE INTO reasons (reason, type) VALUES ('Other', 'adjust');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reasons_type ON reasons(type);
