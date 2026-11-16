-- Object storage must be deleted before the corresponding database facts are purged.
-- Keep the original no-argument function for compatibility, but the application calls this scoped overload
-- only with IDs whose object deletion succeeded.
CREATE FUNCTION purge_expired_documents(p_doc_ids uuid[]) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  WITH expired AS (
    UPDATE policy_document SET deleted_ts = now()
    WHERE deleted_ts IS NULL
      AND retention_until < now()
      AND doc_id = ANY(p_doc_ids)
    RETURNING doc_id
  ), facts AS (
    DELETE FROM policy_fact WHERE doc_id IN (SELECT doc_id FROM expired)
  ), log AS (
    INSERT INTO document_access_log (doc_id, actor, action)
    SELECT doc_id, 'system:retention', 'delete' FROM expired
  )
  SELECT count(*) INTO n FROM expired;
  RETURN n;
END $$;


-- Disable the legacy unscoped purge. It can delete database facts without first deleting the object
-- from remote storage, so the application must use the object-ID-scoped overload above.
CREATE OR REPLACE FUNCTION purge_expired_documents() RETURNS integer LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Unsafe unscoped retention purge is disabled. Delete expired objects from storage first, then call purge_expired_documents(uuid[]) with only successfully deleted document IDs.';
END $$;
