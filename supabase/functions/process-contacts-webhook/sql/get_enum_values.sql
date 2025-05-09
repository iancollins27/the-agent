
-- Function to get enum values from PostgreSQL system catalog
-- This SQL should be executed in your Supabase project SQL editor
CREATE OR REPLACE FUNCTION get_enum_values(enum_name text)
RETURNS text[] AS $$
BEGIN
  RETURN (
    SELECT array_agg(enumlabel)
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = enum_name
    ORDER BY pg_enum.enumsortorder
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
