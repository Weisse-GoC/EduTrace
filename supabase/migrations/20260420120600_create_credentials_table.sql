//edutrace/supabase/migrations/20260420120600_create_credentials_table.sql
-- Create credentials table for storing issued blockchain credentials
CREATE TABLE IF NOT EXISTS credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES student_records(id) ON DELETE CASCADE,
    issuer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    school_id TEXT,
    document_type TEXT NOT NULL,
    tx_hash TEXT NOT NULL UNIQUE,
    file_url TEXT NOT NULL,
    blockchain_hash TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    contract_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Revoked', 'Expired')),
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credentials_recipient_id ON credentials(recipient_id);
CREATE INDEX IF NOT EXISTS idx_credentials_tx_hash ON credentials(tx_hash);
CREATE INDEX IF NOT EXISTS idx_credentials_file_url ON credentials(file_url);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON credentials(status);

-- Enable RLS (Row Level Security)
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for data access
-- Students can view their own credentials
CREATE POLICY "Students can view own credentials" ON credentials
    FOR SELECT USING (recipient_id IN (
        SELECT id FROM student_records WHERE user_id = auth.uid()
    ));

-- Staff can view credentials they issued or for students in their school
CREATE POLICY "Staff can view relevant credentials" ON credentials
    FOR SELECT USING (
        issuer_id IN (
            SELECT id FROM profiles WHERE id = auth.uid()
        ) OR
        recipient_id IN (
            SELECT sr.id FROM student_records sr
            JOIN profiles p ON sr.school_id = p.school_id
            WHERE p.id = auth.uid()
        )
    );

-- Heads can view all credentials
CREATE POLICY "Heads can view all credentials" ON credentials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'head'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_credentials_updated_at
    BEFORE UPDATE ON credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();