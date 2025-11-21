import React, { useState } from 'react';
import { X, Package, Truck, CreditCard, MapPin, User, Phone, Mail } from 'lucide-react';
import { luluPrintService } from '../services/luluPrintService';
import { createCheckoutSession } from '../lib/stripe';
import { physicalProduct } from '../stripe-config';

interface PhysicalOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  interiorPdfUrl: string;
  coverPdfUrl: string;
  comicTitle: string;
  heroName: string;
}

interface ShippingForm {
  name: string;
  email: string;
  phone: string;
  street1: string;
  street2: string;
  city: string;
  postcode: string;
  country: string;
  acceptTerms: boolean;
}

type Step = 'shipping' | 'processing' | 'success' | 'error';

const PhysicalOrderModal: React.FC<PhysicalOrderModalProps> = ({
  isOpen,
  onClose,
  interiorPdfUrl,
  coverPdfUrl,
  comicTitle,
  heroName
}) => {
  const [step, setStep] = useState<Step>('shipping');
  const [shippingForm, setShippingForm] = useState<ShippingForm>({
    name: '',
    email: '',
    phone: '',
    street1: '',
    street2: '',
    city: '',
    postcode: '',
    country: 'DE',
    acceptTerms: false
  });
  const [shippingLevel, setShippingLevel] = useState<'MAIL'>('MAIL');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [printJobId, setPrintJobId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  const shippingOptions = [
    { id: 'MAIL', name: 'Standard Mail', description: '7-14 business days', price: 'Free shipping' }
  ];

  const countries = [
    { code: 'DE', name: 'Germany' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'AT', name: 'Austria' }
  ];

  const handleInputChange = (field: keyof ShippingForm, value: string) => {
    setShippingForm(prev => ({ ...prev, [field]: value }));
  };

  const calculateCost = async () => {
    try {
      const luluAddress: any = {
        name: shippingForm.name,
        street1: shippingForm.street1,
        city: shippingForm.city,
        postcode: shippingForm.postcode,
        country_code: shippingForm.country,
        phone_number: shippingForm.phone
      };

      // Only include street2 if it has a value
      if (shippingForm.street2.trim()) {
        luluAddress.street2 = shippingForm.street2;
      }

      const costData = await luluPrintService.calculateCost(luluAddress);
      setEstimatedCost(costData.total_cost_incl_tax);
    } catch (error) {
      console.error('Cost calculation failed:', error);
      setEstimatedCost('€24.99'); // Fallback price for Europe
    }
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    handlePayment();
  };

  const handlePayment = async () => {
    try {
      // Check if in preview mode
      const isPreviewMode = window.location.hostname === 'localhost' ||
                           window.location.hostname.includes('bolt.new') ||
                           window.location.hostname.includes('127.0.0.1');

      if (isPreviewMode) {
        alert('Physical ordering is disabled in preview mode. This feature will work after publishing.');
        setStep('shipping');
        return;
      }

      // Create Stripe checkout session for physical copy
      const { url } = await createCheckoutSession({
        price_id: physicalProduct.priceId,
        success_url: `${window.location.origin}/physical-success?session_id={CHECKOUT_SESSION_ID}&interior_url=${encodeURIComponent(interiorPdfUrl)}&cover_url=${encodeURIComponent(coverPdfUrl)}&hero_name=${encodeURIComponent(heroName)}&comic_title=${encodeURIComponent(comicTitle)}&shipping_data=${encodeURIComponent(JSON.stringify(shippingForm))}`,
        cancel_url: window.location.href,
        mode: 'payment',
      });

      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError(error instanceof Error ? error.message : 'Payment failed');
      setStep('error');
    }
  };

  const handleLuluOrder = async () => {
    setStep('processing');
    
    try {
      const luluAddress: any = {
        name: shippingForm.name,
        street1: shippingForm.street1,
        city: shippingForm.city,
        postcode: shippingForm.postcode,
        country_code: shippingForm.country,
        phone_number: shippingForm.phone
      };

      // Only include street2 if it has a value
      if (shippingForm.street2.trim()) {
        luluAddress.street2 = shippingForm.street2;
      }

      const printJob = await luluPrintService.createPrintJob(
        interiorPdfUrl,
        coverPdfUrl,
        comicTitle,
        heroName,
        luluAddress,
        shippingForm.email,
        'MAIL'
      );

      setPrintJobId(printJob.id);
      setStep('success');
    } catch (error) {
      console.error('Order creation failed:', error);
      setError(error instanceof Error ? error.message : 'Order creation failed');
      setStep('error');
    }
  };

  const isFormValid = () => {
    return shippingForm.name && 
           shippingForm.email && 
           shippingForm.phone && 
           shippingForm.street1 && 
           shippingForm.city && 
           shippingForm.postcode &&
           shippingForm.acceptTerms;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl font-bold text-gray-900">Order Physical Copy</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'shipping' && (
            <form onSubmit={handleShippingSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Shipping Information
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={shippingForm.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={shippingForm.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={shippingForm.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={shippingForm.street1}
                    onChange={(e) => handleInputChange('street1', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apartment, suite, etc. (optional)
                  </label>
                  <input
                    type="text"
                    value={shippingForm.street2}
                    onChange={(e) => handleInputChange('street2', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      value={shippingForm.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP/Postal Code *
                    </label>
                    <input
                      type="text"
                      value={shippingForm.postcode}
                      onChange={(e) => handleInputChange('postcode', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <select
                    value={shippingForm.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  >
                    {countries.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Shipping Method (Germany, Switzerland, Austria only)
                </h3>
                
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping"
                      value="MAIL"
                      checked={true}
                      readOnly
                      className="text-green-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-green-900">Standard Mail</div>
                      <div className="text-sm text-green-700">7-14 business days</div>
                    </div>
                    <div className="text-sm font-medium text-green-900">Free shipping</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Order Summary</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span>Physical Comic Book: {comicTitle}</span>
                    <span>€39.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping (Standard Mail)</span>
                    <span>Included</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>€39.00</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={shippingForm.acceptTerms}
                  onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                  className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-600"
                  required
                />
                <label htmlFor="acceptTerms" className="text-sm text-gray-700">
                  I accept the{' '}
                  <a 
                    href="/src/components/terms-and-conditions.html" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-red-600 hover:text-red-700 underline"
                  >
                    Terms and Conditions
                  </a>
                  {' '}*
                </label>
              </div>

              <button
                type="submit"
                disabled={!isFormValid()}
                className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Purchase - €39.00
              </button>
              
              {!isFormValid() && (
                <p className="text-center text-red-600 text-sm mt-2">
                  Please fill in all required fields and accept terms
                </p>
              )}
            </form>
          )}

          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Creating Print Job</h3>
              <p className="text-gray-600">Please wait while we process your order with our printing partner...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Order Placed Successfully!</h3>
              <p className="text-gray-600 mb-4">
                Your print job has been created with ID: <strong>#{printJobId}</strong>
              </p>
              <div className="bg-green-50 p-4 rounded-lg mb-6">
                <h4 className="font-semibold text-green-900 mb-2">What happens next?</h4>
                <ul className="text-green-800 text-sm space-y-1 text-left">
                  <li>• Your order will be validated and processed</li>
                  <li>• You'll receive email updates on the status</li>
                  <li>• Production typically takes 2-3 business days</li>
                  <li>• Shipping time depends on your selected method</li>
                </ul>
              </div>
              <button
                onClick={onClose}
                className="bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Order Failed</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setStep('shipping')}
                  className="border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="bg-red-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhysicalOrderModal;