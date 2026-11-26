-- Run after migration 003 and before migration 004. This query is read-only.
-- Every reported account needs operator review before 004 can proceed.
SELECT u.id AS user_id,
       array_remove(array_agg(r.name ORDER BY r.name), NULL) AS assigned_roles,
       CASE
         WHEN COUNT(r.id) = 0 THEN 'No role assigned'
         WHEN COUNT(r.id) > 1 THEN 'Multiple roles assigned'
         WHEN bool_or(r.name NOT IN ('user', 'admin')) THEN 'Unsupported role'
         ELSE 'Administrator email verification missing'
       END AS issue
FROM public.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.roles r ON r.id = ur.role_id
GROUP BY u.id
HAVING COUNT(r.id) <> 1
    OR bool_or(r.name NOT IN ('user', 'admin'))
    OR (bool_or(r.name = 'admin') AND (to_jsonb(u)->>'email_verified_at') IS NULL)
ORDER BY u.id;
