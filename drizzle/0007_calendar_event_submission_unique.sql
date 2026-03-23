CREATE UNIQUE INDEX IF NOT EXISTS `calendar_events_form_submission_id_unique`
ON `calendar_events` (`form_submission_id`)
WHERE `form_submission_id` IS NOT NULL;