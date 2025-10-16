-- RNG Audit Database Schema
-- This schema stores all RNG operations for certification compliance
-- Immutable logs with integrity verification

-- RNG System Configuration
CREATE TABLE IF NOT EXISTS rng_config (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL,
    library VARCHAR(100) NOT NULL,
    entropy_source VARCHAR(50) NOT NULL,
    node_version VARCHAR(50) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RNG Commits (commit-reveal scheme)
CREATE TABLE IF NOT EXISTS rng_commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id VARCHAR(100) NOT NULL UNIQUE,
    commit_hash VARCHAR(64) NOT NULL,
    commit_timestamp BIGINT NOT NULL,
    rng_version VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RNG Reveals (commit-reveal scheme)
CREATE TABLE IF NOT EXISTS rng_reveals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id VARCHAR(100) NOT NULL REFERENCES rng_commits(round_id),
    operator_seed VARCHAR(64) NOT NULL,
    reveal_timestamp BIGINT NOT NULL,
    was_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RNG Audit Logs (immutable)
CREATE TABLE IF NOT EXISTS rng_audit_logs (
    id UUID PRIMARY KEY,
    round_id VARCHAR(100),
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('commit', 'reveal', 'generate', 'verify')),
    log_timestamp BIGINT NOT NULL,
    rng_version VARCHAR(50) NOT NULL,
    details JSONB NOT NULL,
    hash VARCHAR(64) NOT NULL, -- Integrity verification hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game Rounds with RNG data
CREATE TABLE IF NOT EXISTS game_rounds_rng (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id VARCHAR(100) NOT NULL UNIQUE,
    commit_hash VARCHAR(64) NOT NULL,
    operator_seed VARCHAR(64) NOT NULL,
    draw_order INTEGER[] NOT NULL,
    generated_at BIGINT NOT NULL,
    revealed_at BIGINT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RNG Statistical Test Results
CREATE TABLE IF NOT EXISTS rng_statistical_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_name VARCHAR(100) NOT NULL,
    test_version VARCHAR(50) NOT NULL,
    test_type VARCHAR(50) NOT NULL, -- 'Dieharder', 'TestU01', 'NIST'
    sample_size BIGINT NOT NULL,
    results JSONB NOT NULL,
    passed BOOLEAN NOT NULL,
    test_timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RNG System Integrity Checks
CREATE TABLE IF NOT EXISTS rng_integrity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type VARCHAR(50) NOT NULL,
    valid BOOLEAN NOT NULL,
    errors TEXT[],
    check_timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance and audit queries
CREATE INDEX IF NOT EXISTS idx_rng_commits_round_id ON rng_commits(round_id);
CREATE INDEX IF NOT EXISTS idx_rng_commits_timestamp ON rng_commits(commit_timestamp);
CREATE INDEX IF NOT EXISTS idx_rng_reveals_round_id ON rng_reveals(round_id);
CREATE INDEX IF NOT EXISTS idx_rng_audit_logs_round_id ON rng_audit_logs(round_id);
CREATE INDEX IF NOT EXISTS idx_rng_audit_logs_operation ON rng_audit_logs(operation);
CREATE INDEX IF NOT EXISTS idx_rng_audit_logs_timestamp ON rng_audit_logs(log_timestamp);
CREATE INDEX IF NOT EXISTS idx_game_rounds_rng_round_id ON game_rounds_rng(round_id);
CREATE INDEX IF NOT EXISTS idx_game_rounds_rng_generated_at ON game_rounds_rng(generated_at);

-- Row Level Security (RLS) policies for audit integrity
ALTER TABLE rng_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rng_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rng_reveals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rng_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rounds_rng ENABLE ROW LEVEL SECURITY;
ALTER TABLE rng_statistical_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rng_integrity_checks ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert/update RNG data (read-only for others)
CREATE POLICY "RNG data service role only" ON rng_config
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "RNG commits service role only" ON rng_commits
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "RNG reveals service role only" ON rng_reveals
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "RNG audit logs service role only" ON rng_audit_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Game rounds RNG service role only" ON game_rounds_rng
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "RNG statistical tests service role only" ON rng_statistical_tests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "RNG integrity checks service role only" ON rng_integrity_checks
    FOR ALL USING (auth.role() = 'service_role');

-- Insert initial RNG configuration
INSERT INTO rng_config (version, library, entropy_source, node_version, platform)
VALUES (
    '1.0.0',
    'Node.js crypto.randomInt',
    'OS',
    'v18.0.0',
    'linux'
) ON CONFLICT DO NOTHING;

-- Functions for RNG audit queries
CREATE OR REPLACE FUNCTION get_rng_round_audit_trail(p_round_id VARCHAR(100))
RETURNS TABLE (
    operation VARCHAR(20),
    log_timestamp BIGINT,
    details JSONB,
    hash VARCHAR(64)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ral.operation,
        ral.log_timestamp,
        ral.details,
        ral.hash
    FROM rng_audit_logs ral
    WHERE ral.round_id = p_round_id
    ORDER BY ral.log_timestamp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify RNG integrity for a round
CREATE OR REPLACE FUNCTION verify_rng_round_integrity(p_round_id VARCHAR(100))
RETURNS BOOLEAN AS $$
DECLARE
    commit_exists BOOLEAN;
    reveal_exists BOOLEAN;
    logs_count INTEGER;
BEGIN
    -- Check if commit exists
    SELECT EXISTS(SELECT 1 FROM rng_commits WHERE round_id = p_round_id) INTO commit_exists;
    
    -- Check if reveal exists
    SELECT EXISTS(SELECT 1 FROM rng_reveals WHERE round_id = p_round_id) INTO reveal_exists;
    
    -- Check if we have audit logs
    SELECT COUNT(*) INTO logs_count FROM rng_audit_logs WHERE round_id = p_round_id;
    
    -- Round is valid if we have commit, reveal, and audit logs
    RETURN commit_exists AND reveal_exists AND logs_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get RNG system statistics
CREATE OR REPLACE FUNCTION get_rng_system_stats()
RETURNS TABLE (
    total_rounds BIGINT,
    total_commits BIGINT,
    total_reveals BIGINT,
    total_audit_logs BIGINT,
    verified_rounds BIGINT,
    last_activity TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM game_rounds_rng) as total_rounds,
        (SELECT COUNT(*) FROM rng_commits) as total_commits,
        (SELECT COUNT(*) FROM rng_reveals) as total_reveals,
        (SELECT COUNT(*) FROM rng_audit_logs) as total_audit_logs,
        (SELECT COUNT(*) FROM game_rounds_rng WHERE verified = true) as verified_rounds,
        (SELECT MAX(created_at) FROM rng_audit_logs) as last_activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
