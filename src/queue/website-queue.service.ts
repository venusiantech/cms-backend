import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface WebsiteGenerationJob {
  domainId: string;
  userId: string;
  templateKey: string;
  contactFormEnabled: boolean;
}

@Injectable()
export class WebsiteQueueService {
  constructor(
    @InjectQueue('website-generation') private websiteQueue: Queue,
  ) {}

  async addWebsiteGenerationJob(data: WebsiteGenerationJob): Promise<string> {
    const job = await this.websiteQueue.add('generate-website', data, {
      attempts: 2, // Reduced from 3 - AI failures are usually not transient
      backoff: {
        type: 'exponential',
        delay: 5000, // Increased from 2s to 5s
      },
      timeout: 180000, // 3 minute timeout per attempt
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

  async addGenerateMoreBlogsJob(websiteId: string, userId: string): Promise<string> {
    const job = await this.websiteQueue.add('generate-more-blogs', 
      { websiteId, userId },
      {
        attempts: 2, // Reduced from 3 - AI failures are usually not transient
        backoff: {
          type: 'exponential',
          delay: 5000, // Increased from 2s to 5s
        },
        timeout: 180000, // 3 minute timeout per attempt
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    console.log(`✅ Job ${job.id} queued for generating more blogs (max 2 attempts)`);
    return job.id.toString();
  }
}


