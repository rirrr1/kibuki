import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'landing' | 'compact';
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'landing' }) => {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: 'en' | 'de') => {
    setLanguage(lang);
    setIsOpen(false);

    const currentPath = location.pathname;

    if (lang === 'en') {
      if (currentPath === '/') {
        navigate('/en');
      } else if (currentPath.startsWith('/dashboard')) {
        navigate('/en/dashboard');
      } else if (currentPath.startsWith('/success')) {
        navigate('/en/success');
      } else if (currentPath.startsWith('/physical-success')) {
        navigate('/en/physical-success');
      } else if (!currentPath.startsWith('/en')) {
        navigate('/en');
      }
    } else {
      if (currentPath.startsWith('/en/dashboard')) {
        navigate('/dashboard');
      } else if (currentPath.startsWith('/en/success')) {
        navigate('/success');
      } else if (currentPath.startsWith('/en/physical-success')) {
        navigate('/physical-success');
      } else if (currentPath.startsWith('/en')) {
        navigate('/');
      }
    }
  };

  const getLanguageLabel = (lang: string) => {
    return lang === 'en' ? 'English' : 'Deutsch';
  };

  if (variant === 'compact') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-white/20"
        >
          <Globe size={16} />
          <span>{language.toUpperCase()}</span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
            <button
              onClick={() => handleLanguageChange('en')}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                language === 'en' ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">🇬🇧</span>
              <span>English</span>
            </button>
            <button
              onClick={() => handleLanguageChange('de')}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                language === 'de' ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-700'
              }`}
            >
              <span className="text-lg">🇩🇪</span>
              <span>Deutsch</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-md border border-gray-200"
      >
        <Globe size={16} className="text-gray-600" />
        <span className="text-gray-700">{getLanguageLabel(language)}</span>
        <ChevronDown size={14} className={`text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
          <button
            onClick={() => handleLanguageChange('en')}
            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
              language === 'en' ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-700'
            }`}
          >
            <span className="text-lg">🇬🇧</span>
            <span>English</span>
          </button>
          <button
            onClick={() => handleLanguageChange('de')}
            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
              language === 'de' ? 'bg-red-50 text-red-600 font-medium' : 'text-gray-700'
            }`}
          >
            <span className="text-lg">🇩🇪</span>
            <span>Deutsch</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
