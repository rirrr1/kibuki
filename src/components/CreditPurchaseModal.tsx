import React, { useState } from 'react';
import { X, Check, CreditCard } from 'lucide-react';
import { creditPackages } from '../stripe-config';
import { createCheckoutSession } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CreditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  comicData?: any;
}

const CreditPurchaseModal: React.FC<CreditPurchaseModalProps> = ({ isOpen, onClose, comicData }) => {
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const { user, refreshCredits } = useAuth();

  if (!isOpen) return null;

  // Check if in preview/restricted environment
  const isPreviewMode = typeof window !== 'undefined' && (() => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' ||
           hostname.includes('stackblitz') ||
           hostname.includes('webcontainer') ||
           hostname.includes('bolt.new');
  })();

  const handlePurchase = async (priceId: string) => {
    setLoading(true);
    setSelectedPackage(priceId);

    try {
      // Check if user is signed in
      if (!user) {
        alert('Please sign in to purchase credits.');
        setLoading(false);
        setSelectedPackage(null);
        return;
      }

      // Get package details
      const pkg = creditPackages.find(p => p.priceId === priceId);
      if (!pkg) {
        throw new Error('Package not found');
      }

      // In preview mode, show warning about Stripe limitations
      if (isPreviewMode) {
        const proceedWithStripe = confirm(
          `⚠️ Preview Mode Notice:\n\n` +
          `Stripe Checkout may not work in this preview environment due to network restrictions.\n\n` +
          `Options:\n` +
          `1. Click OK to try Stripe Checkout anyway (may fail)\n` +
          `2. Click Cancel to use test mode (adds credits instantly for testing)\n\n` +
          `Recommendation: Use test mode now, or deploy your app for full Stripe functionality.`
        );

        if (!proceedWithStripe) {
          // Use test mode - add credits directly
          console.log('Using preview test mode for credit purchase');

          const { error } = await supabase.rpc('add_credits', {
            p_user_id: user.id,
            p_amount: pkg.credits,
            p_transaction_type: 'purchase',
            p_description: `Preview Test Mode: ${pkg.name} package`,
            p_stripe_payment_intent_id: null
          });

          if (error) {
            throw new Error(`Failed to add credits: ${error.message}`);
          }

          await refreshCredits();
          alert(`✅ Test Mode: ${pkg.credits} credits added successfully!\n\nThis is preview test mode. In production, users will use Stripe checkout.`);
          onClose();
          setLoading(false);
          setSelectedPackage(null);
          return;
        }
      }

      // Save configurator state to sessionStorage before redirecting
      if (comicData) {
        const stateToSave = {
          comicData,
          timestamp: Date.now(),
          fromConfigurator: true
        };
        sessionStorage.setItem('pendingCreditPurchase', JSON.stringify(stateToSave));
        console.log('Saved configurator state before Stripe redirect');
      }

      // Try Stripe checkout
      const { url } = await createCheckoutSession({
        price_id: priceId,
        success_url: `${window.location.origin}/?purchase=success&return=configurator`,
        cancel_url: `${window.location.origin}/?purchase=cancelled&return=configurator`,
        mode: 'payment',
        customer_email: user.email,
      });

      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      // If in preview mode and Stripe failed, offer test mode
      if (isPreviewMode && errorMessage.includes('Failed to fetch')) {
        const useTestMode = confirm(
          `❌ Stripe Checkout Failed\n\n` +
          `This is expected in preview environments due to network restrictions.\n\n` +
          `Would you like to use test mode instead?\n` +
          `(This will add credits instantly for testing purposes)`
        );

        if (useTestMode) {
          try {
            const pkg = creditPackages.find(p => p.priceId === selectedPackage);
            if (pkg && user) {
              const { error } = await supabase.rpc('add_credits', {
                p_user_id: user.id,
                p_amount: pkg.credits,
                p_transaction_type: 'purchase',
                p_description: `Preview Test Mode: ${pkg.name} package`,
                p_stripe_payment_intent_id: null
              });

              if (error) throw error;

              await refreshCredits();
              alert(`✅ Test Mode: ${pkg.credits} credits added successfully!`);
              onClose();
            }
          } catch (testError) {
            console.error('Test mode error:', testError);
            alert('Failed to add credits in test mode. Please try again.');
          }
        }
      } else {
        alert(`Failed to complete purchase: ${errorMessage}\n\nPlease try again or contact support.`);
      }

      setLoading(false);
      setSelectedPackage(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        {isPreviewMode && (
          <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-400 rounded-lg">
            <p className="text-sm font-semibold text-yellow-900">
              ⚠️ Preview Mode: You'll be offered test mode if Stripe checkout fails due to network restrictions.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Buy Credits</h2>
            <p className="text-gray-600 mt-1">Choose the package that fits your needs</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {creditPackages.map((pkg) => (
            <div
              key={pkg.priceId}
              className={`relative bg-white border-2 rounded-2xl p-6 transition-all ${
                pkg.popular
                  ? 'border-red-600 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-4xl font-bold text-gray-900">
                    {pkg.currencySymbol} {pkg.price.toFixed(2)}
                  </span>
                </div>
                <div className="inline-flex items-center gap-2 bg-yellow-100 px-3 py-1 rounded-full">
                  <span className="text-2xl font-bold text-yellow-900">{pkg.credits}</span>
                  <span className="text-sm text-yellow-700">credits</span>
                </div>
              </div>

              <p className="text-gray-600 text-sm text-center mb-6">
                {pkg.description}
              </p>

              <ul className="space-y-3 mb-6">
                {pkg.credits >= 100 && (
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{Math.floor(pkg.credits / 100)} full comic{Math.floor(pkg.credits / 100) > 1 ? 's' : ''}</span>
                  </li>
                )}
                {pkg.credits >= 10 && (
                  <li className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>{Math.floor(pkg.credits / 10)} page regenerations</span>
                  </li>
                )}
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Credits never expire</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Failed generations refunded</span>
                </li>
              </ul>

              <button
                onClick={() => handlePurchase(pkg.priceId)}
                disabled={loading}
                className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  pkg.popular
                    ? 'bg-gradient-to-r from-red-600 to-blue-600 text-white hover:from-red-700 hover:to-blue-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading && selectedPackage === pkg.priceId ? (
                  'Processing...'
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    Purchase
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
          <p className="font-semibold mb-1">How credits work:</p>
          <ul className="space-y-1 text-blue-800">
            <li>• Generate a full comic: 100 credits</li>
            <li>• Regenerate any page: 10 credits per page</li>
            <li>• PDF downloads are always free</li>
            <li>• Failed generations are automatically refunded</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreditPurchaseModal;
