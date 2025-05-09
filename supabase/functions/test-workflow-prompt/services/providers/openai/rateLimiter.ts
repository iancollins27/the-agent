import { sleep } from "../../../utils.ts";

interface RateLimiterState {
  lastRequestTime: number;
  requestCount: number;
  windowStart: number;
  pendingRequests: number;
}

const RATE_LIMIT = {
  requestsPerMinute: 60,
  windowMs: 60000, // 1 minute
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxConcurrentRequests: 10, // Maximum number of concurrent requests
};

class OpenAIRateLimiter {
  private state: RateLimiterState = {
    lastRequestTime: 0,
    requestCount: 0,
    windowStart: Date.now(),
    pendingRequests: 0,
  };

  private async waitForConcurrentSlot(): Promise<void> {
    while (this.state.pendingRequests >= RATE_LIMIT.maxConcurrentRequests) {
      await sleep(100);
    }
    this.state.pendingRequests++;
  }

  private releaseConcurrentSlot(): void {
    this.state.pendingRequests = Math.max(0, this.state.pendingRequests - 1);
  }

  async waitForSlot(): Promise<void> {
    await this.waitForConcurrentSlot();
    
    try {
      const now = Date.now();
      
      // Reset counter if window has passed
      if (now - this.state.windowStart >= RATE_LIMIT.windowMs) {
        this.state.requestCount = 0;
        this.state.windowStart = now;
      }

      // If we've hit the rate limit, wait until the next window
      if (this.state.requestCount >= RATE_LIMIT.requestsPerMinute) {
        const waitTime = RATE_LIMIT.windowMs - (now - this.state.windowStart);
        console.log(`Rate limit reached, waiting ${waitTime}ms for next window`);
        await sleep(waitTime);
        this.state.requestCount = 0;
        this.state.windowStart = Date.now();
      }

      // Ensure minimum time between requests (100ms)
      const timeSinceLastRequest = now - this.state.lastRequestTime;
      if (timeSinceLastRequest < 100) {
        await sleep(100 - timeSinceLastRequest);
      }

      this.state.lastRequestTime = Date.now();
      this.state.requestCount++;
    } finally {
      this.releaseConcurrentSlot();
    }
  }

  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < RATE_LIMIT.maxRetries; attempt++) {
      try {
        await this.waitForSlot();
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (error.message?.includes('429')) {
          // Get the full error response if available
          let errorDetails = '';
          try {
            const errorResponse = await error.response?.text();
            if (errorResponse) {
              errorDetails = ` - ${errorResponse}`;
            }
          } catch (e) {
            // Ignore parsing errors
          }
          
          console.error(`Rate limit hit (attempt ${attempt + 1}/${RATE_LIMIT.maxRetries})${errorDetails}`);
          
          // Calculate exponential backoff with jitter
          const baseBackoff = RATE_LIMIT.initialBackoffMs * Math.pow(2, attempt);
          const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
          const backoffMs = baseBackoff + jitter;
          
          console.log(`Backing off for ${backoffMs}ms`);
          await sleep(backoffMs);
          continue;
        }
        
        // If it's not a rate limit error, throw immediately
        throw error;
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
}

// Export a singleton instance
export const openAIRateLimiter = new OpenAIRateLimiter(); 