import React, { useState } from 'react';
import { Mail, X, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const EmailVerificationBanner: React.FC = () => {
  const { user, isEmailConfirmed, resendConfirmationEmail } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');

  if (!user || isEmailConfirmed || !isVisible) {
    return null;
  }

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || !user.email) return;

    setIsResending(true);
    setMessage('');

    try {
      const { error } = await resendConfirmationEmail(user.email);

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage('Confirmation email sent! Please check your inbox.');
        setResendCooldown(60);

        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      setMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yellow-800 font-medium">
                Please verify your email address
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                We sent a confirmation email to <span className="font-semibold">{user.email}</span>.
                Check your inbox and spam folder.
              </p>
              {message && (
                <p className={`text-xs mt-1 ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResendEmail}
              disabled={isResending || resendCooldown > 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <Clock className="w-4 h-4" />
                  Wait {resendCooldown}s
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Resend Email
                </>
              )}
            </button>

            <button
              onClick={() => setIsVisible(false)}
              className="p-1.5 hover:bg-yellow-100 rounded-lg transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4 text-yellow-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
