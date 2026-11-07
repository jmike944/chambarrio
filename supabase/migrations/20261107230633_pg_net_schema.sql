-- Chambarrio · pg_net out of the public schema (security advisor 0014 "Extension in Public").
--
-- pg_net can't be relocated with ALTER EXTENSION ... SET SCHEMA, so it is dropped and created again
-- in `extensions`. Its functions and queue always live in schema `net`, so kick_email_sender()'s
-- net.http_post(...) keeps working unchanged. Dropping it discards queued / logged HTTP requests
-- (net.http_request_queue, net._http_response): run it while email_outbox has nothing pending.
-- Kept apart from the outbox hardening so a failure here can't block that migration.

drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
