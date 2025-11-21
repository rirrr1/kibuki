import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Configurator from './components/Configurator';
import GenerationPage from './components/GenerationPage';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import SuccessPage from './components/SuccessPage';
import PhysicalSuccessPage from './components/PhysicalSuccessPage';
import CookieConsent from './components/CookieConsent';
import EmailVerificationBanner from './components/EmailVerificationBanner';
import { CheckCircle } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

type AppSection = 'landing' | 'configurator' | 'generation';

interface ComicData {
  heroName: string;
  comicTitle: string;
  photo: File | null;
  photoPreview: string | null;
  characterStyle: string;
  customStyle: string;
  storyDescription: string;
  illustrationStyle: string;
  storyLanguage?: 'en' | 'de';
}

function LangRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const langParam = params.get('lang');

    if (langParam === 'en') {
      const newPath = location.pathname === '/' ? '/en' : `/en${location.pathname}`;
      navigate(newPath, { replace: true });
    } else if (langParam === 'de') {
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  return null;
}

function App() {
  const [currentSection, setCurrentSection] = useState<AppSection>('landing');
  const [comicData, setComicData] = useState<ComicData | null>(null);
  const [resumeJobId, setResumeJobId] = useState<string | null>(null);
  const [showConfirmationSuccess, setShowConfirmationSuccess] = useState(false);
  const [showCreditPurchaseSuccess, setShowCreditPurchaseSuccess] = useState(false);
  const [shouldReopenCreditModal, setShouldReopenCreditModal] = useState(false);
  const { user, isEmailConfirmed, credits, refreshCredits } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');

    if (type === 'signup' && user && isEmailConfirmed) {
      setShowConfirmationSuccess(true);
      setTimeout(() => {
        setShowConfirmationSuccess(false);
      }, 5000);
    }
  }, [user, isEmailConfirmed, location]);

  useEffect(() => {
    const purchaseStatus = searchParams.get('purchase');
    const returnTo = searchParams.get('return');

    if (purchaseStatus === 'success' && returnTo === 'configurator') {
      console.log('Detected credit purchase success, restoring configurator state...');

      try {
        const savedState = sessionStorage.getItem('pendingCreditPurchase');
        if (savedState) {
          const { comicData: savedComicData, timestamp, fromConfigurator } = JSON.parse(savedState);

          const hoursSinceLastSave = (Date.now() - timestamp) / (1000 * 60 * 60);
          if (hoursSinceLastSave < 24 && fromConfigurator) {
            console.log('Restoring comic data:', savedComicData);
            setComicData(savedComicData);
            setCurrentSection('configurator');
            setShowCreditPurchaseSuccess(true);

            refreshCredits();

            const checkCreditsInterval = setInterval(() => {
              refreshCredits();
            }, 2000);

            setTimeout(() => {
              clearInterval(checkCreditsInterval);
              setShouldReopenCreditModal(true);
              setShowCreditPurchaseSuccess(false);
            }, 5000);

            sessionStorage.removeItem('pendingCreditPurchase');

            window.history.replaceState({}, '', window.location.pathname);
          } else {
            console.log('Saved state expired or invalid, clearing...');
            sessionStorage.removeItem('pendingCreditPurchase');
          }
        }
      } catch (error) {
        console.error('Failed to restore configurator state:', error);
        sessionStorage.removeItem('pendingCreditPurchase');
      }
    }
  }, [searchParams, refreshCredits]);

  useEffect(() => {
    const storedResumeJobId = sessionStorage.getItem('resumeJobId');
    const locationResumeJobId = (location.state as any)?.resumeJobId;
    const jobIdToResume = locationResumeJobId || storedResumeJobId;

    if (jobIdToResume && user) {
      console.log('Detected resumeJobId, loading job details...', jobIdToResume);

      const loadJobAndResume = async () => {
        try {
          const { data: job, error } = await supabase
            .from('comic_generation_jobs')
            .select('*')
            .eq('id', jobIdToResume)
            .eq('user_id', user.id)
            .single();

          if (error || !job) {
            console.error('Failed to load job:', error);
            alert('Could not load the comic. It may have been deleted or you do not have access to it.');
            sessionStorage.removeItem('resumeJobId');
            return;
          }

          console.log('Job loaded:', job);

          const inputData = job.input_data || {};

          const resumedComicData: ComicData = {
            heroName: inputData.heroName || '',
            comicTitle: inputData.comicTitle || '',
            photo: null,
            photoPreview: null,
            characterStyle: inputData.characterStyle || '',
            customStyle: inputData.customStyle || '',
            storyDescription: inputData.storyDescription || '',
            illustrationStyle: inputData.illustrationStyle || '',
            storyLanguage: inputData.storyLanguage || 'de',
          };

          console.log('Resuming with comic data:', resumedComicData);
          setComicData(resumedComicData);
          setResumeJobId(jobIdToResume);
          setCurrentSection('generation');

          sessionStorage.removeItem('resumeJobId');
        } catch (error) {
          console.error('Error loading job for resume:', error);
          alert('An error occurred while loading your comic. Please try again from the dashboard.');
          sessionStorage.removeItem('resumeJobId');
        }
      };

      loadJobAndResume();
    }
  }, [user, location.state]);

  const handleCreateComic = () => {
    setCurrentSection('configurator');
  };

  const handleBackToLanding = () => {
    setCurrentSection('landing');
  };

  const handleGenerateComic = (data: ComicData) => {
    setComicData(data);
    setCurrentSection('generation');
  };

  const handleStartOver = () => {
    setComicData(null);
    setCurrentSection('landing');
  };

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'landing':
        return <LandingPage onCreateComic={handleCreateComic} />;
      case 'configurator':
        return (
          <Configurator
            onBack={handleBackToLanding}
            onGenerate={handleGenerateComic}
            shouldReopenCreditModal={shouldReopenCreditModal}
            onCreditModalOpened={() => setShouldReopenCreditModal(false)}
          />
        );
      case 'generation':
        return comicData ? (
          <GenerationPage
            comicData={comicData}
            onBack={() => setCurrentSection('configurator')}
            onStartOver={handleStartOver}
            preExistingJobId={resumeJobId}
          />
        ) : null;
      default:
        return <LandingPage onCreateComic={handleCreateComic} />;
    }
  };

  return (
    <>
      <LangRedirect />
      <EmailVerificationBanner />
      <CookieConsent />

      {showConfirmationSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border-2 border-green-500 rounded-xl shadow-lg p-4 max-w-md animate-slide-in">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-1">Email Verified!</h3>
              <p className="text-sm text-green-800">
                Your email has been successfully verified. Welcome to MyComic-Book! You received 100 free credits to get started.
              </p>
            </div>
            <button
              onClick={() => setShowConfirmationSuccess(false)}
              className="flex-shrink-0 text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showCreditPurchaseSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-yellow-50 border-2 border-yellow-500 rounded-xl shadow-lg p-4 max-w-md animate-slide-in">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 mb-1">Credits Purchased!</h3>
              <p className="text-sm text-yellow-800">
                Your credits have been added! Refreshing your balance... You can now generate your comic.
              </p>
            </div>
          </div>
        </div>
      )}

      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/success" element={
          <SuccessPage />
        } />
        <Route path="/physical-success" element={
          <PhysicalSuccessPage />
        } />
        <Route path="/en/dashboard" element={<Dashboard />} />
        <Route path="/en/admin" element={<AdminDashboard />} />
        <Route path="/en/success" element={<SuccessPage />} />
        <Route path="/en/physical-success" element={<PhysicalSuccessPage />} />
        <Route path="/en" element={renderCurrentSection()} />
        <Route path="/so-funktioniert-es" element={<Navigate to="/" replace />} />
        <Route path="/pricing" element={<Navigate to="/" replace />} />
        <Route path="/examples" element={<Navigate to="/" replace />} />
        <Route path="/faq" element={<Navigate to="/" replace />} />
        <Route path="/" element={renderCurrentSection()} />
      </Routes>
    </>
  );
}

export default App;