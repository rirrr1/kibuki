import React, { useState } from 'react';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { StripeProduct } from '../stripe-config';
import { createCheckoutSession } from '../lib/stripe';

interface ProductCardProps {
  product: StripeProduct;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    try {
      const { url } = await createCheckoutSession({
        price_id: product.priceId,
        success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: window.location.href,
        mode: product.mode,
      });

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-4">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-3xl font-bold text-red-600">
            {product.currencySymbol} {product.price.toFixed(2)}
          </span>
          <span className="text-sm text-gray-500 capitalize">
            {product.mode === 'payment' ? 'One-time' : 'Subscription'}
          </span>
        </div>
      </div>
      
      <button
        onClick={handlePurchase}
        disabled={loading}
        className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            Buy Now
          </>
        )}
      </button>
    </div>
  );
};

export default ProductCard;