import React, { useState } from 'react';
import { ArrowLeft, Upload, User, Palette, FileText, Eye, Wand2, BookOpen, CheckCircle, ArrowRight, CreditCard as Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { CREDIT_COSTS } from '../stripe-config';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LanguageSelector from './LanguageSelector';
import AuthModal from './AuthModal';
import CreditConfirmationModal from './CreditConfirmationModal';
import CreditPurchaseModal from './CreditPurchaseModal';

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
}

interface ConfiguratorProps {
  onBack: () => void;
  onGenerate: (data: ComicData) => void;
  shouldReopenCreditModal?: boolean;
  onCreditModalOpened?: () => void;
}

type Step = 'basic' | 'photo' | 'character' | 'story' | 'illustration' | 'review';


const Configurator: React.FC<ConfiguratorProps> = ({ onBack, onGenerate, shouldReopenCreditModal, onCreditModalOpened }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, credits, refreshCredits } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>('basic');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreditConfirmation, setShowCreditConfirmation] = useState(false);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);
  const [comicData, setComicData] = useState<ComicData>({
    heroName: '',
    comicTitle: '',
    photo: null,
    photoPreview: null,
    characterStyle: '',
    customStyle: '',
    storyDescription: '',
    illustrationStyle: '',
    storyLanguage: 'de'
  });

  const characterStyles = [
    { id: 'comic_hero', name: t('config.character.superhero'), icon: '🦸', description: t('config.character.superhero.desc') },
    { id: 'comic_adventurer', name: t('config.character.adventurer'), icon: '🏕️', description: t('config.character.adventurer.desc') },
    { id: 'princess', name: t('config.character.princess'), icon: '👸', description: t('config.character.princess.desc') },
    { id: 'fighter', name: t('config.character.fighter'), icon: '⚔️', description: t('config.character.fighter.desc') },
    { id: 'magician', name: t('config.character.magician'), icon: '🧙', description: t('config.character.magician.desc') },
    { id: 'custom', name: t('config.character.custom'), icon: '✨', description: t('config.character.custom.desc') }
  ];

  const illustrationStyles = [
    {
      id: 'DC, Marvel hero comic style',
      name: t('config.illustration.superhero'),
      description: t('config.illustration.superhero.desc'),
      preview: '/superhero.png?v=1'
    },
    {
      id: 'cartoon',
      name: t('config.illustration.cartoon'),
      description: t('config.illustration.cartoon.desc'),
      preview: '/pixar.png?v=1'
    },
    {
      id: 'manga_anime',
      name: t('config.illustration.manga'),
      description: t('config.illustration.manga.desc'),
      preview: '/manga.png?v=1'
    }
  ];

  const steps = [
    { id: 'basic', name: t('config.step.basic'), icon: '👤', description: t('config.step.basic.desc') },
    { id: 'photo', name: t('config.step.photo'), icon: '📸', description: t('config.step.photo.desc') },
    { id: 'character', name: t('config.step.character'), icon: '🎭', description: t('config.step.character.desc') },
    { id: 'story', name: t('config.step.story'), icon: '📝', description: t('config.step.story.desc') },
    { id: 'illustration', name: t('config.step.illustration'), icon: '🎨', description: t('config.step.illustration.desc') },
    { id: 'review', name: t('config.step.review'), icon: '👁️', description: t('config.step.review.desc') }
  ];

  const exampleStory = 'Tom sitzt zu Hause und schaut seine Lieblingsserie "Superhero", als er plötzlich in die Sendung hineingezogen wird. Dort ist er selbst der Held und erfährt, dass ein Bösewicht alle Burger der Stadt gestohlen hat. Tom sucht ihn, findet ihn schließlich und besiegt ihn im Kampf. Dann wird er zurückgezogen, wacht auf dem Sofa auf – mit einem Burger in der Hand – und fragt sich, ob alles nur ein Traum war.';

  React.useEffect(() => {
    if (shouldReopenCreditModal && credits >= CREDIT_COSTS.FULL_COMIC) {
      console.log('Reopening credit confirmation modal after purchase');
      setShowCreditConfirmation(true);
      setCurrentStep('review');
      if (onCreditModalOpened) {
        onCreditModalOpened();
      }
    }
  }, [shouldReopenCreditModal, credits, onCreditModalOpened]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a new File object to avoid reference issues
      const newFile = new File([file], file.name, { type: file.type });
      setComicData(prev => ({ ...prev, photo: newFile }));
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setComicData(prev => ({ ...prev, photoPreview: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getCompletionStatus = () => {
    return {
      basic: comicData.heroName.trim().length > 0 && comicData.comicTitle.trim().length > 0,
      photo: comicData.photo !== null,
      character: comicData.characterStyle !== '' && (comicData.characterStyle !== 'custom' || comicData.customStyle.trim() !== ''),
      story: comicData.storyDescription.trim().length > 0 && comicData.storyLanguage !== '',
      illustration: comicData.illustrationStyle !== ''
    };
  };

  const completionStatus = getCompletionStatus();
  const allCompleted = Object.values(completionStatus).every(Boolean);
  const completedCount = Object.values(completionStatus).filter(Boolean).length;

  const handleInitiateGeneration = () => {
    // Check if user is authenticated
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Validate that we still have the photo file
    if (!comicData.photo) {
      alert('Photo is missing. Please upload your photo again.');
      return;
    }

    // Show credit confirmation modal
    setShowCreditConfirmation(true);
  };

  const handleConfirmGeneration = async () => {
    setShowCreditConfirmation(false);
    setLoading(true);

    try {
      console.log('Starting comic generation with credits...');
      console.log('User credits:', credits);
      console.log('Cost:', CREDIT_COSTS.FULL_COMIC);

      // Navigate to generation page (which will handle the job creation)
      onGenerate(comicData);

      // Refresh credits to show updated balance
      await refreshCredits();
    } catch (error) {
      console.error('Generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to start comic generation: ${errorMessage}`);
      setLoading(false);
    }
  };

  const handlePurchaseCredits = () => {
    setShowCreditConfirmation(false);
    setShowCreditPurchase(true);
  };

  const handleCreditPurchaseClose = () => {
    setShowCreditPurchase(false);
    // Refresh credits after purchase
    refreshCredits();
  };

  const getCurrentStepIndex = () => steps.findIndex(step => step.id === currentStep);
  const canGoNext = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex === steps.length - 1) return false; // Last step
    const currentStepId = steps[currentIndex].id as keyof typeof completionStatus;
    return currentStepId === 'review' || completionStatus[currentStepId];
  };

  const goToStep = (stepId: Step) => {
    setCurrentStep(stepId);
  };

  const nextStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].id as Step);
    }
  };

  const prevStep = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id as Step);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'basic':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <User className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('config.basic.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base px-4">{t('config.basic.subtitle')}</p>
            </div>
            <div className="space-y-8">
              <div className="max-w-md mx-auto space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-xl">🦸</span>
                    {t('config.basic.heroName')} *
                  </label>
                  <input
                    type="text"
                    value={comicData.heroName}
                    onChange={(e) => setComicData(prev => ({ ...prev, heroName: e.target.value }))}
                    placeholder={t('config.basic.heroName.placeholder')}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-600 focus:outline-none transition-colors text-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-xl">📚</span>
                    {t('config.basic.comicTitle')} *
                  </label>
                  <input
                    type="text"
                    value={comicData.comicTitle}
                    onChange={(e) => setComicData(prev => ({ ...prev, comicTitle: e.target.value }))}
                    placeholder={t('config.basic.comicTitle.placeholder')}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-600 focus:outline-none transition-colors text-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 'photo':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Upload className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('config.photo.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base px-4">{t('config.photo.subtitle')}</p>
            </div>
            {comicData.photoPreview ? (
              <div className="text-center space-y-6">
                <img
                  src={comicData.photoPreview}
                  alt="Preview"
                  className="w-24 sm:w-32 h-24 sm:h-32 object-cover rounded-2xl shadow-lg mx-auto"
                />
                <div>
                  <p className="text-green-600 font-medium mb-4 text-base sm:text-lg">{t('config.photo.uploaded')}</p>
                  <button
                    onClick={() => setComicData(prev => ({ ...prev, photo: null, photoPreview: null }))}
                    className="text-gray-900 hover:text-gray-700 font-medium text-sm sm:text-base"
                  >
                    {t('config.photo.replace')}
                  </button>
                  <p className="text-gray-600 text-xs sm:text-sm mt-3 px-4">
                    {t('config.photo.hint')}
                  </p>
                </div>
              </div>
            ) : (
              <label className="block w-full p-6 sm:p-8 border-2 border-dashed border-gray-300 rounded-2xl hover:border-red-600 cursor-pointer transition-colors">
                <div className="text-center">
                  <Upload className="w-10 sm:w-12 h-10 sm:h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-base sm:text-lg font-medium text-gray-900 mb-2">{t('config.photo.upload')}</p>
                  <p className="text-gray-600 text-sm sm:text-base">{t('config.photo.formats')}</p>
                  <p className="text-gray-600 text-xs sm:text-sm mt-2 px-4">
                    {t('config.photo.hint')}
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        );

      case 'character':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Palette className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('config.character.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base px-4">{t('config.character.subtitle')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              {characterStyles.map((style) => (
                <div
                  key={style.id}
                  onClick={() => setComicData(prev => ({ ...prev, characterStyle: style.id }))}
                  className={`p-3 sm:p-4 lg:p-6 border-2 rounded-xl cursor-pointer transition-all hover:shadow-lg min-h-[100px] sm:min-h-auto ${
                    comicData.characterStyle === style.id
                      ? 'border-red-600 bg-red-50 shadow-lg'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl lg:text-4xl mb-2 sm:mb-3">{style.icon}</div>
                    <h3 className="font-bold text-gray-900 mb-1 sm:mb-2 text-sm sm:text-base leading-tight">{style.name}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm hidden sm:block leading-tight">{style.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {comicData.characterStyle === 'custom' && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('config.character.customLabel')} *
                </label>
                <input
                  type="text"
                  value={comicData.customStyle}
                  onChange={(e) => setComicData(prev => ({ ...prev, customStyle: e.target.value }))}
                  placeholder={t('config.character.customPlaceholder')}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-xl focus:border-red-600 focus:outline-none transition-colors text-base sm:text-lg"
                />
              </div>
            )}
          </div>
        );

      case 'story':
        return (
          <div className="space-y-6">
            <div className="text-center mb-6 sm:mb-8">
              <FileText className="w-12 sm:w-16 h-12 sm:h-16 text-red-600 mx-auto mb-3 sm:mb-4" />
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2 px-2">{t('config.story.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base px-4">{t('config.story.subtitle')}</p>
            </div>
            <div className="space-y-6 px-2 sm:px-0">
              {/* Story Input */}
              <div>
                <div className="flex items-start justify-between mb-3">
                  <label className="block text-sm sm:text-base font-medium text-gray-700">
                    {t('config.story.label')} *
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 whitespace-nowrap">{t('config.story.language')}:</span>
                    <button
                      onClick={() => setComicData(prev => ({ ...prev, storyLanguage: 'en' }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                        comicData.storyLanguage === 'en'
                          ? 'bg-red-600 text-white border-red-700 shadow-md'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      🇬🇧 {t('config.story.language.english')}
                    </button>
                    <button
                      onClick={() => setComicData(prev => ({ ...prev, storyLanguage: 'de' }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all border ${
                        comicData.storyLanguage === 'de'
                          ? 'bg-red-600 text-white border-red-700 shadow-md'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      🇩🇪 {t('config.story.language.german')}
                    </button>
                  </div>
                </div>
                <textarea
                  value={comicData.storyDescription}
                  onChange={(e) => setComicData(prev => ({ ...prev, storyDescription: e.target.value }))}
                  placeholder={t('config.story.placeholder')}
                  maxLength={500}
                  rows={5}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-xl focus:border-red-600 focus:outline-none transition-colors resize-none text-sm sm:text-base"
                />
                <div className="text-right text-xs sm:text-sm text-gray-500 mt-1">
                  {comicData.storyDescription.length}/500 characters
                </div>
              </div>
              <div className="bg-blue-50 p-3 sm:p-6 rounded-xl">
                <h4 className="font-semibold text-blue-900 mb-2 text-xs sm:text-sm">{t('config.story.exampleTitle')}</h4>
                <p className="text-blue-800 italic leading-relaxed text-xs sm:text-sm">{exampleStory}</p>
              </div>
            </div>
          </div>
        );

      case 'illustration':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Palette className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('config.illustration.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base px-4">{t('config.illustration.subtitle')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3">
              {illustrationStyles.map((style) => (
                <div
                  key={style.id}
                  onClick={() => setComicData(prev => ({ ...prev, illustrationStyle: style.id }))}
                  className={`p-3 sm:p-3 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg flex flex-col min-h-[200px] sm:min-h-[220px] ${
                    comicData.illustrationStyle === style.id
                      ? 'border-red-600 bg-red-50 shadow-lg'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-center flex flex-col flex-1">
                    <img
                      src={style.preview}
                      alt={style.name}
                      className="w-24 sm:w-28 h-24 sm:h-28 object-contain rounded-lg mx-auto mb-2 bg-gray-50"
                      onError={(e) => {
                        console.error(`Failed to load image: ${style.preview}`);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <h3 className="font-bold text-sm sm:text-xs text-gray-900 mb-2 sm:mb-1 leading-tight px-1">{style.name}</h3>
                    <p className="text-gray-600 text-xs leading-snug flex-1 px-1">{style.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <Eye className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{t('config.review.title')}</h2>
              <p className="text-gray-600 text-sm sm:text-base px-4">{t('config.review.subtitle')}</p>
            </div>
            
            <div className="max-w-2xl mx-auto space-y-3 sm:space-y-4">
              {/* Basic Information */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base">{t('config.review.basicInfo')}</h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {t('config.review.hero')}: {comicData.heroName || t('config.review.notSet')} • {t('config.review.title.label')}: {comicData.comicTitle || t('config.review.notSet')}
                    </p>
                  </div>
                  <button
                    onClick={() => goToStep('basic')}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Hero Photo */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base">{t('config.review.heroPhoto')}</h3>
                    {comicData.photoPreview ? (
                      <img 
                        src={comicData.photoPreview} 
                        alt="Hero" 
                        className="w-6 sm:w-8 h-6 sm:h-8 object-cover rounded"
                      />
                    ) : (
                      <span className="text-xs sm:text-sm text-gray-500">{t('config.review.noPhoto')}</span>
                    )}
                  </div>
                  <button
                    onClick={() => goToStep('photo')}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Character Style */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base">{t('config.review.characterStyle')}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 capitalize">
                      {comicData.characterStyle === 'custom' 
                        ? comicData.customStyle || 'Custom style not defined'
                        : comicData.characterStyle || 'Not selected'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => goToStep('character')}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Story */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base">{t('config.review.story')}</h3>
                    <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                      {comicData.storyDescription || t('config.review.noStory')}
                    </p>
                  </div>
                  <button
                    onClick={() => goToStep('story')}
                    className="text-red-600 hover:text-red-700 p-1 flex-shrink-0"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Art Style */}
              <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mx-2 sm:mx-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm sm:text-base">{t('config.review.artStyle')}</h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {comicData.illustrationStyle 
                        ? illustrationStyles.find(s => s.id === comicData.illustrationStyle)?.name
                        : 'Not selected'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => goToStep('illustration')}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <div className="pt-4 sm:pt-6 px-2 sm:px-0">
                {!user ? (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all bg-gradient-to-r from-red-600 to-blue-600 text-white hover:from-red-700 hover:to-blue-700 shadow-lg hover:shadow-xl"
                  >
                    Sign In to Generate
                  </button>
                ) : (
                  <button
                    onClick={handleInitiateGeneration}
                    disabled={!allCompleted || loading}
                    className={`w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all ${
                      allCompleted && !loading
                        ? 'bg-gradient-to-r from-red-600 to-blue-600 text-white hover:from-red-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {loading ? 'Starting Generation...' : `Generate Comic - ${CREDIT_COSTS.FULL_COMIC} Credits`}
                  </button>
                )}
                {allCompleted && user && (
                  <p className="text-center text-gray-600 text-xs sm:text-sm mt-2">
                    {credits >= CREDIT_COSTS.FULL_COMIC
                      ? `Your balance after: ${credits - CREDIT_COSTS.FULL_COMIC} credits`
                      : `Current balance: ${credits} credits`
                    }
                  </p>
                )}
                {!allCompleted && (
                  <p className="text-center text-red-600 text-xs sm:text-sm mt-2">
                    {t('config.review.completeAll')}
                  </p>
                )}
              </div>
            </div>
          </div>
        );


      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm sm:text-base"
            >
              <ArrowLeft size={16} className="sm:w-5 sm:h-5" />
              {t('config.backToHome')}
            </button>
            <div className="flex items-center gap-2 sm:gap-4">
              <LanguageSelector variant="compact" />
              <div className="text-xs sm:text-sm text-gray-600 hidden md:block">
                {completedCount} {t('config.sectionsCompleted')}
              </div>
              <div className="w-16 sm:w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-red-600 to-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-8">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="grid lg:grid-cols-4 gap-8">
            
            {/* Progress Sidebar */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              <div className="lg:sticky lg:top-8 space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-3 sm:p-4 lg:p-6">
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-3 sm:mb-4">{t('config.progress')}</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {steps.slice(0, -1).map((step, index) => {
                      const stepId = step.id as keyof typeof completionStatus;
                      const isCompleted = completionStatus[stepId];
                      const isCurrent = currentStep === step.id;

                      return (
                        <div
                          key={step.id}
                          onClick={() => goToStep(step.id as Step)}
                          className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-red-50 border-2 border-red-200 shadow-md'
                              : 'hover:bg-gray-50 border-2 border-transparent'
                          }`}
                        >
                          <div className={`w-7 sm:w-8 h-7 sm:h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrent
                              ? 'bg-yellow-400 text-gray-900'
                              : 'bg-gray-200 text-gray-400'
                          }`}>
                            {isCompleted ? '✓' : index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base truncate">{step.name}</div>
                            <div className="text-xs text-gray-600 hidden md:block truncate">{step.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <div className={`bg-white rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 flex flex-col ${
                currentStep === 'review' ? 'min-h-[550px] sm:min-h-[650px]' : currentStep === 'character' ? 'min-h-[550px] sm:min-h-[650px]' : 'min-h-[500px] sm:min-h-[600px]'
              }`}>
                <div className={currentStep === 'review' ? 'flex-1 overflow-y-auto pb-2 sm:pb-4' : 'flex-1'}>
                  {renderStepContent()}
                </div>

                {/* Navigation Buttons */}
                {currentStep !== 'review' && (
                  <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3 mt-4 pt-3 sm:pt-4 lg:pt-6 border-t">
                    <button
                      onClick={prevStep}
                      disabled={getCurrentStepIndex() === 0}
                      className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                        getCurrentStepIndex() === 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-600 text-white hover:bg-gray-700 active:bg-gray-800'
                      }`}
                    >
                      <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">{t('config.navigation.previous')}</span>
                      <span className="sm:hidden">Back</span>
                    </button>

                    <button
                      onClick={nextStep}
                      disabled={!canGoNext()}
                      className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm sm:text-base ${
                        canGoNext()
                          ? 'bg-gradient-to-r from-red-600 to-blue-600 text-white hover:from-red-700 hover:to-blue-700 active:from-red-800 active:to-blue-800 shadow-md'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <span className="hidden sm:inline">{t('config.navigation.next')}</span>
                      <span className="sm:hidden">Next</span>
                      <ArrowRight size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="signup"
      />

      {/* Credit Confirmation Modal */}
      <CreditConfirmationModal
        isOpen={showCreditConfirmation}
        onClose={() => setShowCreditConfirmation(false)}
        onConfirm={handleConfirmGeneration}
        onPurchaseCredits={handlePurchaseCredits}
      />

      {/* Credit Purchase Modal */}
      <CreditPurchaseModal
        isOpen={showCreditPurchase}
        onClose={handleCreditPurchaseClose}
        comicData={comicData}
      />
    </div>
  );
};

export default Configurator;