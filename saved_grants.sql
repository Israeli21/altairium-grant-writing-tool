-- Create saved_grants table
CREATE TABLE IF NOT EXISTS saved_grants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    nonprofit_name TEXT,
    grantor_name TEXT,
    funding_amount TEXT,
    additional_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_grants_user_id ON saved_grants(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_saved_grants_created_at ON saved_grants(created_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_grants ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own saved grants
CREATE POLICY "Users can view their own saved grants"
    ON saved_grants
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own saved grants
CREATE POLICY "Users can insert their own saved grants"
    ON saved_grants
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own saved grants
CREATE POLICY "Users can update their own saved grants"
    ON saved_grants
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own saved grants
CREATE POLICY "Users can delete their own saved grants"
    ON saved_grants
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_grants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_saved_grants_updated_at
    BEFORE UPDATE ON saved_grants
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_grants_updated_at();