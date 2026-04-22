'use strict';

const Bull = require('bull');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const resourceSyncQueue = new Bull('resource-sync', REDIS_URL);

function registerProcessors() {
  const resourceSyncProcessor = require('./resourceSync');
  resourceSyncQueue.process(resourceSyncProcessor);

  console.log('[workers] resource-sync queue processor registered');

  resourceSyncQueue.on('waiting', (jobId) => {
    console.log(`[workers] job waiting  jobId=${jobId}`);
  });

  resourceSyncQueue.on('active', (job) => {
    console.log(`[workers] job active  jobId=${job.id}  data=${JSON.stringify(job.data)}`);
  });

  resourceSyncQueue.on('completed', (job, result) => {
    console.log(`[workers] job completed  jobId=${job.id}  result=${JSON.stringify(result)}`);
    process.stdout.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'job_completed',
      queue: 'resource-sync',
      jobId: job.id,
      result,
    }) + '\n');
  });

  resourceSyncQueue.on('failed', (job, err) => {
    console.error(`[workers] job failed  jobId=${job.id}  error=${err.message}`);
    process.stderr.write(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'job_failed',
      queue: 'resource-sync',
      jobId: job.id,
      error: err.message,
    }) + '\n');
  });

  resourceSyncQueue.on('stalled', (job) => {
    console.warn(`[workers] job stalled  jobId=${job.id}`);
  });

  resourceSyncQueue.on('error', (err) => {
    console.error(`[workers] queue error  error=${err.message}`);
  });
}

module.exports = { resourceSyncQueue, registerProcessors };
