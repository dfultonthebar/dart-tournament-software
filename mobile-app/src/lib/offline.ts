import { ScoreSubmission } from '@shared/types';

interface QueuedSubmission {
  id: string;
  submission: ScoreSubmission;
  timestamp: number;
  attempts: number;
}

class OfflineQueue {
  private queue: QueuedSubmission[] = [];
  private readonly STORAGE_KEY = 'offline_score_queue';
  private readonly MAX_ATTEMPTS = 3;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadQueue();
    }
  }

  add(submission: ScoreSubmission): string {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const queued: QueuedSubmission = {
      id,
      submission,
      timestamp: Date.now(),
      attempts: 0,
    };

    this.queue.push(queued);
    this.saveQueue();

    return id;
  }

  remove(id: string) {
    this.queue = this.queue.filter((item) => item.id !== id);
    this.saveQueue();
  }

  getAll(): QueuedSubmission[] {
    return [...this.queue];
  }

  incrementAttempts(id: string) {
    const item = this.queue.find((q) => q.id === id);
    if (item) {
      item.attempts++;
      if (item.attempts >= this.MAX_ATTEMPTS) {
        this.remove(id);
      } else {
        this.saveQueue();
      }
    }
  }

  clear() {
    this.queue = [];
    this.saveQueue();
  }

  private saveQueue() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    }
  }

  private loadQueue() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          this.queue = JSON.parse(stored);
        } catch (error) {
          console.error('Error loading offline queue:', error);
          this.queue = [];
        }
      }
    }
  }
}

export const offlineQueue = new OfflineQueue();

export async function syncOfflineQueue(submitFn: (submission: ScoreSubmission) => Promise<any>) {
  const items = offlineQueue.getAll();

  for (const item of items) {
    try {
      await submitFn(item.submission);
      offlineQueue.remove(item.id);
    } catch (error) {
      console.error(`Failed to sync submission ${item.id}:`, error);
      offlineQueue.incrementAttempts(item.id);
    }
  }
}
