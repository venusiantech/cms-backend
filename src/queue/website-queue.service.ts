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
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: false, // Keep completed jobs for status checking
      removeOnFail: false, // Keep failed jobs for debugging
    });

    console.log(`✅ Added job ${job.id} to queue for domain ${data.domainId}`);
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
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    console.log(`✅ Added job ${job.id} to queue for generating more blogs`);
    return job.id.toString();
  }
}


