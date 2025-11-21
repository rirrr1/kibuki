import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUserSubscription, getUserOrders } from '../lib/stripe';
import { useAuth } from '../contexts/AuthContext';
import CreditBalance from './CreditBalance';
import { LogOut, User, Package, CreditCard, Home, Download, Eye, Calendar, ShoppingCart, Trash2, RefreshCw, CheckCircle, XCircle, Clock, Edit, Shield } from 'lucide-react';
import PhysicalOrderModal from './PhysicalOrderModal';

interface UserSubscription {
  subscription_status: string;
  price_id: string | null;
}

interface UserOrder {
  order_id: number;
  amount_total: number;
  currency: string;
  order_date: string;
  order_status: string;
}

interface UserComic {
  id: string;
  created_at: string;
  status: string;
  input_data: {
    heroName?: string;
    comicTitle?: string;
  };
  output_data: {
    comicUrl?: string;
    coverUrl?: string;
    interiorUrl?: string;
    generatedPages?: {
      cover?: string;
    };
  };
}

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [comics, setComics] = useState<UserComic[]>([]);
  const [loadingComics, setLoadingComics] = useState(true);
  const [showPhysicalOrderModal, setShowPhysicalOrderModal] = useState(false);
  const [selectedComic, setSelectedComic] = useState<UserComic | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      setLoading(false);
      loadUserComics();
    }
  }, [user]);

  const loadUserComics = async () => {
    if (!user) return;

    setLoadingComics(true);
    try {
      const { data, error } = await supabase
        .from('comic_generation_jobs')
        .select('id, created_at, status, input_data, output_data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading comics:', error);
        return;
      }

      setComics(data || []);
    } catch (error) {
      console.error('Error loading comics:', error);
    } finally {
      setLoadingComics(false);
    }
  };

  const downloadComic = async (comicUrl: string, fileName: string) => {
    try {
      const response = await fetch(comicUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(comicUrl, '_blank');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone. All your comics and data will be permanently deleted.'
    );

    if (!confirmed) return;

    const doubleConfirm = window.prompt(
      'Type "DELETE" to confirm account deletion:'
    );

    if (doubleConfirm !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    try {
      // Call Supabase function to delete user account
      const { error } = await supabase.rpc('delete_user_account');

      if (error) {
        throw error;
      }

      alert('Your account has been successfully deleted.');
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please contact support if this issue persists.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user?.email === 'ricrieg@gmail.com' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold"
                >
                  <User className="w-4 h-4" />
                  Admin Dashboard
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Credit Balance Large View */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Credits</h2>
              <CreditBalance variant="large" />
            </div>

            {/* My Comics */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">My Comics</h2>
              {loadingComics ? (
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your comics...</p>
                </div>
              ) : comics.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                  <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">You haven't created any comics yet</p>
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-lg hover:from-red-700 hover:to-blue-700 transition-all font-semibold"
                  >
                    Create Your First Comic
                  </button>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-6">
                  {comics.map((comic) => {
                    const heroName = comic.input_data?.heroName || 'Unknown Hero';
                    const comicTitle = comic.input_data?.comicTitle || 'Untitled Comic';
                    const coverImage = comic.output_data?.generatedPages?.cover;
                    const comicUrl = comic.output_data?.comicUrl;
                    const createdDate = new Date(comic.created_at).toLocaleDateString();
                    const status = comic.status;

                    const getStatusBadge = () => {
                      switch (status) {
                        case 'completed':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                              <CheckCircle className="w-3 h-3" />
                              Completed
                            </span>
                          );
                        case 'awaiting_approval':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                              <Edit className="w-3 h-3" />
                              Awaiting Approval
                            </span>
                          );
                        case 'processing':
                        case 'generating':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Processing
                            </span>
                          );
                        case 'failed':
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
                              <XCircle className="w-3 h-3" />
                              Failed
                            </span>
                          );
                        default:
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                              <Clock className="w-3 h-3" />
                              {status}
                            </span>
                          );
                      }
                    };

                    return (
                      <div key={comic.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                        {/* Comic Cover */}
                        <div className="relative aspect-[2/3] bg-gradient-to-br from-red-100 to-blue-100">
                          {coverImage ? (
                            <img
                              src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/comics/${coverImage}`}
                              alt={comicTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-16 h-16 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Comic Info */}
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-bold text-lg text-gray-900 line-clamp-1 flex-1">{comicTitle}</h3>
                            {getStatusBadge()}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">Starring: {heroName}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                            <Calendar className="w-3 h-3" />
                            <span>{createdDate}</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="space-y-2">
                            {status === 'awaiting_approval' && (
                              <button
                                onClick={() => {
                                  navigate('/', { state: { resumeJobId: comic.id } });
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-all font-semibold text-sm"
                              >
                                <Edit className="w-4 h-4" />
                                Continue Editing
                              </button>
                            )}
                            {status === 'completed' && comicUrl && (
                              <>
                                <button
                                  onClick={() => downloadComic(comicUrl, comicTitle)}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-blue-600 text-white rounded-lg hover:from-red-700 hover:to-blue-700 transition-all font-semibold text-sm"
                                >
                                  <Download className="w-4 h-4" />
                                  Download PDF
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedComic(comic);
                                    setShowPhysicalOrderModal(true);
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-sm"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  Order Physical Copy
                                </button>
                              </>
                            )}
                            {(status === 'processing' || status === 'generating') && (
                              <div className="w-full text-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                                Your comic is being generated...
                              </div>
                            )}
                            {status === 'failed' && (
                              <div className="w-full text-center px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
                                Generation failed. Credits have been refunded.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Admin Access Card */}
            {user?.email === 'ricrieg@gmail.com' && (
              <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6" />
                  <h3 className="text-lg font-bold">Admin Access</h3>
                </div>
                <p className="text-sm text-purple-100 mb-4">
                  You have administrator privileges. Access the admin dashboard to manage users, comics, and orders.
                </p>
                <button
                  onClick={() => navigate('/admin')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
                >
                  <Shield className="w-4 h-4" />
                  Open Admin Dashboard
                </button>
              </div>
            )}

            {/* Account Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">Account</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-600">Email:</span>
                  <p className="font-medium text-gray-900">{user?.email}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Member since:</span>
                  <p className="font-medium text-gray-900">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDeleteAccount}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-semibold mt-4 border border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Physical Order Modal */}
      {selectedComic && (
        <PhysicalOrderModal
          isOpen={showPhysicalOrderModal}
          onClose={() => {
            setShowPhysicalOrderModal(false);
            setSelectedComic(null);
          }}
          interiorPdfUrl={selectedComic.output_data?.interiorUrl || ''}
          coverPdfUrl={selectedComic.output_data?.coverUrl || ''}
          comicTitle={selectedComic.input_data?.comicTitle || 'Untitled Comic'}
          heroName={selectedComic.input_data?.heroName || 'Unknown Hero'}
        />
      )}
    </div>
  );
};

export default Dashboard;