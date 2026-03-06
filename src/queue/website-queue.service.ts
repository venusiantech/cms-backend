const Bull = require('bull');
import { Queue } from 'bull';

export interface WebsiteGenerationJob {
  domainId: string;
  userId: string;
  templateKey: string;
  contactFormEnabled: boolean;
  selectedTitles?: string[]; // if provided, skips AI title generation
}

export class WebsiteQueueService {
  private websiteQueue: Queue;

  constructor() {
    // Initialize Bull queue with Redis
    this.websiteQueue = new Bull('website-generation', {
      redis: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    // Register queue processors
    this.registerProcessors();
  }

  private registerProcessors() {
    // Import processors dynamically to avoid circular dependencies
    const WebsiteProcessor = require('./processors/website.processor');
    
    this.websiteQueue.process('generate-website', WebsiteProcessor.processGenerateWebsite);
    this.websiteQueue.process('generate-more-blogs', WebsiteProcessor.processGenerateMoreBlogs);

    // Event listeners
    this.websiteQueue.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed`);
    });

    this.websiteQueue.on('failed', (job, err) => {
      console.error(`❌ Job ${job.id} failed:`, err.message);
    });

    this.websiteQueue.on('error', (error) => {
      console.error('❌ Queue error:', error);
    });
  }

  async addWebsiteGenerationJob(data: WebsiteGenerationJob): Promise<string> {
    const job = await this.websiteQueue.add('generate-website', data, {
      attempts: 2, // Reduced from 3 - AI failures are usually not transient
      backoff: {
        type: 'exponential',
        delay: 5000, // Increased from 2s to 5s
      },
      timeout: 1200000, // 20 minute timeout per attempt (3 blogs × ~5 min each + images)
      removeOnComplete: false, // Keep completed jobs for status checking
      removeOnFail: false, // Keep failed jobs for debugging
    });

    console.log(`✅ Job ${job.id} queued for domain ${data.domainId} (max 2 attempts)`);
    return job.id.toString();
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.websiteQueue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      id: job.id,
      status: state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
    };
  }

  async addGenerateMoreBlogsJob(
    websiteId: string,
    userId: string,
    quantity: number = 3
  ): Promise<string> {
    const job = await this.websiteQueue.add(
      'generate-more-blogs',
      { websiteId, userId, quantity },
      {
        attempts: 2, // Reduced from 3 - AI failures are usually not transient
        backoff: {
          type: 'exponential',
          delay: 5000, // Increased from 2s to 5s
        },
        timeout: 1200000, // 20 minute timeout per attempt (3 blogs × ~5 min each + images)
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    console.log(
      `✅ Job ${job.id} queued for generating ${quantity} more blog(s) (max 2 attempts)`
    );
    return job.id.toString();
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = await this.websiteQueue.getJob(jobId);
    
    if (!job) {
      return false;
    }

    const state = await job.getState();
    
    // Only cancel if job is waiting or delayed (not already processing)
    if (state === 'waiting' || state === 'delayed' || state === 'active') {
      await job.remove();
      console.log(`🛑 Job ${jobId} cancelled`);
      return true;
    }

    return false;
  }

  async clearAllPendingJobs(): Promise<number> {
    // Remove all waiting and delayed jobs
    const waiting = await this.websiteQueue.getWaiting();
    const delayed = await this.websiteQueue.getDelayed();
    
    let count = 0;
    
    for (const job of waiting) {
      await job.remove();
      count++;
    }
    
    for (const job of delayed) {
      await job.remove();
      count++;
    }
    
    console.log(`🧹 Cleared ${count} pending job(s)`);
    return count;
  }

  async pauseQueue(): Promise<void> {
    await this.websiteQueue.pause();
    console.log('⏸️  Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.websiteQueue.resume();
    console.log('▶️  Queue resumed');
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.websiteQueue.getWaitingCount();
    const active = await this.websiteQueue.getActiveCount();
    const completed = await this.websiteQueue.getCompletedCount();
    const failed = await this.websiteQueue.getFailedCount();
    const delayed = await this.websiteQueue.getDelayedCount();
    const paused = await this.websiteQueue.isPaused();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Count how many generate-website jobs a specific user has in waiting or active state.
   * Used to enforce the 3-concurrent-per-user limit in bulk generation.
   */
  async getActiveJobCountForUser(userId: string): Promise<number> {
    const [active, waiting] = await Promise.all([
      this.websiteQueue.getActive(),
      this.websiteQueue.getWaiting(),
    ]);
    return [...active, ...waiting].filter(
      (job) => job.name === 'generate-website' && job.data.userId === userId
    ).length;
  }

  getQueue(): Queue {
    return this.websiteQueue;
  }
}
