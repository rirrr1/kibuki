import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Terms and Conditions</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-4 text-gray-700 text-sm sm:text-base mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="font-semibold text-blue-900 mb-2">Important Notice</p>
            <p className="text-blue-800">
              By generating a comic, you agree to our terms and conditions. Please read them carefully before proceeding.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-lg">1. Service Description</h3>
            <p>
              Our service uses AI to generate personalized comic books based on your inputs. The generation process costs 20 credits per comic.
            </p>

            <h3 className="font-semibold text-gray-900 text-lg">2. Credit Usage</h3>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Full comic generation: 20 credits (non-refundable once generation starts)</li>
              <li>Page regeneration: 5 credits per page</li>
              <li>Credits are deducted immediately when generation begins</li>
              <li>Failed generations are automatically refunded</li>
              <li>Credits never expire</li>
            </ul>

            <h3 className="font-semibold text-gray-900 text-lg">3. Content Guidelines</h3>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>You may only upload photos you have permission to use</li>
              <li>Generated content is for personal use only</li>
              <li>We reserve the right to refuse service for inappropriate content</li>
              <li>AI-generated content may vary in quality and accuracy</li>
            </ul>

            <h3 className="font-semibold text-gray-900 text-lg">4. Generation Process</h3>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Generation typically takes 3-5 minutes</li>
              <li>You must keep the browser window open during generation</li>
              <li>Once started, generation cannot be cancelled</li>
              <li>You will have the opportunity to approve and edit pages before final PDF creation</li>
            </ul>

            <h3 className="font-semibold text-gray-900 text-lg">5. Intellectual Property</h3>
            <p>
              You retain ownership of your uploaded photos. The AI-generated artwork is provided for your personal use. You may not resell or commercially distribute the generated comics without permission.
            </p>

            <h3 className="font-semibold text-gray-900 text-lg">6. Privacy and Data</h3>
            <p>
              Your photos and personal information are processed securely. We do not share your data with third parties except as required for service delivery. Generated comics are stored for your access only.
            </p>

            <h3 className="font-semibold text-gray-900 text-lg">7. No Guarantees</h3>
            <p>
              While we strive for quality, AI-generated content may contain imperfections. We do not guarantee specific results or artistic styles. Our service is provided "as is" without warranties.
            </p>
          </div>

          <div className="border-t pt-4 mt-6">
            <p className="text-sm text-gray-600">
              For full terms and conditions, please visit our{' '}
              <a
                href="/terms-and-conditions.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Terms and Conditions page
                <ExternalLink className="w-3 h-3" />
              </a>
              {' '}and{' '}
              <a
                href="/privacy-policy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
              >
                Privacy Policy
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 transition-colors font-semibold"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-xl hover:from-red-700 hover:to-blue-700 transition-all font-semibold shadow-lg"
          >
            I Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsModal;
