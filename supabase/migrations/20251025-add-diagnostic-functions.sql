
-- Function to get table information including constraints
CREATE OR REPLACE FUNCTION public.get_table_info(table_name text)
RETURNS TABLE (
  constraint_name text,
  constraint_type text,
  definition text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    con.conname AS constraint_name,
    CASE 
      WHEN con.contype = 'c' THEN 'CHECK'
      WHEN con.contype = 'f' THEN 'FOREIGN KEY'
      WHEN con.contype = 'p' THEN 'PRIMARY KEY'
      WHEN con.contype = 'u' THEN 'UNIQUE'
      ELSE con.contype::text
    END AS constraint_type,
    pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = table_name
  AND nsp.nspname = 'public';
END;
$$;

-- Function to get column information
CREATE OR REPLACE FUNCTION public.get_column_info(table_name text, column_name text)
RETURNS TABLE (
  data_type text,
  is_nullable boolean,
  column_default text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    NOT a.attnotnull AS is_nullable,
    pg_get_expr(d.adbin, d.adrelid) AS column_default
  FROM pg_attribute a
  LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relname = table_name
  AND n.nspname = 'public'
  AND a.attname = column_name
  AND a.attnum > 0
  AND NOT a.attisdropped;
END;
$$;
