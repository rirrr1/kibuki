import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Package, RefreshCw, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GenerationPage from './GenerationPage';

interface ComicData {
  heroName: string;
  comicTitle: string;
  photo: File | null;
  photoPreview: string | null;
  characterStyle: string;
  customStyle: string;
  storyDescription: string;
  illustrationStyle: string;
}

const SuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const purchaseType = searchParams.get('purchase'); // 'success' for credit purchase
  const urlJobId = searchParams.get('job_id');
  const [loading, setLoading] = useState(true);
  const [jobId, setJobId] = useState<string | null>(urlJobId);
  const [comicData, setComicData] = useState<ComicData | null>(null);
  const [showGeneration, setShowGeneration] = useState(false);
  const [conversionFired, setConversionFired] = useState(false);
  const [creditsPurchased, setCreditsPurchased] = useState(false);
  const { credits, refreshCredits } = useAuth();

  useEffect(() => {
    // Fire Google Ads conversion event once
    if (!conversionFired && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-962918984/rcWsCKP3wrEbEMj0k8sD',
        'value': 1.0,
        'currency': 'CHF',
        'transaction_id': sessionId || ''
      });
      setConversionFired(true);
      console.log('Google Ads conversion event fired');
    }

    // Handle credit purchase success
    if (purchaseType === 'success') {
      console.log('Credit purchase detected, refreshing credits...');
      setCreditsPurchased(true);

      // Refresh credits after a short delay to allow webhook to process
      const refreshTimer = setTimeout(() => {
        refreshCredits();
      }, 2000);

      // Keep refreshing every 3 seconds for up to 15 seconds in case webhook is slow
      const maxRetries = 5;
      let retries = 0;
      const retryInterval = setInterval(() => {
        retries++;
        if (retries >= maxRetries) {
          clearInterval(retryInterval);
        } else {
          refreshCredits();
        }
      }, 3000);

      setLoading(false);

      return () => {
        clearTimeout(refreshTimer);
        clearInterval(retryInterval);
      };
    }

    // Check for temporary comic data from server
    const tempId = searchParams.get('temp_id');
    
    if (tempId) {
      try {
        console.log('Retrieving comic data from server with temp ID:', tempId);
        
        const retrieveData = async () => {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-temp-comic-data`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              action: 'retrieve',
              sessionId: tempId
            })
          });

          if (!response.ok) {
            throw new Error('Failed to retrieve comic data');
          }

          const { comicData: parsedComicData, photoData, checkoutData: parsedCheckoutData } = await response.json();
        
          // Reconstruct File object from base64
          if (photoData && !parsedComicData.photo) {
            const base64Data = photoData.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const reconstructedFile = new File([byteArray], parsedComicData.photoName || 'photo.jpg', {
            type: parsedComicData.photoType || 'image/jpeg'
          });
          
          parsedComicData.photo = reconstructedFile;
            parsedComicData.photoPreview = photoData;
          
          // Clean up the temporary properties
          delete parsedComicData.photoName;
          delete parsedComicData.photoType;
        }
        
        // Add customer email from checkout data if available
        if (parsedCheckoutData?.email) {
          parsedComicData.customerEmail = parsedCheckoutData.email;
          console.log('Customer email found in checkout data:', parsedCheckoutData.email);
        } else {
          console.log('No customer email found in checkout data');
        }
        
        setComicData(parsedComicData);
        console.log('Comic data set, starting job creation...');
        };
        
        retrieveData().then(() => {
          console.log('Comic data retrieved successfully');
        }).catch((error) => {
          console.error('Failed to retrieve comic data:', error);
        });
        
        // Show generation page after a short delay
        const timer = setTimeout(() => {
          setLoading(false);
          setShowGeneration(true);
        }, 2000);
        
        return () => clearTimeout(timer);
      } catch (error) {
        console.error('Failed to retrieve comic data:', error);
      }
    }
    
    // Fallback: just show success page
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleStartOver = () => {
    window.location.href = '/';
  };

  // If we have comic data and should show generation, render the generation page
  if (showGeneration && comicData) {
    return (
      <GenerationPage
        comicData={comicData}
        onBack={() => setShowGeneration(false)}
        onStartOver={handleStartOver}
        preExistingJobId={jobId}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 mx-auto relative">
              <div className="absolute inset-0 border-4 border-red-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
              <RefreshCw className="w-12 h-12 text-red-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-6 mb-2">Payment Successful!</h2>
          <p className="text-gray-600 text-lg">{creditsPurchased ? 'Processing your credits...' : 'Starting comic generation...'}</p>
        </div>
      </div>
    );
  }

  // Show credit purchase success page
  if (creditsPurchased) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="mb-8">
            <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Credits Purchased!</h1>
            <p className="text-xl text-gray-600 mb-4">
              Thank you for your purchase! Your credits have been added to your account.
            </p>
            {sessionId && (
              <p className="text-sm text-gray-500 mb-4">
                Order ID: {sessionId.slice(-8).toUpperCase()}
              </p>
            )}

            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-300 px-6 py-4 rounded-xl">
              <Coins className="w-8 h-8 text-yellow-600" />
              <div className="text-left">
                <p className="text-sm text-yellow-700 font-medium">Your Credit Balance</p>
                <p className="text-3xl font-bold text-yellow-900">{credits}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Package className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-blue-900">What You Can Do Now</h3>
            </div>
            <div className="text-blue-800 space-y-2">
              <p>• Generate a full comic: 100 credits</p>
              <p>• Regenerate any page: 10 credits per page</p>
              <p>• Your credits never expire</p>
              <p>• Failed generations are automatically refunded</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-blue-700 transition-colors"
            >
              Start Creating Comics
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Need help? Contact our support team at{' '}
              <a href="mailto:support@mycomic-book.com" className="text-blue-600 hover:text-blue-700">
                support@mycomic-book.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-8">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Payment Successful!</h1>
          {comicData ? (
            <p className="text-xl text-gray-600 mb-2">
              Thank you for your purchase! Your comic generation will start shortly.
            </p>
          ) : (
            <p className="text-xl text-gray-600 mb-2">
              Thank you for your purchase. Your order has been confirmed.
            </p>
          )}
          {sessionId && (
            <p className="text-sm text-gray-500">
              Order ID: {sessionId.slice(-8).toUpperCase()}
            </p>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Package className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">{comicData ? "What's Happening?" : "What's Next?"}</h3>
          </div>
          <div className="text-green-800 space-y-2">
            {comicData ? (
              <>
                <p>• Your comic is being generated with AI</p>
                <p>• This process takes about 2-3 minutes</p>
                <p>• You'll be able to download it immediately when ready</p>
              </>
            ) : (
              <>
                <p>• You'll receive a confirmation email shortly</p>
                <p>• Digital products are available immediately</p>
                <p>• Physical products will be shipped within 3-5 business days</p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {comicData && (
            <button
              onClick={() => setShowGeneration(true)}
              className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
            >
              Start Generation Now
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors"
          >
            {comicData ? 'Create Another Comic' : 'Continue Shopping'}
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@mycomic-book.com" className="text-green-600 hover:text-green-700">
              support@mycomic-book.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessPage;