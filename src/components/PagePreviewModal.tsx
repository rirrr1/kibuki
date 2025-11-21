import React, { useState } from 'react';
import { CheckCircle, AlertCircle, Loader, ChevronDown, ChevronUp, RotateCcw, Unlock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CREDIT_COSTS } from '../stripe-config';
import CreditPurchaseModal from './CreditPurchaseModal';

interface PagePreviewModalProps {
  jobId: string;
  generatedPages: {
    cover?: string;
    storyPage1?: string;
    storyPage2?: string;
    storyPage3?: string;
    storyPage4?: string;
    storyPage5?: string;
    storyPage6?: string;
    storyPage7?: string;
    storyPage8?: string;
    storyPage9?: string;
    storyPage10?: string;
  };
  originalPages: {
    cover?: string;
    storyPage1?: string;
    storyPage2?: string;
    storyPage3?: string;
    storyPage4?: string;
    storyPage5?: string;
    storyPage6?: string;
    storyPage7?: string;
    storyPage8?: string;
    storyPage9?: string;
    storyPage10?: string;
  };
  pageApprovals: Record<string, boolean>;
  panelCounts?: Record<string, number>;
  onApprove: (pageKey: string) => Promise<void>;
  onUnapprove: (pageKey: string) => Promise<void>;
  onEdit: (pageKey: string, prompt: string, panelNumber: number) => Promise<void>;
  onFinalizeAll: () => Promise<void>;
}

interface PageCardProps {
  pageKey: string;
  pageNumber: string;
  imagePath: string;
  originalPath?: string;
  isApproved: boolean;
  isEditing: boolean;
  panelCount: number;
  onApprove: () => Promise<void>;
  onUnapprove: () => Promise<void>;
  onEdit: (prompt: string, panelNumber: number) => Promise<void>;
}

const PageCard: React.FC<PageCardProps> = ({
  pageKey,
  pageNumber,
  imagePath,
  originalPath,
  isApproved,
  isEditing,
  panelCount,
  onApprove,
  onUnapprove,
  onEdit
}) => {
  const { credits, refreshCredits } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regenerationCount, setRegenerationCount] = useState(0);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [lockedVersion, setLockedVersion] = useState<'original' | 'edited' | null>(null);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);

  const MAX_REGENERATIONS = 30;

  const hasBeenEdited = originalPath && originalPath !== imagePath;
  const displayPath = showingOriginal && hasBeenEdited ? originalPath : imagePath;
  const imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comics/${displayPath}`;
  const isLocked = isApproved && lockedVersion !== null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove();
      setLockedVersion(showingOriginal && hasBeenEdited ? 'original' : 'edited');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnapprove = async () => {
    const confirmed = window.confirm('Are you sure you want to unlock this page? You will need to confirm it again before finalizing the comic.');
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await onUnapprove();
      setLockedVersion(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoCorrect = async () => {
    // Silent cap at 30 regenerations
    if (regenerationCount >= MAX_REGENERATIONS) {
      return;
    }

    // Check if user has enough credits
    if (credits < CREDIT_COSTS.PAGE_REGENERATION) {
      setShowCreditPurchase(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const autoCorrectPrompt = `Correct this comic page by: 1) If panel labels (a,b,c,d,e) are present: remove those labels from the page. 2) If the HERO appears more than once within the SAME panel, delete ONE duplicate WITHIN THE SAME PANEL. 3) If a text in a speech bubble does not make sense, is misspelled or is not readable: rewrite the text (max 3 simple words) that matches the context for THIS panel. 4) If hero or character is not consistent (face, beard, outfit, etc): replace with the consistent version from context picture. 5) If a bubble tail points to the wrong speaker, reattach the tail to the correct visible speaker in THIS panel. If none exists, remove ONLY that bubble. 6) If a second character appears on the PAGE (NOT THE HERO), match them to the last context page exactly (face, hair, outfit, accessories, proportions, style). 7) Improve the logic and flow of actions depicted. Apply these corrections to all panels in this page.`;
      await onEdit(autoCorrectPrompt, 0);
      setRegenerationCount(prev => prev + 1);
      await refreshCredits();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden border-2 transition-all ${
      isApproved ? 'border-green-500' : 'border-gray-200'
    }`}>
      <div className="relative">
        <img
          src={imageUrl}
          alt={`Page ${pageNumber}`}
          className="w-full h-auto"
        />
        {showingOriginal && hasBeenEdited && (
          <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full shadow-lg text-xs font-medium">
            Original
          </div>
        )}
        {!showingOriginal && hasBeenEdited && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-3 py-1 rounded-full shadow-lg text-xs font-medium">
            Edited
          </div>
        )}
        {isApproved && (
          <div className="absolute top-2 right-2 bg-green-500 text-white p-2 rounded-full shadow-lg">
            <CheckCircle size={24} />
          </div>
        )}
        {isEditing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="text-white text-center">
              <Loader className="w-12 h-12 animate-spin mx-auto mb-2" />
              <p className="text-sm sm:text-base">Editing page...</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        <h3 className="text-base sm:text-lg font-bold text-gray-900">{pageNumber}</h3>

        {hasBeenEdited && !isLocked && (
          <button
            onClick={() => setShowingOriginal(!showingOriginal)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs sm:text-sm font-medium"
          >
            <RotateCcw size={16} className="flex-shrink-0" />
            <span className="truncate">{showingOriginal ? 'Show Edit' : 'Show Original'}</span>
          </button>
        )}

        {isLocked && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
            <p className="text-xs text-green-800 font-medium">
              🔒 {lockedVersion === 'original' ? 'Original' : 'Edited'} version locked for PDF
            </p>
          </div>
        )}

        {!isApproved && !isEditing && (
          <div className="space-y-2">
            <button
              onClick={handleApprove}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm sm:text-base"
            >
              <CheckCircle size={18} className="flex-shrink-0" />
              <span>Confirm Page</span>
            </button>
            {regenerationCount < MAX_REGENERATIONS && (
              <button
                onClick={handleAutoCorrect}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-lg hover:from-red-700 hover:to-blue-700 transition-all font-semibold shadow-md text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw size={18} className="flex-shrink-0" />
                <span>{isSubmitting ? 'Regenerating...' : `Regenerate Page (${CREDIT_COSTS.PAGE_REGENERATION} Credits)`}</span>
              </button>
            )}
          </div>
        )}

        {isApproved && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-green-600 font-semibold bg-green-50 rounded-lg py-3 px-4">
              <CheckCircle size={18} className="flex-shrink-0" />
              <span className="text-sm sm:text-base">Confirmed</span>
            </div>
            <button
              onClick={handleUnapprove}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all font-semibold text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Unlock size={16} className="flex-shrink-0" />
              <span>Unlock Page</span>
            </button>
          </div>
        )}

      </div>

      <CreditPurchaseModal
        isOpen={showCreditPurchase}
        onClose={() => {
          setShowCreditPurchase(false);
          refreshCredits();
        }}
      />
    </div>
  );
};

