#!/usr/bin/env node

/**
 * Emergency script to clear all pending jobs from the queue
 * Run this if you want to stop all queued AI generation jobs
 * 
 * Usage: node clear-queue.js
 */

const Bull = require('bull');
require('dotenv').config();

async function clearQueue() {
  console.log('🧹 Clearing all pending jobs from the queue...\n');

  const queue = new Bull('website-generation', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  try {
    // Get queue stats before clearing
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const delayed = await queue.getDelayedCount();

    console.log('📊 Current Queue Stats:');
    console.log(`   - Waiting: ${waiting}`);
    console.log(`   - Active: ${active}`);
    console.log(`   - Delayed: ${delayed}\n`);

    if (waiting === 0 && delayed === 0) {
      console.log('✅ No pending jobs to clear!');
      if (active > 0) {
        console.log(`⚠️  Note: ${active} job(s) are currently running and cannot be stopped.`);
      }
      process.exit(0);
    }

    // Clear waiting and delayed jobs
    const waitingJobs = await queue.getWaiting();
    const delayedJobs = await queue.getDelayed();
    
    let count = 0;
    
    for (const job of waitingJobs) {
      await job.remove();
      count++;
      console.log(`  🗑️  Removed job ${job.id} (${job.name})`);
    }
    
    for (const job of delayedJobs) {
      await job.remove();
      count++;
      console.log(`  🗑️  Removed job ${job.id} (${job.name})`);
    }

    console.log(`\n✅ Successfully cleared ${count} pending job(s)!`);
    
    if (active > 0) {
      console.log(`\n⚠️  Warning: ${active} job(s) are still running.`);
      console.log('   These cannot be stopped as they are already in progress.');
      console.log('   They will complete or fail naturally.\n');
    }

    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing queue:', error.message);
    await queue.close();
    process.exit(1);
  }
}

clearQueue();
