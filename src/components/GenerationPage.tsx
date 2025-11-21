import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, ShoppingCart, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import PhysicalOrderModal from './PhysicalOrderModal';
import PagePreviewModal from './PagePreviewModal';
import { calculatePanelCoordinates } from '../lib/panelUtils';
import { useAuth } from '../contexts/AuthContext';

interface ComicData {
  heroName: string;
  comicTitle: string;
  photo: File | null;
  photoPreview: string | null;
  characterStyle: string;
  customStyle: string;
  storyDescription: string;
  illustrationStyle: string;
  storyLanguage: 'en' | 'de';
  customerEmail?: string;
}

interface GenerationPageProps {
  comicData: ComicData;
  onBack: () => void;
  onStartOver: () => void;
  preExistingJobId?: string | null;
}

type GenerationStatus = 'generating' | 'awaiting_approval' | 'completed' | 'error';

const GenerationPage: React.FC<GenerationPageProps> = ({ comicData, onBack, onStartOver, preExistingJobId }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<GenerationStatus>('generating');
  const [jobId, setJobId] = useState<string | null>(preExistingJobId || null);
  const [progress, setProgress] = useState(0);
  const [generatedComic, setGeneratedComic] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedCoverPdfUrl, setGeneratedCoverPdfUrl] = useState<string | null>(null);
  const [generatedInteriorPdfUrl, setGeneratedInteriorPdfUrl] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState(240); // 4 minutes in seconds
  const [isFinalizingPdf, setIsFinalizingPdf] = useState(false);
  const [showPhysicalOrderModal, setShowPhysicalOrderModal] = useState(false);
  const [showPagePreviewModal, setShowPagePreviewModal] = useState(false);
  const [generatedPages, setGeneratedPages] = useState<any>({});
  const [originalPages, setOriginalPages] = useState<any>({});
  const [pageApprovals, setPageApprovals] = useState<Record<string, boolean>>({});
  const [panelCounts, setPanelCounts] = useState<Record<string, number>>({});
  const [inputData, setInputData] = useState<any>(null);
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    if (!hasGeneratedRef.current) {
      generateComic();
      hasGeneratedRef.current = true;
    }
  }, [comicData]);

  const generateComic = async () => {
    try {
      setStatus('generating');
      setProgress(0);

      // Steady progress over 4 minutes (240 seconds)
      const totalSeconds = 240;
      const progressIncrement = 90 / totalSeconds; // Progress to 90% over 4 minutes

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return Math.min(90, prev + progressIncrement);
        });
      }, 1000);

      // Countdown from 4 minutes
      const timeInterval = setInterval(() => {
        setEstimatedTime(prev => Math.max(0, prev - 1));
      }, 1000);

      console.log('Starting comic generation...');

      let currentJobId: string;

      // If we already have a jobId (from preview mode), skip job creation
      if (preExistingJobId) {
        console.log('Using pre-existing job ID:', preExistingJobId);
        currentJobId = preExistingJobId;
      } else {
        // Check if user is authenticated
        if (!user) {
          throw new Error('User must be authenticated to generate a comic');
        }

        // Create FormData for the job
        const formData = new FormData();
        formData.append('heroName', comicData.heroName);
        formData.append('comicTitle', comicData.comicTitle);
        formData.append('photo', comicData.photo!);
        formData.append('characterStyle', comicData.characterStyle);
        formData.append('customStyle', comicData.customStyle);
        formData.append('storyDescription', comicData.storyDescription);
        formData.append('illustrationStyle', comicData.illustrationStyle);
        formData.append('storyLanguage', comicData.storyLanguage || 'de');
        formData.append('userId', user.id);
        if (comicData.customerEmail) {
          formData.append('customerEmail', comicData.customerEmail);
        }

        // Start the job
        const jobResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/start-comic-job`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: formData
        });

        if (!jobResponse.ok) {
          const errorData = await jobResponse.json();
          throw new Error(`Failed to start job: ${errorData.error}`);
        }

        const jobResult = await jobResponse.json();
        if (!jobResult.success) {
          throw new Error(`Failed to start job: ${jobResult.error}`);
        }

        currentJobId = jobResult.jobId;
        setJobId(currentJobId);
        console.log('Job started with ID:', currentJobId);
      }

      // Poll for completion
      const maxAttempts = 180; // 15 minutes with 5-second intervals
      let attempts = 0;

      while (attempts < maxAttempts) {
        try {
          const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId: currentJobId })
          });

          if (!statusResponse.ok) {
            throw new Error(`HTTP ${statusResponse.status}: ${await statusResponse.text()}`);
          }

          const result = await statusResponse.json();
          
          if (result.status === 'awaiting_approval') {
            clearInterval(progressInterval);
            clearInterval(timeInterval);

            console.log('All pages generated, awaiting approval');
            setProgress(80);
            const pages = result.output_data?.generatedPages || {};
            const counts = result.output_data?.panelCounts || {};
            setGeneratedPages(pages);
            setOriginalPages(pages);
            setPageApprovals(result.page_approvals || {});
            setInputData(result.input_data);
            setPanelCounts(counts);
            setStatus('awaiting_approval');
            setShowPagePreviewModal(true);
            return;
          } else if (result.status === 'completed') {
            clearInterval(progressInterval);
            clearInterval(timeInterval);

            console.log('Generation successful, setting completed state');
            setProgress(100);
            setGeneratedComic(result.output_data?.comicUrl!);
            // Convert storage path to public URL
            const coverPath = result.output_data?.generatedPages?.cover;
            if (coverPath) {
              const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comics/${coverPath}`;
              setGeneratedImage(publicUrl);
            } else {
              setGeneratedImage('');
            }
            setGeneratedCoverPdfUrl(result.output_data?.coverUrl!);
            setGeneratedInteriorPdfUrl(result.output_data?.interiorUrl!);
            setStatus('completed');
            setShowPagePreviewModal(false);
            return;
          } else if (result.status === 'failed') {
            throw new Error(result.error_message || 'Job failed');
          }

          // Update progress for generating/processing status
          if (result.progress) {
            setProgress(result.progress);
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

      throw new Error('Job timed out after 15 minutes');
    } catch (error) {
      console.error('Exception in generateComic:', error);
      hasGeneratedRef.current = false; // Reset ref on error to allow retry
      setStatus('error');
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApprovePage = async (pageKey: string) => {
    if (!jobId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/approve-page`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, pageKey })
      });

      const result = await response.json();
      if (result.success) {
        setPageApprovals(prev => ({ ...prev, [pageKey]: true }));
      } else {
        console.error('Failed to approve page:', result.error);
        alert('Error confirming page. Please try again.');
      }
    } catch (error) {
      console.error('Error approving page:', error);
      alert('Fehler beim Bestätigen der Seite. Bitte versuchen Sie es erneut.');
    }
  };

  const handleUnapprovePage = async (pageKey: string) => {
    if (!jobId) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unapprove-page`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, pageKey })
      });

      const result = await response.json();
      if (result.success) {
        setPageApprovals(prev => ({ ...prev, [pageKey]: false }));
      } else {
        console.error('Failed to unapprove page:', result.error);
        alert('Error unlocking page. Please try again.');
      }
    } catch (error) {
      console.error('Error unapproving page:', error);
      alert('Fehler beim Entsperren der Seite. Bitte versuchen Sie es erneut.');
    }
  };

  const handleEditPage = async (pageKey: string, userPrompt: string, panelNumber: number) => {
  if (!jobId || !inputData) return;

  try {
    // Full page regeneration - use generate-comic directly like the first time
    if (panelNumber === 0) {
      // Get previous page for context (same logic as orchestrator)
      let allPreviousPages: string[] = [];
      if (pageKey.startsWith('storyPage')) {
        const pageNum = parseInt(pageKey.replace('storyPage', ''));
        if (pageNum > 1) {
          const prevPageKey = `storyPage${pageNum - 1}`;
          const prevPagePath = generatedPages[prevPageKey];
          if (prevPagePath) {
            allPreviousPages = [prevPagePath];
          }
        }
      }

      // Determine target
      let target: string | number;
      if (pageKey === 'cover') {
        target = 'cover';
      } else if (pageKey === 'backCover') {
        target = 'backCover';
      } else if (pageKey.startsWith('storyPage')) {
        target = parseInt(pageKey.replace('storyPage', ''));
      } else {
        alert('Invalid page type');
        return;
      }

      // Get job output data for characterRef
      const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId })
      });
      const statusResult = await statusResponse.json();
      const characterRefStoragePath = statusResult.output_data?.characterRefStoragePath;

      // Build request exactly like first generation (orchestrator lines 192-226)
      const generateRequest: any = {
        prompt: inputData.storyDescription,
        style: inputData.characterStyle === 'custom' ? inputData.customStyle : inputData.characterStyle,
        heroName: inputData.heroName,
        characterStyle: inputData.characterStyle === 'custom' ? inputData.customStyle : inputData.characterStyle,
        storyDescription: inputData.storyDescription,
        illustrationStyle: inputData.illustrationStyle,
        comicTitle: inputData.comicTitle,
        storyLanguage: inputData.storyLanguage,
        target,
        allPreviousPages: allPreviousPages.length > 0 ? allPreviousPages : undefined,
        jobId,
        characterRefStoragePath
      };

      console.log('Regenerating page with generate-comic:', pageKey, generateRequest);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-comic`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(generateRequest)
      });

      const result = await response.json();
      if (!result.success) {
        alert(result.error || 'Error regenerating page. Please try again.');
        return;
      }

      // Update the page in the job's output_data
      const currentStatus = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId })
      });
      const currentData = await currentStatus.json();

      const updatedPages = {
        ...currentData.output_data?.generatedPages,
        [pageKey]: result.storagePath
      };

      // Update job with new page
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-comic-page`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          pageKey,
          newPagePath: result.storagePath,
          updateOnly: true
        })
      });

      // Poll for updated page
      const maxAttempts = 30;
      let attempts = 0;
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const pollResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId })
        });
        const pollResult = await pollResponse.json();
        if (pollResult.success && pollResult.output_data?.generatedPages) {
          const updatedPages = pollResult.output_data.generatedPages;
          setOriginalPages(prev => {
            const updated = { ...prev };
            Object.keys(updatedPages).forEach(key => {
              if (!updated[key]) updated[key] = updatedPages[key];
            });
            return updated;
          });
          setGeneratedPages(updatedPages);
          setPageApprovals(pollResult.page_approvals || {});
          if (pollResult.output_data?.panelCounts) {
            setPanelCounts(pollResult.output_data.panelCounts);
          }
          return;
        }
        attempts++;
      }
      alert('Timed out while regenerating the page.');
      return;
    }
      const totalPanels = panelCounts[pageKey] || 5;
      const pageType = pageKey === 'cover' ? 'cover' : 'story';
      const panelCoordinates = calculatePanelCoordinates(panelNumber, totalPanels, pageType);

      console.log(`Editing ${pageKey}, panel ${panelNumber}/${totalPanels}`, panelCoordinates);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-comic-page`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId, pageKey, userPrompt, panelNumber, panelCoordinates })
      });

      const result = await response.json();
      if (result.success) {
        // Poll for updated page
        const maxAttempts = 60;
        let attempts = 0;

        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));

          const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId })
          });

          const statusResult = await statusResponse.json();
          if (statusResult.success && statusResult.output_data?.generatedPages) {
            const updatedPages = statusResult.output_data.generatedPages;
            // Keep original pages if they don't exist yet
            setOriginalPages(prev => {
              const updated = { ...prev };
              Object.keys(updatedPages).forEach(key => {
                if (!updated[key]) {
                  updated[key] = updatedPages[key];
                }
              });
              return updated;
            });
            setGeneratedPages(updatedPages);
            setPageApprovals(statusResult.page_approvals || {});
            if (statusResult.output_data?.panelCounts) {
              setPanelCounts(statusResult.output_data.panelCounts);
            }
            return;
          }

          attempts++;
        }
      } else {
        alert(result.error || 'Error editing page. Please try again.');
      }
    } catch (error) {
      console.error('Error editing page:', error);
      alert('Error editing page. Please try again.');
    }
  };

  const handleFinalizeAll = async () => {
    if (!jobId) return;

    try {
      setIsFinalizingPdf(true);
      setStatus('generating');
      setProgress(85);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finalize-approved-comic`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId })
      });

      const result = await response.json();
      if (!result.success) {
        const errorMsg = result.missingApprovals
          ? `Not all pages were confirmed. Missing confirmations: ${result.missingApprovals.join(', ')}`
          : result.error || 'Error finalizing comic';
        throw new Error(errorMsg);
      }

      // Poll for completion
      const maxAttempts = 60;
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        const statusResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-job-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId })
        });

        const statusResult = await statusResponse.json();

        if (statusResult.status === 'completed') {
          setProgress(100);
          setGeneratedComic(statusResult.output_data?.comicUrl || '');
          const coverPath = statusResult.output_data?.generatedPages?.cover;
          if (coverPath) {
            const publicUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comics/${coverPath}`;
            setGeneratedImage(publicUrl);
          }
          setGeneratedCoverPdfUrl(statusResult.output_data?.coverUrl || '');
          setGeneratedInteriorPdfUrl(statusResult.output_data?.interiorUrl || '');
          setStatus('completed');
          setIsFinalizingPdf(false);
          setShowPagePreviewModal(false);
          return;
        } else if (statusResult.status === 'failed') {
          throw new Error(statusResult.error_message || 'PDF creation failed');
        }

        if (statusResult.progress) {
          setProgress(statusResult.progress);
        }

        attempts++;
      }

      throw new Error('PDF creation timed out');
    } catch (error) {
      console.error('Error finalizing comic:', error);
      setIsFinalizingPdf(false);
      setStatus('awaiting_approval');
      setShowPagePreviewModal(true);
      const errorMessage = error instanceof Error ? error.message : 'Error creating PDF. Please try again.';
      alert(errorMessage);
    }
  };

  const downloadComic = () => {
    if (generatedComic) {
      // Fetch the PDF and trigger download
      fetch(generatedComic)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
         link.download = `${comicData.comicTitle || comicData.heroName}-Comic.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Download failed:', error);
          // Fallback to opening in new tab
          window.open(generatedComic, '_blank');
        });
    }
  };

  if (status === 'generating') {
    const isGerman = comicData.storyLanguage === 'de';

    if (isFinalizingPdf) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8 border-2 border-green-200">
              <div className="relative">
                <div className="w-20 sm:w-24 h-20 sm:h-24 mx-auto relative">
                  <div className="absolute inset-0 border-4 border-green-200 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-green-600 rounded-full border-t-transparent animate-spin"></div>
                  <CheckCircle className="w-10 sm:w-12 h-10 sm:h-12 text-green-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-4">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                  {isGerman ? 'Comic wird finalisiert' : 'Finalizing Your Comic'}
                </h1>
                <p className="text-lg sm:text-xl text-gray-600 px-4">
                  {isGerman
                    ? 'Dein Comic wird jetzt fertiggestellt und steht in Kürze zur Verfügung'
                    : 'Your comic is being finalized and will be ready shortly'}
                </p>
                <div className="bg-green-50 border-2 border-green-400 rounded-xl p-3 sm:p-4 mx-4">
                  <p className="text-sm sm:text-base text-green-900 font-medium">
                    {isGerman
                      ? 'Das fertige Comic wird automatisch im Dashboard verfügbar sein'
                      : 'The finished comic will be automatically available in your dashboard'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-600 to-blue-600 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-center text-sm text-gray-600">
                  <span className="text-xs sm:text-sm">{Math.round(progress)}% {isGerman ? 'abgeschlossen' : 'complete'}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">
            <div className="relative">
              <div className="w-20 sm:w-24 h-20 sm:h-24 mx-auto relative">
                <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
                <RefreshCw className="w-10 sm:w-12 h-10 sm:h-12 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                {isGerman ? 'Dein Comic wird erstellt' : 'Creating Your Comic Book'}
              </h1>
              <p className="text-lg sm:text-xl text-gray-600 px-4">
                {isGerman
                  ? `Unsere KI erstellt dein personalisiertes Abenteuer mit ${comicData.heroName}`
                  : `Our AI is crafting your personalized adventure with ${comicData.heroName}`}
              </p>
              <div className="bg-blue-50 border-2 border-blue-400 rounded-xl p-3 sm:p-4 mx-4">
                <p className="text-sm sm:text-base text-blue-900 font-medium">
                  {isGerman
                    ? 'Die Vorschau wird generiert und ist anschließend im Dashboard verfügbar'
                    : 'A preview is being generated and will be available in your dashboard'}
                </p>
              </div>
              <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 sm:p-4 mx-4">
                <p className="text-sm sm:text-base text-amber-900 font-medium flex items-center justify-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <span>
                    {isGerman
                      ? 'Bitte halte dieses Fenster während der Generierung geöffnet'
                      : 'Please keep this window open during generation'}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-blue-600 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span className="text-xs sm:text-sm">{Math.round(progress)}% {isGerman ? 'abgeschlossen' : 'complete'}</span>
                <span className="text-xs sm:text-sm">
                  {isGerman ? 'ca. ' : 'Est. '}{formatTime(estimatedTime)} {isGerman ? 'verbleibend' : 'remaining'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                {isGerman ? 'Charakter erstellt' : 'Character generated'}
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                {isGerman ? 'Stil angewandt' : 'Style applied'}
              </div>
              <div className="flex items-center gap-2">
                {progress > 50 ? (
                  <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                ) : (
                  <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-500 animate-spin" />
                )}
                {isGerman ? 'Geschichte erstellen' : 'Story creation'}
              </div>
              <div className="flex items-center gap-2">
                {progress > 80 ? (
                  <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                ) : (
                  <div className="w-4 sm:w-5 h-4 sm:h-5 border-2 border-gray-300 rounded-full" />
                )}
                {isGerman ? 'Finaler Render' : 'Final rendering'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-12 space-y-6 sm:space-y-8">
            <AlertCircle className="w-20 sm:w-24 h-20 sm:h-24 text-red-600 mx-auto" />
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Generation Failed</h1>
              <p className="text-lg sm:text-xl text-gray-600 px-4">
                We encountered an issue creating your comic.
              </p>
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mx-4">
                <p className="text-green-800 font-semibold flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Your credits have been refunded
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={onBack}
                className="px-6 sm:px-8 py-3 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-xl hover:from-red-700 hover:to-blue-700 transition-all font-semibold text-sm sm:text-base"
              >
                Return to Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onStartOver}
              className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm sm:text-base"
            >
              <ArrowLeft size={16} className="sm:w-5 sm:h-5" />
              Create Another Comic
            </button>
            <div className="text-xs sm:text-sm text-gray-600">
              Generation Complete
            </div>
          </div>
        </div>
      </div>

      {/* Success Content */}
      <div className="py-4 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="text-center mb-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 px-4">
              {isGerman ? 'Dein Comic ist fertig!' : 'Your Comic is Complete!'}
            </h1>
            <p className="text-base sm:text-lg text-gray-600 px-4">
              {isGerman
                ? <><strong>{comicData.heroName}s</strong> Abenteuer ist bereit. Wähle aus, wie du es genießen möchtest.</>
                : <><strong>{comicData.heroName}</strong>'s adventure is ready. Choose how you'd like to enjoy it.</>
              }
            </p>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Left Column - Comic Preview & Download */}
            <div className="space-y-6">
              {/* Comic Cover Preview */}
              <div className="flex justify-center">
                <div className="relative transform hover:scale-105 transition-transform duration-300">
                  <div className="w-64 sm:w-80 shadow-2xl rounded-lg overflow-hidden">
                    {generatedImage ? (
                      <img
                        src={generatedImage}
                        alt="Generated Comic Cover"
                        className="w-full h-auto object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gradient-to-br from-red-600 to-blue-600 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="text-4xl mb-2">📚</div>
                          <div className="text-lg font-bold">Your Comic</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Download Button */}
              <div>
                <button
                  onClick={downloadComic}
                  className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-xl hover:from-red-700 hover:to-blue-700 transition-all font-bold shadow-lg text-lg transform hover:scale-105"
                >
                  <Download className="w-6 h-6" />
                  {isGerman ? 'Comic herunterladen (PDF)' : 'Download Your Comic (PDF)'}
                </button>
                <p className="text-center text-sm text-gray-500 mt-2">
                  {isGerman ? 'Kostenlos • Sofort • Hohe Qualität' : 'Free • Instant • High Quality'}
                </p>
              </div>
            </div>

            {/* Right Column - Comic Shop */}
            <div>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-2xl overflow-hidden border-4 border-purple-300 relative h-full">
                <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold shadow-md z-10">
                  {isGerman ? 'Premium Option' : 'Premium Option'}
                </div>
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-6">
                  <div className="flex items-center gap-4">
                    <ShoppingCart className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">{isGerman ? 'Comic Shop' : 'Comic Shop'}</h2>
                      <p className="text-blue-50">{isGerman ? 'Dein Comic als echtes Buch' : 'Get Your Comic as a Real Book'}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="bg-white border-2 border-purple-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <ShoppingCart className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-purple-900 text-lg">
                          {isGerman ? 'Upgrade zum gedruckten Comic' : 'Upgrade to Physical Print'}
                        </p>
                        <p className="text-purple-700 mt-1">
                          {isGerman
                            ? 'Verwandle dein digitales Comic in ein professionell gedrucktes Buch, das du für immer in den Händen halten kannst.'
                            : 'Transform your digital comic into a professionally printed, hold-in-your-hands book that will last forever.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                      <span className="text-purple-600">✓</span> {isGerman ? 'Das erhältst du:' : 'What You\'ll Receive:'}
                    </h3>
                    <ul className="space-y-2 text-gray-700 pl-6">
                      <li className="flex items-center gap-2">
                        <span className="text-purple-600">•</span>
                        <span>
                          {isGerman
                            ? <><strong>Professionelle Druckqualität</strong> - lebendige Farben auf Premiumpapier</>
                            : <><strong>Professional print quality</strong> - vibrant colors on premium paper</>
                          }
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-purple-600">•</span>
                        <span>
                          {isGerman
                            ? <><strong>Robustes Glanzcover</strong> - geschützt und wunderschön</>
                            : <><strong>Durable glossy cover</strong> - protected and beautiful</>
                          }
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-purple-600">•</span>
                        <span>
                          {isGerman
                            ? <><strong>Perfect-gebundene Seiten</strong> - wie ein echtes Comic aus der Buchhandlung</>
                            : <><strong>Perfect-bound pages</strong> - like a real bookstore comic</>
                          }
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-purple-600">•</span>
                        <span>
                          {isGerman
                            ? <><strong>Direkt zu dir nach Hause</strong> - bereit zum Lesen und Schätzen</>
                            : <><strong>Delivered to your door</strong> - ready to read and treasure</>
                          }
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-5 border-2 border-purple-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-lg font-semibold text-gray-700">{isGerman ? 'Preis:' : 'Price:'}</span>
                      <span className="text-4xl font-bold text-purple-900">€39.00</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {isGerman
                        ? 'Lieferung: 7-14 Werktage • Versand nach DE/CH/AT'
                        : 'Delivery: 7-14 business days • Ships to DE/CH/AT'}
                    </p>
                  </div>

                  <button
                    onClick={() => setShowPhysicalOrderModal(true)}
                    className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all font-bold shadow-xl text-xl transform hover:scale-105"
                  >
                    <ShoppingCart className="w-6 h-6" />
                    {isGerman ? 'Jetzt gedruckte Version bestellen' : 'Order Physical Copy Now'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Create Another Comic Button */}
          <div className="flex justify-center">
            <button
              onClick={onStartOver}
              className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all font-semibold transform hover:scale-105"
            >
              {isGerman ? 'Weiteres Comic erstellen' : 'Create Another Comic'}
            </button>
          </div>
        </div>

        {/* Physical Order Modal */}
        <PhysicalOrderModal
          isOpen={showPhysicalOrderModal}
          onClose={() => setShowPhysicalOrderModal(false)}
          interiorPdfUrl={generatedInteriorPdfUrl || ''}
          coverPdfUrl={generatedCoverPdfUrl || ''}
          comicTitle={comicData.comicTitle}
          heroName={comicData.heroName}
        />

        {/* Page Preview Modal */}
        {showPagePreviewModal && jobId && (
          <PagePreviewModal
            jobId={jobId}
            generatedPages={generatedPages}
            originalPages={originalPages}
            pageApprovals={pageApprovals}
            panelCounts={panelCounts}
            onApprove={handleApprovePage}
            onUnapprove={handleUnapprovePage}
            onEdit={handleEditPage}
            onFinalizeAll={handleFinalizeAll}
          />
        )}
      </div>
    </div>
  );
};

export default GenerationPage;