const PagePreviewModal: React.FC<PagePreviewModalProps> = ({
  jobId,
  generatedPages,
  originalPages,
  pageApprovals,
  panelCounts = {},
  onApprove,
  onUnapprove,
  onEdit,
  onFinalizeAll
}) => {
  const [editingPages, setEditingPages] = useState<Set<string>>(new Set());
  const [isFinalizing, setIsFinalizing] = useState(false);

  const pageList = [
    { key: 'cover', label: 'Cover', path: generatedPages.cover },
    { key: 'storyPage1', label: 'Page 1', path: generatedPages.storyPage1 },
    { key: 'storyPage2', label: 'Page 2', path: generatedPages.storyPage2 },
    { key: 'storyPage3', label: 'Page 3', path: generatedPages.storyPage3 },
    { key: 'storyPage4', label: 'Page 4', path: generatedPages.storyPage4 },
    { key: 'storyPage5', label: 'Page 5', path: generatedPages.storyPage5 },
    { key: 'storyPage6', label: 'Page 6', path: generatedPages.storyPage6 },
    { key: 'storyPage7', label: 'Page 7', path: generatedPages.storyPage7 },
    { key: 'storyPage8', label: 'Page 8', path: generatedPages.storyPage8 },
    { key: 'storyPage9', label: 'Page 9', path: generatedPages.storyPage9 },
    { key: 'storyPage10', label: 'Page 10', path: generatedPages.storyPage10 },
    { key: 'backCover', label: 'Back Cover', path: generatedPages.backCover },
  ];

  const requiredPages = ['cover', 'storyPage1', 'storyPage2', 'storyPage3', 'storyPage4', 'storyPage5', 'storyPage6', 'storyPage7', 'storyPage8', 'storyPage9', 'storyPage10', 'backCover'];
  const approvedCount = requiredPages.filter(pageKey => pageApprovals[pageKey] === true).length;
  const allApproved = approvedCount === 12;

  const missingApprovals = requiredPages.filter(pageKey => !pageApprovals[pageKey]);
  const missingLabels = missingApprovals.map(key => {
    const page = pageList.find(p => p.key === key);
    return page ? page.label : key;
  });

  const handleApprove = async (pageKey: string) => {
    await onApprove(pageKey);
  };

  const handleUnapprove = async (pageKey: string) => {
    await onUnapprove(pageKey);
  };

  const handleEdit = async (pageKey: string, prompt: string, panelNumber: number) => {
    setEditingPages(prev => new Set(prev).add(pageKey));
    try {
      await onEdit(pageKey, prompt, panelNumber);
    } finally {
      setEditingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(pageKey);
        return newSet;
      });
    }
  };

  const handleFinalizeAll = async () => {
    if (!allApproved) {
      alert(`Please confirm all pages first. Missing confirmations: ${missingLabels.join(', ')}`);
      return;
    }

    setIsFinalizing(true);
    try {
      await onFinalizeAll();
    } finally {
      setIsFinalizing(false);
    }
  };

  if (isFinalizing) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-green-50 via-white to-blue-50 z-50 flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12 space-y-6 border-2 border-green-200">
            <div className="relative">
              <div className="w-24 h-24 mx-auto relative">
                <div className="absolute inset-0 border-4 border-green-200 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-green-600 rounded-full border-t-transparent animate-spin"></div>
                <CheckCircle className="w-12 h-12 text-green-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Comic wird finalisiert</h2>
              <p className="text-lg text-gray-600">Dein Comic wird jetzt fertiggestellt und steht in Kürze zur Verfügung</p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-green-800">
                  Das fertige Comic wird automatisch in deinem Dashboard verfügbar sein
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-red-500/10 via-purple-500/5 to-blue-500/10 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen py-4 sm:py-8 px-2 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl p-3 sm:p-6 mb-4 sm:mb-6 border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="flex-1">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Comic Preview</h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Review and confirm all pages before creating the PDF.
                </p>
              </div>
              <div className="text-center sm:text-right flex-shrink-0">
                <div className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-red-600 to-blue-600 text-transparent bg-clip-text">
                  {approvedCount}/12
                </div>
                <div className="text-xs text-gray-600">Pages confirmed</div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-50 to-blue-50 border border-red-200 rounded-lg p-2 sm:p-4 mb-3 sm:mb-4">
              <p className="text-xs sm:text-sm text-gray-800 leading-snug">
                <strong>Tip:</strong> Accept pages as they are for best print quality. Use regeneration only if needed (once per page).
              </p>
            </div>

            {!allApproved && missingApprovals.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-amber-900 mb-1">
                      Not all pages confirmed yet
                    </p>
                    <p className="text-xs text-amber-800">
                      Missing confirmations ({missingApprovals.length}): <strong>{missingLabels.join(', ')}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="sticky bottom-0 left-0 right-0 bg-white pt-3 pb-2 sm:pb-0 sm:static border-t sm:border-t-0 -mx-3 px-3 sm:mx-0 sm:px-0">
              <button
                onClick={handleFinalizeAll}
                disabled={!allApproved || isFinalizing}
                className={`w-full py-3 sm:py-4 rounded-lg transition-all font-bold text-sm sm:text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  allApproved
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isFinalizing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="animate-spin" size={18} />
                    <span className="text-sm sm:text-base">Creating PDF...</span>
                  </span>
                ) : allApproved ? (
                  'Finalize Ebook/Preview'
                ) : (
                  `Confirm ${missingApprovals.length} more page${missingApprovals.length !== 1 ? 's' : ''}`
                )}
              </button>
              {!allApproved && (
                <p className="text-xs text-center text-gray-500 mt-2">
                  Please confirm all pages before creating the PDF.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 pb-20 sm:pb-0">
            {pageList.map(page => page.path && (
              <PageCard
                key={page.key}
                pageKey={page.key}
                pageNumber={page.label}
                imagePath={page.path}
                originalPath={originalPages[page.key as keyof typeof originalPages]}
                isApproved={pageApprovals[page.key] || false}
                isEditing={editingPages.has(page.key)}
                panelCount={panelCounts[page.key] || 5}
                onApprove={() => handleApprove(page.key)}
                onUnapprove={() => handleUnapprove(page.key)}
                onEdit={(prompt, panelNumber) => handleEdit(page.key, prompt, panelNumber)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagePreviewModal;
