import 'dotenv/config';
import app from './app.js';
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);
import { connectDatabase } from './config/database.js';
import { Investigation } from './models/Investigation.js';
import { queueInvestigationGeneration } from './services/investigation/generationService.js';

const port = Number(process.env.PORT) || 5000;

try {
  await connectDatabase();
  const interruptedJobs = await Investigation.find({ status: 'Generating' }).select('_id').lean();
  interruptedJobs.forEach(({ _id }) => queueInvestigationGeneration(_id.toString()));
} catch (error) {
  console.error(`Database connection failed: ${error.message}`);
  process.exitCode = 1;
}

if (process.exitCode !== 1) {
  app.listen(port, () => {
    console.info(`AI Mystery Room API listening on port ${port}.`);
  });
}
