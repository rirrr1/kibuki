import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Star, Zap, Users, Shield, BookOpen, Download, ChevronDown, ChevronUp, Gift, Heart, Calendar, Sparkles, FileText, Check, Menu, X, LogIn, UserPlus, LogOut, User as UserIcon } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import LanguageSelector from './LanguageSelector';
import AuthModal from './AuthModal';
import CreditBalance from './CreditBalance';
import CreditPurchaseModal from './CreditPurchaseModal';
import TermsModal from './TermsModal';

interface LandingPageProps {
  onCreateComic: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onCreateComic }) => {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('signup');
  const [openPrompt, setOpenPrompt] = useState<number | null>(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const togglePrompt = (index: number) => {
    setOpenPrompt(openPrompt === index ? null : index);
  };

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  useEffect(() => {
    const sectionMap: Record<string, string> = {
      '/so-funktioniert-es': 'so-funktioniert-es',
      '/pricing': 'pricing',
      '/examples': 'examples',
      '/faq': 'faq'
    };

    const sectionId = sectionMap[location.pathname];
    if (sectionId) {
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location]);

  useEffect(() => {
    const staticH1 = document.getElementById('seo-static-h1');
    if (staticH1 && !staticH1.className.includes('seo-h1-offscreen')) {
      staticH1.className = 'seo-h1-offscreen';
    }
  }, []);

  // Check if in preview mode
  const isPreviewMode = typeof window !== 'undefined' && (() => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname.includes('bolt.new') ||
           hostname.includes('stackblitz') ||
           hostname.includes('webcontainer') ||
           hostname.includes('127.0.0.1') ||
           hostname.endsWith('.local');
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50">
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="bg-yellow-400 text-gray-900 py-2 px-4 text-center font-medium text-sm border-b-2 border-yellow-500">
          {t('landing.previewBanner')}
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="sticky top-0 z-50 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('home')}>
              <img
                src="/logo-svg-comic.png"
                alt="MyComic-Book.com - KI Comic Generator für personalisierte Comics"
                className="w-10 h-10 object-contain"
              />
              <span className="font-bold text-gray-900 hidden sm:block">MyComic-Book</span>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={onCreateComic}
                className="text-gray-700 hover:text-red-600 font-medium transition-colors"
              >
                {t('landing.menu.createComic')}
              </button>
              <button
                onClick={() => scrollToSection('so-funktioniert-es')}
                className="text-gray-700 hover:text-red-600 font-medium transition-colors"
              >
                {t('landing.menu.howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('examples')}
                className="text-gray-700 hover:text-red-600 font-medium transition-colors"
              >
                {t('landing.menu.examples')}
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="text-gray-700 hover:text-red-600 font-medium transition-colors"
              >
                {t('landing.menu.pricing')}
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="text-gray-700 hover:text-red-600 font-medium transition-colors"
              >
                {t('landing.menu.faq')}
              </button>
              <LanguageSelector variant="landing" />

              {user ? (
                <>
                  <CreditBalance variant="header" />
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="flex items-center gap-2 text-gray-700 hover:text-red-600 font-medium transition-colors"
                  >
                    <UserIcon size={18} />
                    Dashboard
                  </button>
                  <button
                    onClick={async () => {
                      await signOut();
                      navigate('/');
                    }}
                    className="flex items-center gap-2 text-gray-700 hover:text-red-600 font-medium transition-colors"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setAuthModalMode('login');
                      setShowAuthModal(true);
                    }}
                    className="flex items-center gap-2 text-gray-700 hover:text-red-600 font-medium transition-colors"
                  >
                    <LogIn size={18} />
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setAuthModalMode('signup');
                      setShowAuthModal(true);
                    }}
                    className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-red-700 hover:to-blue-700 transition-all flex items-center gap-2"
                  >
                    <UserPlus size={18} />
                    Sign Up Free
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="flex items-center gap-2 md:hidden">
              <LanguageSelector variant="landing" />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-gray-700 hover:text-red-600"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-4 py-4 space-y-3">
              {user && (
                <>
                  <div className="pb-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 mb-2">
                      <UserIcon size={16} className="text-gray-600" />
                      <span className="text-sm text-gray-600 truncate">{user.email}</span>
                    </div>
                    <CreditBalance variant="header" />
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/dashboard');
                    }}
                    className="flex items-center gap-2 w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
                  >
                    <UserIcon size={18} />
                    Dashboard
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onCreateComic();
                }}
                className="block w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
              >
                {t('landing.menu.createComic')}
              </button>
              <button
                onClick={() => scrollToSection('so-funktioniert-es')}
                className="block w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
              >
                {t('landing.menu.howItWorks')}
              </button>
              <button
                onClick={() => scrollToSection('examples')}
                className="block w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
              >
                {t('landing.menu.examples')}
              </button>
              <button
                onClick={() => scrollToSection('pricing')}
                className="block w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
              >
                {t('landing.menu.pricing')}
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="block w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
              >
                {t('landing.menu.faq')}
              </button>

              {user ? (
                <button
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await signOut();
                    navigate('/');
                  }}
                  className="flex items-center gap-2 w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors pt-3 border-t border-gray-200"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              ) : (
                <div className="pt-3 border-t border-gray-200 space-y-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthModalMode('login');
                      setShowAuthModal(true);
                    }}
                    className="flex items-center gap-2 w-full text-left text-gray-700 hover:text-red-600 font-medium py-2 transition-colors"
                  >
                    <LogIn size={18} />
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthModalMode('signup');
                      setShowAuthModal(true);
                    }}
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-red-600 to-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-red-700 hover:to-blue-700 transition-all"
                  >
                    <UserPlus size={18} />
                    Sign Up Free
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden bg-gradient-to-r from-red-600 to-blue-600 text-white" aria-label="Create personalized comic books">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-6 lg:space-y-8 text-center lg:text-left">
              {/* Tags */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <span className="bg-white/20 backdrop-blur-sm text-white px-5 py-2.5 rounded-full text-sm font-bold border border-white/30">
                  {t('landing.testFree')}
                </span>
                <span className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium border border-white/30">
                  {t('landing.noSignup')}
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                  {t('landing.hero.h1')}
                </h1>
                <p className="text-lg sm:text-xl md:text-2xl text-red-100 leading-relaxed">
                  {t('landing.hero.subtitle')}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={onCreateComic}
                  className="group bg-yellow-400 text-red-900 px-8 py-4 rounded-full font-bold text-lg hover:bg-yellow-300 transition-all duration-300 transform hover:scale-105 hover:shadow-xl flex items-center justify-center gap-2 shadow-lg"
                  aria-label="Start creating your personalized comic book"
                >
                  {t('landing.hero.cta')}
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" size={24} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Right Column - Hero Image */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <img
                  src="/tom_hero.png"
                  alt="Tom als KI-generierter Superheld - Beispiel für personalisiertes Comic Buch mit eigenem Foto - verwandle dich in einen Comic-Helden"
                  className="w-full max-w-md lg:max-w-lg xl:max-w-xl h-auto rounded-2xl shadow-2xl"
                  loading="eager"
                />
                <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                  <div className="bg-white px-4 py-2 rounded-full shadow-lg border-2 border-yellow-400 flex items-center gap-2">
                    <Download size={18} className="text-red-600" />
                    <span className="text-sm font-bold text-gray-900">{t('landing.hero.ebook')}</span>
                  </div>
                  <div className="bg-white px-4 py-2 rounded-full shadow-lg border-2 border-yellow-400 flex items-center gap-2">
                    <BookOpen size={18} className="text-blue-600" />
                    <span className="text-sm font-bold text-gray-900">{t('landing.hero.printed')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* How It Works Section */}
      <section id="so-funktioniert-es" className="py-20 bg-white" aria-label="How it works">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t('landing.howItWorks.title')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              {t('landing.howItWorks.subtitle')}
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-yellow-400 to-blue-600" style={{ top: '80px' }}></div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {[
                {
                  step: 1,
                  icon: <Star className="w-8 h-8" />,
                  color: "from-red-600 to-red-700",
                  title: t('landing.howItWorks.step1.title'),
                  description: t('landing.howItWorks.step1.desc')
                },
                {
                  step: 2,
                  icon: <Zap className="w-8 h-8" />,
                  color: "from-yellow-500 to-yellow-600",
                  title: t('landing.howItWorks.step2.title'),
                  description: t('landing.howItWorks.step2.desc')
                },
                {
                  step: 3,
                  icon: <Download className="w-8 h-8" />,
                  color: "from-blue-600 to-blue-700",
                  title: t('landing.howItWorks.step3.title'),
                  description: t('landing.howItWorks.step3.desc')
                }
              ].map((item) => (
                <div key={item.step} className="relative">
                  <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-shadow duration-300 border border-gray-100">
                    <div className={`w-16 h-16 bg-gradient-to-br ${item.color} rounded-2xl flex items-center justify-center text-white mb-6 mx-auto relative z-10 shadow-lg`}>
                      {item.icon}
                    </div>
                    <div className="text-center">
                      <div className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold mb-3">
                        Step {item.step}
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-3">{item.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white" aria-label="Benefits of personalized AI comic books">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 px-4">
              {t('landing.benefits.title')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto px-4">
              {t('landing.benefits.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            {[
              {
                icon: <BookOpen className="w-10 h-10" />,
                title: t('landing.benefits.gift.title'),
                description: t('landing.benefits.gift.desc')
              },
              {
                icon: <Users className="w-10 h-10" />,
                title: t('landing.benefits.hero.title'),
                description: t('landing.benefits.hero.desc')
              },
              {
                icon: <Zap className="w-10 h-10" />,
                title: t('landing.benefits.story.title'),
                description: t('landing.benefits.story.desc')
              },
              {
                icon: <Shield className="w-10 h-10" />,
                title: t('landing.benefits.quality.title'),
                description: t('landing.benefits.quality.desc')
              }
            ].map((benefit, index) => (
              <div key={index} className="text-center group hover:transform hover:scale-105 transition-all duration-300">
                <div className="mb-6 flex justify-center text-red-600">
                  {benefit.icon}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Examples Section */}
      <section id="examples" className="py-20 bg-gradient-to-br from-blue-50 to-red-50" aria-label="Personalized comic book examples">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t('landing.exampleComics.title')}
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              {t('landing.exampleComics.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {/* Tom's Adventures Comic */}
            <div className="flex flex-col items-center">
              <div className="flex justify-center mb-4 h-72 relative">
                <img
                  src="/tom_cover.png"
                  alt="Tom's Abenteuer - personalisiertes Action-Comic mit KI erstellt - Tom erlebt spannende Abenteuer"
                  className="h-full w-auto object-contain shadow-2xl"
                  loading="lazy"
                />
                <span className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold">DE</span>
              </div>

              <a
                href="/Tom_Comic.pdf"
                download="Tom_Comic.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <Download size={12} />
                Download
              </a>
            </div>

            {/* Mike's Superhero Comic */}
            <div className="flex flex-col items-center">
              <div className="flex justify-center mb-4 h-72 relative">
                <img
                  src="/mike comic cover.png"
                  alt="Mike als Superheld - personalisiertes Comic Buch Cover mit KI erstellt - Mike rettet die Stadt"
                  className="h-full w-auto object-contain shadow-2xl"
                  loading="lazy"
                />
                <span className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">EN</span>
              </div>

              <a
                href="/Mike_Comic.pdf"
                download="Mike_Comic.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <Download size={12} />
                Download
              </a>
            </div>

            {/* Mike's Animals Comic */}
            <div className="flex flex-col items-center">
              <div className="flex justify-center mb-4 h-72 relative">
                <img
                  src="/mike animals.png"
                  alt="Mike und die Tiere - personalisiertes Kinder-Comic mit KI generiert - Mike erlebt Abenteuer mit Tieren"
                  className="h-full w-auto object-contain shadow-2xl"
                  loading="lazy"
                />
                <span className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">EN</span>
              </div>

              <a
                href="/Mike_Animals.pdf"
                download="Mike_Animals.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <Download size={12} />
                Download
              </a>
            </div>

            {/* Tom Freezes Time Comic */}
            <div className="flex flex-col items-center">
              <div className="flex justify-center mb-4 h-72 relative">
                <img
                  src="/tom freez time.png"
                  alt="Tom friert die Zeit ein - personalisiertes Superhelden-Comic mit KI erstellt - Tom erhält Zeitmanipulations-Kräfte"
                  className="h-full w-auto object-contain shadow-2xl"
                  loading="lazy"
                />
                <span className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold">EN</span>
              </div>

              <a
                href="/Tom freezes Time-Comic.pdf"
                download="Tom_freezes_Time_Comic.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-gray-800 transition-all flex items-center justify-center gap-1.5 text-xs"
              >
                <Download size={12} />
                Download
              </a>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={onCreateComic}
              className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-8 py-4 rounded-full font-bold hover:shadow-lg transition-all duration-300 transform hover:scale-105 inline-flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Create Your Own Comic
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-gradient-to-br from-red-50 to-blue-50" aria-label="Comic book pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              {t('landing.pricing.title') || 'Transparent Pricing'}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('landing.pricing.subtitle') || 'Simple credit-based pricing. Create stunning comics with ease.'}
            </p>
          </div>

          {/* Credit Packages */}
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
            {/* Starter Pack */}
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200 flex flex-col">
              <div className="text-center flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Starter</h3>
                <div className="mb-6">
                  <div className="text-4xl font-bold text-gray-900 mb-1">€9.90</div>
                  <div className="text-lg font-semibold text-gray-700">100 Credits</div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!user) {
                    setAuthModalMode('signup');
                    setShowAuthModal(true);
                  } else {
                    setSelectedPackage('price_1QMi5zRvYxpGXP59iJ2rC3f9');
                    setShowTermsModal(true);
                  }
                }}
                className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors duration-200"
              >
                Kaufen
              </button>
            </div>

            {/* Creator Pack - Most Popular */}
            <div className="bg-white rounded-xl shadow-xl p-6 border-2 border-red-500 relative flex flex-col">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-red-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                  Most Popular
                </span>
              </div>
              <div className="text-center flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-6 mt-2">Creator</h3>
                <div className="mb-6">
                  <div className="text-4xl font-bold text-gray-900 mb-1">€17.90</div>
                  <div className="text-lg font-semibold text-gray-700 mb-2">200 Credits</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-400 line-through">€19.80</span>
                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-semibold">Save 10%</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!user) {
                    setAuthModalMode('signup');
                    setShowAuthModal(true);
                  } else {
                    setSelectedPackage('price_1QMi6jRvYxpGXP59gZ6LjObD');
                    setShowTermsModal(true);
                  }
                }}
                className="w-full bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-red-700 hover:to-blue-700 transition-all duration-200"
              >
                Kaufen
              </button>
            </div>

            {/* Studio Pack */}
            <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300 border border-gray-200 flex flex-col">
              <div className="text-center flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Studio</h3>
                <div className="mb-6">
                  <div className="text-4xl font-bold text-gray-900 mb-1">€29.90</div>
                  <div className="text-lg font-semibold text-gray-700 mb-2">400 Credits</div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm text-gray-400 line-through">€39.60</span>
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs font-semibold">Save 25%</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!user) {
                    setAuthModalMode('signup');
                    setShowAuthModal(true);
                  } else {
                    setSelectedPackage('price_1QMi7WRvYxpGXP59tqXQQRX9');
                    setShowTermsModal(true);
                  }
                }}
                className="w-full bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors duration-200"
              >
                Kaufen
              </button>
            </div>
          </div>

          {/* How Credits Work - Below packages */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 text-center mb-3 font-medium">How Credits Work:</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">100 credits</span>
                  <span>=</span>
                  <span>Full Comic Generation (12 pages)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">10 credits</span>
                  <span>=</span>
                  <span>Single Page Regeneration</span>
                </div>
              </div>
            </div>
          </div>

          {/* Physical Print as separate option */}
          <div className="max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <BookOpen className="w-16 h-16" />
                </div>
                <div className="flex-grow text-center md:text-left">
                  <h3 className="text-2xl font-bold mb-2">
                    {t('landing.pricing.physical.title')}
                  </h3>
                  <p className="text-blue-100 mb-1">{t('landing.pricing.physical.subtitle')}</p>
                  <div className="text-4xl font-bold mt-3">
                    {t('landing.pricing.physical.price')}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ul className="space-y-2 text-sm">
                    {[
                      t('landing.pricing.physical.feature1'),
                      t('landing.pricing.physical.feature2'),
                      t('landing.pricing.physical.feature3'),
                      t('landing.pricing.physical.feature4')
                    ].map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-300 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <button
              onClick={onCreateComic}
              className="bg-gradient-to-r from-red-600 to-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105"
            >
              {t('landing.hero.cta')}
            </button>
          </div>
        </div>
      </section>

      {/* Perfect Gift Ideas Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white" aria-label="Perfect comic book gifts for every occasion">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-3">
              {t('landing.giftIdeas.title')}
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {t('landing.giftIdeas.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: <Gift className="w-8 h-8" />,
                title: t('landing.giftIdeas.birthday.title'),
                description: t('landing.giftIdeas.birthday.desc'),
                gradient: 'from-red-500 to-red-600'
              },
              {
                icon: <Sparkles className="w-8 h-8" />,
                title: t('landing.giftIdeas.christmas.title'),
                description: t('landing.giftIdeas.christmas.desc'),
                gradient: 'from-blue-500 to-blue-600'
              },
              {
                icon: <Calendar className="w-8 h-8" />,
                title: t('landing.giftIdeas.special.title'),
                description: t('landing.giftIdeas.special.desc'),
                gradient: 'from-red-600 to-blue-600'
              },
              {
                icon: <Heart className="w-8 h-8" />,
                title: t('landing.giftIdeas.wedding.title'),
                description: t('landing.giftIdeas.wedding.desc'),
                gradient: 'from-blue-600 to-red-600'
              }
            ].map((gift, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 flex gap-4"
              >
                <div className={`flex-shrink-0 w-16 h-16 bg-gradient-to-br ${gift.gradient} rounded-lg flex items-center justify-center text-white`}>
                  {gift.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{gift.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{gift.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Q&A Section */}
      <section id="faq" className="py-20 bg-gradient-to-br from-red-50 to-blue-50" aria-label="Frequently asked questions about personalized comics">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-4 px-4">
              {t('landing.faq.title')}
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                question: t('landing.faq.q1'),
                answer: t('landing.faq.a1')
              },
              {
                question: t('landing.faq.q2'),
                answer: t('landing.faq.a2')
              },
              {
                question: t('landing.faq.q3'),
                answer: t('landing.faq.a3')
              },
              {
                question: t('landing.faq.q4'),
                answer: t('landing.faq.a4')
              },
              {
                question: t('landing.faq.q5'),
                answer: t('landing.faq.a5')
              },
              {
                question: t('landing.faq.q6'),
                answer: t('landing.faq.a6')
              },
              {
                question: t('landing.faq.q7'),
                answer: t('landing.faq.a7')
              }
            ].map((faq, index) => (
              <div key={index} className="bg-white rounded-xl hover:shadow-md transition-all duration-300">
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 sm:p-6 text-left flex items-center justify-between focus:outline-none"
                >
                  <span className="font-bold text-lg sm:text-xl text-gray-900 pr-4">{faq.question}</span>
                  {openFaq === index ? (
                    <ChevronUp className="w-6 h-6 text-red-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-red-600 flex-shrink-0" />
                  )}
                </button>
                {openFaq === index && (
                  <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                    <p className="text-gray-700 leading-relaxed text-sm sm:text-base">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="bg-gradient-to-r from-gray-800 to-gray-900 text-white py-16" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            <div className="sm:col-span-2">
              <div className="mb-6 flex items-center gap-3">
                <img
                  src="/logo-svg-comic.png"
                  alt="MyComic-Book.com Logo - KI Comic Generator für personalisierte Comic Bücher"
                  className="w-12 h-12 object-contain"
                />
                <span className="text-xl sm:text-2xl font-bold">MyComic-Book.com</span>
              </div>
              <p className="text-gray-400 leading-relaxed mb-6 text-sm sm:text-base">
                {t('landing.footer.description')}
              </p>
              <div className="flex gap-4">
                <button className="w-10 h-10 bg-yellow-400 hover:bg-yellow-300 rounded-full flex items-center justify-center transition-colors text-gray-900 font-bold">
                  f
                </button>
                <button className="w-10 h-10 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors text-white font-bold">
                  t
                </button>
                <button className="w-10 h-10 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center transition-colors text-white font-bold">
                  i
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold mb-4 text-sm sm:text-base">{t('landing.footer.quickLinks')}</h3>
              <ul className="space-y-2 text-gray-400 text-sm sm:text-base">
                <li><Link to="/so-funktioniert-es" className="hover:text-white transition-colors">{t('landing.footer.howItWorks')}</Link></li>
                <li><Link to="/examples" className="hover:text-white transition-colors">{t('landing.footer.examples')}</Link></li>
                <li><Link to="/pricing" className="hover:text-white transition-colors">{t('landing.footer.pricing')}</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
                <li><a href="mailto:support@mycomic-book.com" className="hover:text-white transition-colors">{t('landing.footer.support')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-sm sm:text-base">{t('landing.footer.legal')}</h3>
              <ul className="space-y-2 text-gray-400 text-sm sm:text-base">
                <li><a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{t('landing.footer.privacy')}</a></li>
                <li><a href="/terms-and-conditions.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{t('landing.footer.terms')}</a></li>
                <li><a href="mailto:support@mycomic-book.com" className="hover:text-white transition-colors">{t('landing.footer.contact')}</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-12 pt-8 text-center text-gray-400">
            <p className="text-sm sm:text-base">{t('landing.footer.copyright')}</p>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* Terms Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onClose={() => {
          setShowTermsModal(false);
          setSelectedPackage(null);
        }}
        onAccept={() => {
          setShowTermsModal(false);
          if (selectedPackage) {
            const handlePurchase = async () => {
              try {
                const { createCheckoutSession } = await import('../lib/stripe');
                const { url } = await createCheckoutSession({
                  price_id: selectedPackage,
                  success_url: `${window.location.origin}/?purchase=success`,
                  cancel_url: `${window.location.origin}/?purchase=cancelled`,
                  mode: 'payment',
                  customer_email: user?.email,
                });
                if (url) {
                  window.location.href = url;
                }
              } catch (error) {
                console.error('Purchase error:', error);
                alert('Failed to start checkout. Please try again.');
              } finally {
                setSelectedPackage(null);
              }
            };
            handlePurchase();
          }
        }}
      />
    </div>
  );
};

export default LandingPage;