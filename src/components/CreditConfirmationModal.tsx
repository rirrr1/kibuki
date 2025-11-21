import React, { useState } from 'react';
import { X, AlertCircle, CreditCard, CheckCircle } from 'lucide-react';
import { CREDIT_COSTS } from '../stripe-config';
import { useAuth } from '../contexts/AuthContext';

interface CreditConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPurchaseCredits: () => void;
}

const CreditConfirmationModal: React.FC<CreditConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onPurchaseCredits
}) => {
  const { credits } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState(false);
  const hasEnoughCredits = credits >= CREDIT_COSTS.FULL_COMIC;
  const remainingCredits = credits - CREDIT_COSTS.FULL_COMIC;

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (termsAccepted && hasEnoughCredits) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Confirm Generation</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900 mb-1">Important Notice</p>
                <p className="text-sm text-yellow-800">
                  Once generation starts, it cannot be cancelled. Credits will be deducted immediately.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Credit Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-800">Current Balance:</span>
                <span className="font-bold text-blue-900">{credits} credits</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-800">Generation Cost:</span>
                <span className="font-bold text-red-600">-{CREDIT_COSTS.FULL_COMIC} credits</span>
              </div>
              <div className="border-t border-blue-300 my-2"></div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-800 font-semibold">Remaining Balance:</span>
                <span className={`font-bold ${hasEnoughCredits ? 'text-green-600' : 'text-red-600'}`}>
                  {hasEnoughCredits ? remainingCredits : 0} credits
                </span>
              </div>
            </div>
          </div>

          {!hasEnoughCredits && (
            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-900 mb-1">Insufficient Credits</p>
                  <p className="text-sm text-red-800 mb-3">
                    You need {CREDIT_COSTS.FULL_COMIC} credits to generate a comic. You currently have {credits} credits.
                  </p>
                  <button
                    onClick={onPurchaseCredits}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                  >
                    <CreditCard className="w-4 h-4" />
                    Purchase Credits
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasEnoughCredits && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">What you get:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>AI-generated comic with your character</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Personalized story and illustrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Review and edit pages before finalizing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>High-quality PDF download</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span>Optional physical print (extra cost)</span>
                  </li>
                </ul>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-5 h-5 mt-0.5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                    I have read and accept the{' '}
                    <a
                      href="/terms-and-conditions.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms and Conditions
                    </a>
                    {' '}and understand that {CREDIT_COSTS.FULL_COMIC} credits will be deducted immediately when generation starts.
                  </span>
                </label>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 transition-colors font-semibold"
          >
            Cancel
          </button>
          {hasEnoughCredits && (
            <button
              onClick={handleConfirm}
              disabled={!termsAccepted}
              className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
                termsAccepted
                  ? 'bg-gradient-to-r from-red-600 to-blue-600 text-white hover:from-red-700 hover:to-blue-700 shadow-lg'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Confirm and Generate
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreditConfirmationModal;
