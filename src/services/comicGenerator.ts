import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, ShoppingCart, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { comicGeneratorService } from '../services/comicGenerator';
import PhysicalOrderModal from './PhysicalOrderModal';

interface ComicData {
  heroName: string;
  comicTitle: string;
  photo: File | null;
  photoPreview: string | null;
  characterStyle: string;
  customStyle: string;
  storyDescription: string;
  illustrationStyle: string;
  customerEmail?: string;
}

interface GenerationPageProps {
  comicData: ComicData;
  onBack: () => void;
  onStartOver: () => void;
}

type GenerationStatus = 'generating' | 'completed' | 'error';

const GenerationPage: React.FC<GenerationPageProps> = ({ comicData, onBack, onStartOver }) => {
  const [status, setStatus] = useState<GenerationStatus>('generating');
  const [progress, setProgress] = useState(0);
  const [generatedComic, setGeneratedComic] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedCoverPdfUrl, setGeneratedCoverPdfUrl] = useState<string | null>(null);
  const [generatedInteriorPdfUrl, setGeneratedInteriorPdfUrl] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState(420); // seconds
  const [showPhysicalOrderModal, setShowPhysicalOrderModal] = useState(false);

  // Add ref to prevent multiple calls
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    if (!hasGeneratedRef.current) {
      generateComic();
    }
  }, [comicData]);

  const generateComic = async () => {
    if (hasGeneratedRef.current) return;
    hasGeneratedRef.current = true;

    try {
      setStatus('generating');
      setProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 4;
        });
      }, 1000);

      // Simulate time countdown
      const timeInterval = setInterval(() => {
        setEstimatedTime(prev => Math.max(0, prev - 1));
      }, 1000);

      console.log('Starting comic generation...');
      // Call the actual comic generation service
      const result = await comicGeneratorService.generateComic({
        heroName: comicData.heroName,
        comicTitle: comicData.comicTitle,
        photo: comicData.photo!,
        characterStyle: comicData.characterStyle,
        customStyle: comicData.customStyle,
        storyDescription: comicData.storyDescription,
        illustrationStyle: comicData.illustrationStyle,
        customerEmail: comicData.customerEmail
      });
      
      clearInterval(progressInterval);
      clearInterval(timeInterval);
      
      console.log('Comic generation result:', result);
      
      if (result.success) {
        console.log('Generation successful, setting completed state');
        setProgress(100);
        setGeneratedComic(result.comicUrl!);
        setGeneratedImage(result.coverImageUrl || '');
        setGeneratedCoverPdfUrl(result.coverUrl!);
        setGeneratedInteriorPdfUrl(result.interiorUrl!);
        setStatus('completed');
      } else {
        console.error('Generation failed with error:', result.error);
        throw new Error(result.error);
      }
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
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Creating Your Comic Book</h1>
              <p className="text-lg sm:text-xl text-gray-600 px-4">
                Our AI is crafting your personalized adventure with <strong>{comicData.heroName}</strong>
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-blue-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span className="text-xs sm:text-sm">{Math.round(progress)}% complete</span>
                <span className="text-xs sm:text-sm">Est. {formatTime(estimatedTime)} remaining</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                Character generated
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                Style applied
              </div>
              <div className="flex items-center gap-2">
                {progress > 50 ? (
                  <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                ) : (
                  <RefreshCw className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-500 animate-spin" />
                )}
                Story creation
              </div>
              <div className="flex items-center gap-2">
                {progress > 80 ? (
                  <CheckCircle className="w-4 sm:w-5 h-4 sm:h-5 text-green-500" />
                ) : (
                  <div className="w-4 sm:w-5 h-4 sm:h-5 border-2 border-gray-300 rounded-full" />
                )}
                Final rendering
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
                We encountered an issue creating your comic. Please try again.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <button
                onClick={generateComic}
                className="px-6 sm:px-8 py-2 sm:py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm sm:text-base"
              >
                Try Again
              </button>
              <button
                onClick={onBack}
                className="px-6 sm:px-8 py-2 sm:py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 transition-colors text-sm sm:text-base"
              >
                Go Back
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="text-center mb-6 sm:mb-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 px-4">Your Comic is Ready!</h1>
            <p className="text-base sm:text-lg text-gray-600 px-4">
              <strong>{comicData.heroName}</strong> is ready for action in their personalized adventure
            </p>
          </div>

          {/* Comic Book Style Container */}
          <div className="flex flex-col items-center space-y-6">
                {/* Comic Cover */}
                <div className="relative transform hover:scale-105 transition-transform duration-300">
                  <div className="aspect-[2/3] w-48 sm:w-64 lg:w-72 shadow-xl rounded-lg overflow-hidden">
                    {generatedImage ? (
                      <img 
                        src={generatedImage} 
                        alt="Generated Comic Cover"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-red-600 to-blue-600 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="text-4xl mb-2">📚</div>
                          <div className="text-lg font-bold">Your Comic</div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Comic book shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white to-transparent opacity-20 rounded-lg"></div>
                </div>
                
                {/* Action Buttons */}
                <div className="w-full max-w-sm space-y-3">
                  <button
                    onClick={downloadComic}
                    className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-lg hover:from-red-700 hover:to-blue-700 transition-all font-medium shadow-lg text-sm sm:text-base transform hover:scale-105"
                  >
                    <Download size={16} className="sm:w-5 sm:h-5" />
                    Download Digital Copy (PDF)
                  </button>
                  
                  <div className="text-center text-gray-600 text-xs">
                    Instant download • High quality PDF • Print at home
                  </div>
                  
                  <button
                    onClick={() => setShowPhysicalOrderModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-lg text-sm sm:text-base transform hover:scale-105"
                  >
                    <ShoppingCart size={16} className="sm:w-5 sm:h-5" />
                    Order Physical Copy
                  </button>
                  
                  <div className="text-center text-gray-600 text-xs">
                    Premium printing • 7-14 business days • €39.00 • DE/CH/AT only
                  </div>
                  
                  <button
                    onClick={onStartOver}
                    className="w-full px-4 sm:px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-medium mt-3 text-sm sm:text-base transform hover:scale-105"
                  >
                    Create Another Comic
                  </button>
                </div>
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
      </div>
    </div>
  );
};

export default GenerationPage;