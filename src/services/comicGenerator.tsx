interface ComicGenerationRequest {
  heroName: string;
  comicTitle: string;
  photo: File;
  characterStyle: string;
  customStyle: string;
  storyDescription: string;
  illustrationStyle: string;
  storyLanguage?: 'en' | 'de';
  customerEmail?: string;
}

interface ComicGenerationResult {
  success: boolean;
  comicUrl?: string;
  coverImageUrl?: string;
  coverUrl?: string;
  interiorUrl?: string;
  error?: string;
}

class ComicGeneratorService {
  private supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  private supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  async generateComic(request: ComicGenerationRequest): Promise<ComicGenerationResult> {
    try {
      console.log('Starting comic generation with orchestrator...');
      
      // Step 1: Start the job
      const jobResult = await this.startComicJob(request);
      if (!jobResult.success || !jobResult.jobId) {
        return { success: false, error: jobResult.error || 'Failed to start job' };
      }

      console.log('Job started with ID:', jobResult.jobId);

      // Step 2: Poll for completion
      const result = await this.pollJobStatus(jobResult.jobId);
      return result;

    } catch (error) {
      console.error('Comic generation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async startComicJob(request: ComicGenerationRequest): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('heroName', request.heroName);
      formData.append('comicTitle', request.comicTitle);
      formData.append('photo', request.photo);
      formData.append('characterStyle', request.characterStyle);
      formData.append('customStyle', request.customStyle);
      formData.append('storyDescription', request.storyDescription);
      formData.append('illustrationStyle', request.illustrationStyle);
      if (request.storyLanguage) {
        formData.append('storyLanguage', request.storyLanguage);
      }
      if (request.customerEmail) {
        formData.append('customerEmail', request.customerEmail);
      }

      const response = await fetch(`${this.supabaseUrl}/functions/v1/start-comic-job`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.supabaseAnonKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to start comic job:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start job'
      };
    }
  }

  private async pollJobStatus(jobId: string): Promise<ComicGenerationResult> {
    const maxAttempts = 180; // 15 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.supabaseUrl}/functions/v1/get-job-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        
        if (result.status === 'completed') {
          return {
            success: true,
            comicUrl: result.output_data?.comicUrl,
            coverImageUrl: result.output_data?.coverImageUrl,
            coverUrl: result.output_data?.coverUrl,
            interiorUrl: result.output_data?.interiorUrl
          };
        } else if (result.status === 'failed') {
          return {
            success: false,
            error: result.error_message || 'Job failed'
          };
        }

        // Job still processing, wait and try again
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

      } catch (error) {
        console.error('Error polling job status:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return {
      success: false,
      error: 'Job timed out after 15 minutes'
    };
  }
}

export const comicGeneratorService = new ComicGeneratorService();