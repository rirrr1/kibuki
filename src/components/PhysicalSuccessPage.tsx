import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, Truck, ArrowRight, X } from 'lucide-react';
import { luluPrintService } from '../services/luluPrintService';

const PhysicalSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const interiorUrl = searchParams.get('interior_url');
  const coverUrl = searchParams.get('cover_url');
  const heroName = searchParams.get('hero_name');
  const comicTitle = searchParams.get('comic_title');
  const shippingDataParam = searchParams.get('shipping_data');

  const [loading, setLoading] = useState(true);
  const [printJobId, setPrintJobId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [conversionFired, setConversionFired] = useState(false);

  const sendPhysicalOrderConfirmationEmail = async (
    email: string,
    heroName: string,
    comicTitle: string,
    shippingData: any,
    printJobId: number,
    sessionId: string
  ) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email,
          heroName: decodeURIComponent(heroName),
          comicTitle: decodeURIComponent(comicTitle),
          comicUrl: '#', // Not needed for physical order email
          emailType: 'physical',
          shippingInfo: shippingData,
          printJobId,
          sessionId
        })
      });

      if (response.ok) {
        console.log('Physical order confirmation email sent successfully');
      } else {
        console.error('Failed to send physical order confirmation email');
      }
    } catch (error) {
      console.error('Error sending physical order confirmation email:', error);
    }
  };
  useEffect(() => {
    // Fire Google Ads conversion event once
    if (!conversionFired && typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-962918984/rcWsCKP3wrEbEMj0k8sD',
        'value': 1.0,
        'currency': 'CHF',
        'transaction_id': sessionId || ''
      });
      setConversionFired(true);
      console.log('Google Ads conversion event fired for physical order');
    }

    const createPrintJob = async () => {
      if (!interiorUrl || !coverUrl || !heroName || !comicTitle || !shippingDataParam) {
        setError('Missing required order information');
        setLoading(false);
        return;
      }

      try {
        const shippingData = JSON.parse(decodeURIComponent(shippingDataParam));
        
        const luluAddress: any = {
          name: shippingData.name,
          street1: shippingData.street1,
          city: shippingData.city,
          postcode: shippingData.postcode,
          country_code: shippingData.country,
          phone_number: shippingData.phone
        };

        if (shippingData.street2 && shippingData.street2.trim()) {
          luluAddress.street2 = shippingData.street2;
        }

        const printJob = await luluPrintService.createPrintJob(
          decodeURIComponent(interiorUrl),
          decodeURIComponent(coverUrl),
          decodeURIComponent(comicTitle),
          decodeURIComponent(heroName),
          luluAddress,
          shippingData.email,
          'MAIL'
        );

        setPrintJobId(printJob.id);
        
        // Send confirmation email after successful print job creation
        if (shippingData.email) {
          await sendPhysicalOrderConfirmationEmail(
            shippingData.email,
            heroName,
            comicTitle,
            shippingData,
            printJob.id,
            sessionId || ''
          );
        }
      } catch (error) {
        console.error('Print job creation failed:', error);
        setError(error instanceof Error ? error.message : 'Failed to create print job');
      } finally {
        setLoading(false);
      }
    };

    createPrintJob();
  }, [interiorUrl, coverUrl, heroName, comicTitle, shippingDataParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Order</h2>
          <p className="text-gray-600">Creating your print job...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Processing Failed</h1>
          <p className="text-xl text-gray-600 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-8">
          <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
          <p className="text-xl text-gray-600 mb-2">
            Your physical comic book order has been successfully placed.
          </p>
          {sessionId && (
            <p className="text-sm text-gray-500">
              Order ID: {sessionId.slice(-8).toUpperCase()}
            </p>
          )}
          {printJobId && (
            <p className="text-sm text-gray-500">
              Print Job ID: #{printJobId}
            </p>
          )}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Package className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-green-900">What Happens Next?</h3>
          </div>
          <div className="text-green-800 space-y-2 text-left">
            <p>• Your order has been sent to our printing partner</p>
            <p>• You'll receive email updates on the production status</p>
            <p>• Production typically takes 2-3 business days</p>
            <p>• Shipping time: 7-14 business days (Standard Mail)</p>
            <p>• You'll receive tracking information once shipped</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Truck className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-blue-900">Shipping Information</h3>
          </div>
          <div className="text-blue-800 text-sm">
            <p>Your comic will be shipped via Standard Mail</p>
            <p>Delivery time: 7-14 business days</p>
            <p>Available for: Germany, Switzerland, Austria</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Create Another Comic
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-gray-400 transition-colors"
          >
            Return Home
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@mycomic-book.com" className="text-green-600 hover:text-green-700">
              support@mycomic-book.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PhysicalSuccessPage;