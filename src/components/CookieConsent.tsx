import React, { useEffect, useState } from 'react';
import { X, Cookie, Shield } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
}

const CookieConsent: React.FC = () => {
  const { t, language } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShowBanner(true);
    } else {
      const savedPreferences = JSON.parse(consent);
      setPreferences(savedPreferences);
      applyConsent(savedPreferences);
    }
  }, []);

  const applyConsent = (prefs: CookiePreferences) => {
    if (typeof window !== 'undefined' && window.gtag) {
      if (prefs.analytics) {
        window.gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
      } else {
        window.gtag('consent', 'update', {
          analytics_storage: 'denied',
        });
      }

      if (prefs.marketing) {
        window.gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        });
      } else {
        window.gtag('consent', 'update', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        });
      }
    }
  };

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem('cookieConsent', JSON.stringify(prefs));
    setPreferences(prefs);
    applyConsent(prefs);
    setShowBanner(false);
    setShowSettings(false);
  };

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
    };
    savePreferences(allAccepted);
  };

  const rejectAll = () => {
    const allRejected = {
      necessary: true,
      analytics: false,
      marketing: false,
    };
    savePreferences(allRejected);
  };

  const saveCustom = () => {
    savePreferences(preferences);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSettings(false)} />
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
          {!showSettings ? (
            <div className="p-6 md:p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-shrink-0">
                  <Cookie className="w-8 h-8 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-3">
                    {language === 'de' ? 'Cookie-Einstellungen' : 'Cookie Settings'}
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    {language === 'de'
                      ? 'Wir verwenden Cookies, um Ihre Erfahrung zu verbessern und unsere Dienste zu optimieren. Notwendige Cookies sind für die Funktion der Website erforderlich. Analytische und Marketing-Cookies helfen uns, unseren Service zu verbessern und relevante Inhalte anzuzeigen.'
                      : 'We use cookies to enhance your experience and optimize our services. Necessary cookies are required for the website to function. Analytics and marketing cookies help us improve our service and show relevant content.'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {language === 'de' ? (
                      <>
                        Weitere Informationen finden Sie in unserer{' '}
                        <a href="/privacy-policy.html" className="text-blue-600 hover:text-blue-700 underline" target="_blank">
                          Datenschutzerklärung
                        </a>
                        .
                      </>
                    ) : (
                      <>
                        For more information, please read our{' '}
                        <a href="/privacy-policy.html" className="text-blue-600 hover:text-blue-700 underline" target="_blank">
                          Privacy Policy
                        </a>
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={acceptAll}
                  className="flex-1 bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300"
                >
                  {language === 'de' ? 'Alle akzeptieren' : 'Accept All'}
                </button>
                <button
                  onClick={rejectAll}
                  className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all duration-300"
                >
                  {language === 'de' ? 'Alle ablehnen' : 'Reject All'}
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-gray-400 transition-all duration-300"
                >
                  {language === 'de' ? 'Einstellungen' : 'Settings'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-blue-600" />
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900">
                    {language === 'de' ? 'Cookie-Einstellungen anpassen' : 'Customize Cookie Settings'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">
                      {language === 'de' ? 'Notwendige Cookies' : 'Necessary Cookies'}
                    </h4>
                    <span className="text-sm font-semibold text-gray-600 bg-gray-200 px-3 py-1 rounded-full">
                      {language === 'de' ? 'Immer aktiv' : 'Always Active'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {language === 'de'
                      ? 'Diese Cookies sind für die Grundfunktionen der Website erforderlich und können nicht deaktiviert werden.'
                      : 'These cookies are essential for the basic functions of the website and cannot be disabled.'}
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">
                      {language === 'de' ? 'Analytische Cookies' : 'Analytics Cookies'}
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    {language === 'de'
                      ? 'Diese Cookies helfen uns zu verstehen, wie Besucher mit der Website interagieren, indem Informationen anonym gesammelt und gemeldet werden. (Google Analytics)'
                      : 'These cookies help us understand how visitors interact with the website by collecting and reporting information anonymously. (Google Analytics)'}
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-lg p-4 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-gray-900">
                      {language === 'de' ? 'Marketing-Cookies' : 'Marketing Cookies'}
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">
                    {language === 'de'
                      ? 'Diese Cookies werden verwendet, um Besuchern auf Webseiten zu folgen. Die Absicht ist, Anzeigen zu zeigen, die relevant und ansprechend für den einzelnen Benutzer sind. (Google Ads)'
                      : 'These cookies are used to track visitors across websites. The intention is to display ads that are relevant and engaging for the individual user. (Google Ads)'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={saveCustom}
                  className="flex-1 bg-gradient-to-r from-red-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-300"
                >
                  {language === 'de' ? 'Einstellungen speichern' : 'Save Settings'}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-gray-400 transition-all duration-300"
                >
                  {language === 'de' ? 'Zurück' : 'Back'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CookieConsent;
