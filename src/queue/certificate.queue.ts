import { EventEmitter } from 'events';

export interface CertificateJobData {
    generationId: string;
    templateId: string;
    userId: string;
    dataFilePath: string;
    packageType: string;
}

interface Job<T> {
    id: string;
    data: T;
    progress: (value: number) => void;
    attemptsMade: number;
}

class SimpleQueue<T> extends EventEmitter {
    private queue: Job<T>[] = [];
    private activeJobs: Map<string, Job<T>> = new Map();
    private jobProgress: Map<string, number> = new Map();
    private processing = false;
    private jobIdCounter = 0;

    async add(data: T): Promise<Job<T>> {
        const job: Job<T> = {
            id: `job_${++this.jobIdCounter}_${Date.now()}`,
            data,
            attemptsMade: 0,
            progress: (value: number) => {
                this.jobProgress.set(job.id, value);
            },
        };

        this.queue.push(job);
        console.log(`Job ${job.id} added to queue. Queue size: ${this.queue.length}`);

        // Start processing if not already processing
        if (!this.processing) {
            this.processQueue();
        }

        return job;
    }

    process(handler: (job: Job<T>) => Promise<any>): void {
        this.on('process', async (job: Job<T>) => {
            try {
                this.activeJobs.set(job.id, job);
                console.log(`Processing job ${job.id}`);

                const result = await handler(job);

                this.activeJobs.delete(job.id);
                this.jobProgress.delete(job.id);
                this.emit('completed', job, result);
            } catch (error) {
                this.activeJobs.delete(job.id);

                // Retry logic (max 3 attempts)
                if (job.attemptsMade < 2) {
                    job.attemptsMade++;
                    console.log(`Job ${job.id} failed, retrying (attempt ${job.attemptsMade + 1}/3)`);

                    // Add back to queue with exponential backoff
                    setTimeout(() => {
                        this.queue.push(job);
                        this.processQueue();
                    }, 2000 * Math.pow(2, job.attemptsMade));
                } else {
                    this.jobProgress.delete(job.id);
                    this.emit('failed', job, error);
                }
            }
        });
    }

    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const job = this.queue.shift();
            if (job) {
                this.emit('process', job);
                // Wait a bit before processing next job to avoid overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        this.processing = false;
    }

    async getJobs(types: string[]): Promise<Job<T>[]> {
        if (types.includes('active')) {
            return Array.from(this.activeJobs.values());
        }
        return [];
    }

    getJobProgress(jobId: string): number {
        return this.jobProgress.get(jobId) || 0;
    }
}

export const certificateQueue = new SimpleQueue<CertificateJobData>();
