import { queueMissingMeetingReportPdfGeneration } from '../src/lib/server/pdf/meetingReportPdf.js';

async function run(): Promise<void> {
	console.log('Starting PDF backfill for meeting submissions without pdf_link...');

	const processed = await queueMissingMeetingReportPdfGeneration();

	console.log(`PDF backfill completed. Processed ${processed} submission(s).`);
}

run().catch((error) => {
	console.error('PDF backfill failed.', error);
	process.exit(1);
});