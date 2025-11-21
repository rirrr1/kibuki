import React, { useState } from 'react';
import { Coins, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CreditPurchaseModal from './CreditPurchaseModal';

interface CreditBalanceProps {
  variant?: 'header' | 'large';
}

const CreditBalance: React.FC<CreditBalanceProps> = ({ variant = 'header' }) => {
  const { credits, user } = useAuth();
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  if (!user) return null;

  const isLowBalance = credits < 100;

  if (variant === 'large') {
    return (
      <>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-6 border-2 border-yellow-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                <Coins className="w-6 h-6 text-yellow-900" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Your Credits</p>
                <p className="text-3xl font-bold text-gray-900">{credits}</p>
              </div>
            </div>
            <button
              onClick={() => setShowPurchaseModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-lg font-semibold hover:from-red-700 hover:to-blue-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Buy Credits
            </button>
          </div>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between py-2 border-t border-yellow-200">
              <span>Full comic generation:</span>
              <span className="font-semibold">100 credits</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-yellow-200">
              <span>Page regeneration:</span>
              <span className="font-semibold">10 credits</span>
            </div>
          </div>

          {isLowBalance && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Low balance! You need at least 100 credits to generate a comic.
            </div>
          )}
        </div>

        <CreditPurchaseModal
          isOpen={showPurchaseModal}
          onClose={() => setShowPurchaseModal(false)}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowPurchaseModal(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-semibold transition-all ${
          isLowBalance
            ? 'bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-100'
            : 'bg-yellow-50 text-yellow-900 border-2 border-yellow-200 hover:bg-yellow-100'
        }`}
      >
        <Coins className="w-4 h-4" />
        <span className="text-sm">{credits} Credits</span>
        <Plus className="w-3 h-3" />
      </button>

      <CreditPurchaseModal
        isOpen={showPurchaseModal}
        onClose={() => setShowPurchaseModal(false)}
      />
    </>
  );
};

export default CreditBalance;
