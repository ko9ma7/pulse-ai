-- OPTIONAL deep historical discovery using GH Archive BigQuery.
-- Purpose: find repositories that received many public WatchEvent (GitHub star) events
-- during the last year, including repositories that may not be in today's Radar cohort.
--
-- Run in BigQuery with a billing-enabled Google Cloud project. The public GH Archive
-- dataset is hosted as githubarchive.day.YYYYMMDD tables. Restrict the date suffix to
-- control bytes scanned.
--
-- Replace the dates below with your desired UTC range.
WITH star_events AS (
  SELECT
    repo.name AS full_name,
    DATE(created_at) AS event_date,
    COUNT(*) AS stars_gained
  FROM `githubarchive.day.20*`
  WHERE
    _TABLE_SUFFIX BETWEEN '250909' AND '260909'
    AND type = 'WatchEvent'
  GROUP BY full_name, event_date
),
weekly AS (
  SELECT
    full_name,
    DATE_TRUNC(event_date, WEEK(MONDAY)) AS week_start,
    SUM(stars_gained) AS star_7d
  FROM star_events
  GROUP BY full_name, week_start
)
SELECT
  full_name,
  week_start,
  star_7d,
  LAG(star_7d) OVER (PARTITION BY full_name ORDER BY week_start) AS previous_7d,
  SAFE_DIVIDE(
    star_7d + 5,
    LAG(star_7d) OVER (PARTITION BY full_name ORDER BY week_start) + 5
  ) AS acceleration
FROM weekly
WHERE star_7d >= 5
ORDER BY week_start DESC, star_7d DESC;
