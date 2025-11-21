import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Users, BookOpen, ShoppingBag, RefreshCw, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Search, AlertCircle, Loader, CreditCard, AlertTriangle, Wrench, PlusCircle, DollarSign } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  credit_balance: number;
}

interface AdminComic {
  id: string;
  user_id: string;
  user_email: string;
  status: string;
  created_at: string;
  input_data: {
    heroName?: string;
    comicTitle?: string;
  };
  output_data: any;
  credits_used: number;
  progress: number;
  current_page: number;
  error_message?: string;
  last_heartbeat_at?: string;
}

interface AdminCreditTransaction {
  id: number;
  user_id: string;
  user_email: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  comic_job_id?: string;
  stripe_payment_intent_id?: string;
}

interface UserStats {
  totalComics: number;
  completedComics: number;
  failedComics: number;
  processingComics: number;
  totalCreditsUsed: number;
  totalCreditsPurchased: number;
}

interface AdminOrder {
  id: number;
  user_id: string | null;
  user_email: string | null;
  checkout_session_id: string;
  payment_intent_id: string;
  amount_total: number;
  currency: string;
  payment_status: string;
  status: string;
  created_at: string;
}

interface OrphanedOrder {
  order_id: number;
  stripe_customer_id: string;
  amount_total: number;
  currency: string;
  payment_status: string;
  has_stripe_customer_entry: boolean;
  potential_user_email: string | null;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [comics, setComics] = useState<AdminComic[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [transactions, setTransactions] = useState<AdminCreditTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'comics' | 'orders' | 'transactions'>('comics');
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandedComics, setExpandedComics] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState('');
  const [comicStatusFilter, setComicStatusFilter] = useState<string>('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [orphanedOrders, setOrphanedOrders] = useState<OrphanedOrder[]>([]);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [reconcileEmail, setReconcileEmail] = useState('');
  const [reconcileCredits, setReconcileCredits] = useState('');
  const [reconcilePackageName, setReconcilePackageName] = useState('');
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showManualCreditModal, setShowManualCreditModal] = useState(false);
  const [manualCreditEmail, setManualCreditEmail] = useState('');
  const [manualCreditAmount, setManualCreditAmount] = useState('');
  const [manualCreditReason, setManualCreditReason] = useState('');
  const [manualCreditLoading, setManualCreditLoading] = useState(false);
  const [manualCreditMessage, setManualCreditMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [userCreditSummary, setUserCreditSummary] = useState<any>(null);

  useEffect(() => {
    checkAdminAndLoadData();
  }, [user]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh && isAdmin) {
      interval = setInterval(() => {
        loadAllData();
      }, 30000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, isAdmin]);

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const toggleComicExpanded = (comicId: string) => {
    const newExpanded = new Set(expandedComics);
    if (newExpanded.has(comicId)) {
      newExpanded.delete(comicId);
    } else {
      newExpanded.add(comicId);
    }
    setExpandedComics(newExpanded);
  };

  const getUserStats = (userId: string): UserStats => {
    const userComics = comics.filter(c => c.user_id === userId);
    const userTransactions = transactions.filter(t => t.user_id === userId);

    const purchaseTransactions = userTransactions.filter(t => t.transaction_type === 'purchase');
    const totalCreditsPurchased = purchaseTransactions.reduce((sum, t) => sum + t.amount, 0);

    console.log(`User ${userId} stats:`, {
      totalTransactions: userTransactions.length,
      purchaseTransactions: purchaseTransactions.length,
      transactionTypes: userTransactions.map(t => ({ type: t.transaction_type, amount: t.amount })),
      totalCreditsPurchased,
    });

    return {
      totalComics: userComics.length,
      completedComics: userComics.filter(c => c.status === 'completed').length,
      failedComics: userComics.filter(c => c.status === 'failed').length,
      processingComics: userComics.filter(c => c.status === 'processing').length,
      totalCreditsUsed: userComics.reduce((sum, c) => sum + (c.credits_used || 0), 0),
      totalCreditsPurchased,
    };
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredComics = comics.filter(comic => {
    if (comicStatusFilter === 'all') return true;
    return comic.status === comicStatusFilter;
  });

  const filteredTransactions = transactions.filter(transaction => {
    if (transactionTypeFilter === 'all') return true;
    return transaction.transaction_type === transactionTypeFilter;
  });

  const processingCount = comics.filter(c => c.status === 'processing').length;
  const completedCount = comics.filter(c => c.status === 'completed').length;
  const failedCount = comics.filter(c => c.status === 'failed').length;
  const awaitingApprovalCount = comics.filter(c => c.status === 'awaiting_approval').length;
  const totalCreditsPurchased = transactions
    .filter(t => t.transaction_type === 'purchase')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPurchaseTransactions = transactions.filter(t => t.transaction_type === 'purchase').length;

  const checkAdminAndLoadData = async () => {
    console.log('checkAdminAndLoadData called', { user });

    if (!user) {
      console.log('No user found, redirecting to home');
      navigate('/');
      return;
    }

    console.log('User email:', user.email);

    if (user.email !== 'ricrieg@gmail.com') {
      alert('Access denied. Admin only.');
      navigate('/');
      return;
    }

    console.log('Admin verified, setting isAdmin to true');
    setIsAdmin(true);
    await loadAllData();
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      console.log('Loading admin data...');

      // Add timeout to detect hanging requests
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      );

      const dataPromise = Promise.all([
        supabase.rpc('get_all_users_admin'),
        supabase.rpc('get_all_comics_admin'),
        supabase.rpc('get_all_orders_admin'),
        supabase.rpc('get_all_credit_transactions_admin'),
      ]);

      const [usersResult, comicsResult, ordersResult, transactionsResult] = await Promise.race([
        dataPromise,
        timeout
      ]) as any;

      // Load orphaned orders for reconciliation
      const { data: orphanedData, error: orphanedError } = await supabase.rpc('diagnose_missing_credits_admin');
      if (!orphanedError && orphanedData) {
        const orphaned = orphanedData.filter((o: any) => !o.potential_user_id || o.potential_user_email === null);
        setOrphanedOrders(orphaned);
      }

      console.log('Users result:', usersResult);
      console.log('Comics result:', comicsResult);
      console.log('Orders result:', ordersResult);
      console.log('Transactions result:', transactionsResult);

      if (usersResult.error) {
        console.error('Error loading users:', usersResult.error);
        alert(`Error loading users: ${usersResult.error.message}`);
      } else {
        setUsers(usersResult.data || []);
      }

      if (comicsResult.error) {
        console.error('Error loading comics:', comicsResult.error);
        alert(`Error loading comics: ${comicsResult.error.message}`);
      } else {
        setComics(comicsResult.data || []);
      }

      if (ordersResult.error) {
        console.error('Error loading orders:', ordersResult.error);
        alert(`Error loading orders: ${ordersResult.error.message}`);
      } else {
        setOrders(ordersResult.data || []);
      }

      if (transactionsResult.error) {
        console.error('Error loading transactions:', transactionsResult.error);
        alert(`Error loading transactions: ${transactionsResult.error.message}`);
      } else {
        const transactionData = transactionsResult.data || [];
        console.log('Loaded transactions:', transactionData.length);
        console.log('Sample transactions:', transactionData.slice(0, 5));
        console.log('Purchase transactions:', transactionData.filter((t: any) => t.transaction_type === 'purchase').length);
        setTransactions(transactionData);
      }

      console.log('Admin data loaded successfully');
    } catch (error) {
      console.error('Error loading admin data:', error);
      alert(`Failed to load admin data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const openReconcileModal = (order: AdminOrder) => {
    setSelectedOrder(order);
    setReconcileEmail('');
    setReconcileCredits('');
    setReconcilePackageName('');
    setReconcileMessage(null);
    setShowReconcileModal(true);
  };

  const closeReconcileModal = () => {
    setShowReconcileModal(false);
    setSelectedOrder(null);
    setReconcileEmail('');
    setReconcileCredits('');
    setReconcilePackageName('');
    setReconcileMessage(null);
  };

  const openManualCreditModal = () => {
    setShowManualCreditModal(true);
    setManualCreditEmail('');
    setManualCreditAmount('');
    setManualCreditReason('');
    setManualCreditMessage(null);
    setUserCreditSummary(null);
  };

  const closeManualCreditModal = () => {
    setShowManualCreditModal(false);
    setManualCreditEmail('');
    setManualCreditAmount('');
    setManualCreditReason('');
    setManualCreditMessage(null);
    setUserCreditSummary(null);
  };

  const handleLookupUser = async () => {
    if (!manualCreditEmail) {
      setManualCreditMessage({ type: 'error', text: 'Please enter a user email' });
      return;
    }

    setManualCreditLoading(true);
    setManualCreditMessage(null);

    try {
      const { data, error } = await supabase.rpc('get_user_credit_summary_admin', {
        p_user_email: manualCreditEmail,
      });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        setUserCreditSummary(data);
        setManualCreditMessage({ type: 'success', text: 'User found!' });
      } else {
        setUserCreditSummary(null);
        setManualCreditMessage({ type: 'error', text: data?.error || 'User not found' });
      }
    } catch (error: any) {
      console.error('Error looking up user:', error);
      setUserCreditSummary(null);
      setManualCreditMessage({
        type: 'error',
        text: error.message || 'Failed to lookup user',
      });
    } finally {
      setManualCreditLoading(false);
    }
  };

  const handleManualAddCredits = async () => {
    if (!manualCreditEmail || !manualCreditAmount) {
      setManualCreditMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    const credits = parseInt(manualCreditAmount);
    if (isNaN(credits) || credits <= 0) {
      setManualCreditMessage({ type: 'error', text: 'Credits must be a positive number' });
      return;
    }

    setManualCreditLoading(true);
    setManualCreditMessage(null);

    try {
      const { data, error } = await supabase.rpc('manually_add_credits_admin', {
        p_user_email: manualCreditEmail,
        p_credits: credits,
        p_reason: manualCreditReason || 'Manual credit addition by admin',
      });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        setManualCreditMessage({
          type: 'success',
          text: `Successfully added ${data.credits_added} credits to ${data.user_email}. Previous balance: ${data.previous_balance}, New balance: ${data.new_balance}`,
        });

        setTimeout(() => {
          closeManualCreditModal();
          loadAllData();
        }, 3000);
      } else {
        setManualCreditMessage({
          type: 'error',
          text: data?.error || 'Failed to add credits',
        });
      }
    } catch (error: any) {
      console.error('Error adding credits:', error);
      setManualCreditMessage({
        type: 'error',
        text: error.message || 'An error occurred while adding credits',
      });
    } finally {
      setManualCreditLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedOrder || !reconcileEmail || !reconcileCredits) {
      setReconcileMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setReconcileLoading(true);
    setReconcileMessage(null);

    try {
      const { data, error } = await supabase.rpc('reconcile_order_with_details_admin', {
        p_order_id: selectedOrder.id,
        p_user_email: reconcileEmail,
        p_credits: parseInt(reconcileCredits),
        p_package_name: reconcilePackageName || null,
      });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        setReconcileMessage({
          type: 'success',
          text: `Successfully added ${data.credits_added} credits to ${data.user_email}. New balance: ${data.new_balance}`,
        });

        setTimeout(() => {
          closeReconcileModal();
          loadAllData();
        }, 2000);
      } else {
        setReconcileMessage({
          type: 'error',
          text: data?.error || 'Failed to reconcile order',
        });
      }
    } catch (error: any) {
      console.error('Error reconciling order:', error);
      setReconcileMessage({
        type: 'error',
        text: error.message || 'An error occurred during reconciliation',
      });
    } finally {
      setReconcileLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
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
            <Clock className="w-3 h-3" />
            Awaiting Approval
          </span>
        );
      case 'processing':
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
            <RefreshCw className="w-3 h-3" />
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
            {status}
          </span>
        );
    }
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
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
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={openManualCreditModal}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                Add Credits
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Users</p>
                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Total Comics</p>
                <p className="text-2xl font-bold text-gray-900">{comics.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <Loader className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-gray-900">{processingCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-xs text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{failedCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-xs text-gray-600">Awaiting</p>
                <p className="text-2xl font-bold text-gray-900">{awaitingApprovalCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-xs text-gray-600">Orders</p>
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Credits Sold</p>
                <p className="text-2xl font-bold text-gray-900">{totalCreditsPurchased}</p>
                <p className="text-xs text-gray-500">{totalPurchaseTransactions} purchases</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'users'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('comics')}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'comics'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Comics ({comics.length})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'orders'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-6 py-4 font-semibold transition-colors ${
                  activeTab === 'transactions'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Transactions ({transactions.length})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Refresh Controls */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={loadAllData}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Auto-refresh (30s)
                </label>
              </div>
              {activeTab === 'users' && (
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              {activeTab === 'comics' && (
                <select
                  value={comicStatusFilter}
                  onChange={(e) => setComicStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="awaiting_approval">Awaiting Approval</option>
                </select>
              )}
              {activeTab === 'transactions' && (
                <select
                  value={transactionTypeFilter}
                  onChange={(e) => setTransactionTypeFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  <option value="purchase">Purchase</option>
                  <option value="welcome_bonus">Welcome Bonus</option>
                  <option value="generation">Generation</option>
                  <option value="edit">Edit</option>
                  <option value="refund">Refund</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              )}
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 w-8"></th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Credits</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Comics</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const stats = getUserStats(user.id);
                      const isExpanded = expandedUsers.has(user.id);
                      return (
                        <React.Fragment key={user.id}>
                          <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleUserExpanded(user.id)}>
                            <td className="py-3 px-4">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                            <td className="py-3 px-4 font-medium">{user.email}</td>
                            <td className="py-3 px-4">{user.credit_balance}</td>
                            <td className="py-3 px-4">
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {stats.totalComics} total ({stats.completedComics} ok, {stats.failedComics} failed)
                              </span>
                            </td>
                            <td className="py-3 px-4">{new Date(user.created_at).toLocaleDateString()}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={5} className="py-4 px-4">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-4 gap-4">
                                    <div className="bg-white p-3 rounded-lg">
                                      <p className="text-xs text-gray-600">Total Comics</p>
                                      <p className="text-xl font-bold">{stats.totalComics}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg">
                                      <p className="text-xs text-gray-600">Credits Purchased</p>
                                      <p className="text-xl font-bold text-green-600">{stats.totalCreditsPurchased}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg">
                                      <p className="text-xs text-gray-600">Credits Used</p>
                                      <p className="text-xl font-bold text-blue-600">{stats.totalCreditsUsed}</p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg">
                                      <p className="text-xs text-gray-600">Failed Jobs</p>
                                      <p className="text-xl font-bold text-red-600">{stats.failedComics}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Recent Comics</h4>
                                    <div className="space-y-2">
                                      {comics.filter(c => c.user_id === user.id).slice(0, 5).map((comic) => (
                                        <div key={comic.id} className="bg-white p-2 rounded flex items-center justify-between">
                                          <div>
                                            <p className="font-medium text-sm">{comic.input_data?.comicTitle || 'Untitled'}</p>
                                            <p className="text-xs text-gray-600">{new Date(comic.created_at).toLocaleString()}</p>
                                          </div>
                                          {getStatusBadge(comic.status)}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold mb-2">Recent Transactions</h4>
                                    <div className="space-y-2">
                                      {transactions.filter(t => t.user_id === user.id).slice(0, 5).map((transaction) => (
                                        <div key={transaction.id} className="bg-white p-2 rounded flex items-center justify-between">
                                          <div>
                                            <p className="font-medium text-sm">{transaction.description}</p>
                                            <p className="text-xs text-gray-600">{new Date(transaction.created_at).toLocaleString()}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                              {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                                            </p>
                                            <p className="text-xs text-gray-600">Balance: {transaction.balance_after}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Comics Tab */}
            {activeTab === 'comics' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 w-8"></th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Comic Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Progress</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Credits</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComics.map((comic) => {
                      const isExpanded = expandedComics.has(comic.id);
                      return (
                        <React.Fragment key={comic.id}>
                          <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleComicExpanded(comic.id)}>
                            <td className="py-3 px-4">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </td>
                            <td className="py-3 px-4 text-sm">{comic.user_email}</td>
                            <td className="py-3 px-4">
                              <div className="font-medium">{comic.input_data?.comicTitle || 'Untitled'}</div>
                              <div className="text-sm text-gray-600">{comic.input_data?.heroName || 'Unknown Hero'}</div>
                            </td>
                            <td className="py-3 px-4">{getStatusBadge(comic.status)}</td>
                            <td className="py-3 px-4">
                              <div className="text-sm">{comic.progress || 0}%</div>
                              {comic.current_page !== undefined && comic.current_page !== null && (
                                <div className="text-xs text-gray-600">Page {comic.current_page}</div>
                              )}
                            </td>
                            <td className="py-3 px-4">{comic.credits_used || 0}</td>
                            <td className="py-3 px-4 text-sm">{new Date(comic.created_at).toLocaleString()}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={7} className="py-4 px-4">
                                <div className="space-y-4">
                                  {comic.error_message && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                        <div className="flex-1">
                                          <h4 className="font-semibold text-red-900 mb-1">Error Message</h4>
                                          <p className="text-sm text-red-800">{comic.error_message}</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-lg">
                                      <h4 className="font-semibold mb-2">Input Data</h4>
                                      <div className="text-sm space-y-1">
                                        <p><span className="font-medium">Hero Name:</span> {comic.input_data?.heroName || 'N/A'}</p>
                                        <p><span className="font-medium">Comic Title:</span> {comic.input_data?.comicTitle || 'N/A'}</p>
                                        <p><span className="font-medium">Story:</span> {comic.input_data?.storyDescription ? comic.input_data.storyDescription.substring(0, 100) + '...' : 'N/A'}</p>
                                        <p><span className="font-medium">Character Style:</span> {comic.input_data?.characterStyle || 'N/A'}</p>
                                        <p><span className="font-medium">Illustration Style:</span> {comic.input_data?.illustrationStyle || 'N/A'}</p>
                                        <p><span className="font-medium">Language:</span> {comic.input_data?.storyLanguage || 'N/A'}</p>
                                      </div>
                                    </div>
                                    <div className="bg-white p-4 rounded-lg">
                                      <h4 className="font-semibold mb-2">Job Details</h4>
                                      <div className="text-sm space-y-1">
                                        <p><span className="font-medium">Job ID:</span> <span className="font-mono text-xs">{comic.id}</span></p>
                                        <p><span className="font-medium">Status:</span> {comic.status}</p>
                                        <p><span className="font-medium">Progress:</span> {comic.progress || 0}%</p>
                                        <p><span className="font-medium">Current Page:</span> {comic.current_page !== undefined ? comic.current_page : 'N/A'}</p>
                                        <p><span className="font-medium">Credits Used:</span> {comic.credits_used || 0}</p>
                                        {comic.last_heartbeat_at && (
                                          <p><span className="font-medium">Last Heartbeat:</span> {new Date(comic.last_heartbeat_at).toLocaleString()}</p>
                                        )}
                                        {comic.output_data?.comicUrl && (
                                          <p><span className="font-medium">Comic URL:</span> <a href={comic.output_data.comicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View PDF</a></p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {comic.output_data?.generatedPages && Object.keys(comic.output_data.generatedPages).length > 0 && (
                                    <div className="bg-white p-4 rounded-lg">
                                      <h4 className="font-semibold mb-2">Generated Pages</h4>
                                      <div className="grid grid-cols-6 gap-2">
                                        {Object.entries(comic.output_data.generatedPages).map(([key, value]) => (
                                          <div key={key} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded text-center">
                                            {key}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                {orphanedOrders.length > 0 && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-orange-900 mb-1">
                          {orphanedOrders.length} Order{orphanedOrders.length !== 1 ? 's' : ''} Need Reconciliation
                        </h3>
                        <p className="text-sm text-orange-800">
                          These orders are missing user associations. Credits may not have been added correctly.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Payment Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Order Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => {
                        const isOrphaned = !order.user_email && order.payment_status === 'paid';
                        return (
                          <tr key={order.id} className={`border-b border-gray-100 hover:bg-gray-50 ${isOrphaned ? 'bg-orange-50' : ''}`}>
                            <td className="py-3 px-4">
                              {order.user_email ? (
                                order.user_email
                              ) : (
                                <span className="flex items-center gap-2 text-orange-600">
                                  <AlertTriangle className="w-4 h-4" />
                                  No user linked
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {(order.amount_total / 100).toFixed(2)} {order.currency.toUpperCase()}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                order.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {order.payment_status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                order.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : order.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">{new Date(order.created_at).toLocaleDateString()}</td>
                            <td className="py-3 px-4">
                              {isOrphaned && (
                                <button
                                  onClick={() => openReconcileModal(order)}
                                  className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors text-sm"
                                >
                                  <Wrench className="w-3 h-3" />
                                  Reconcile
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Balance After</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm">{transaction.user_email}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                            transaction.transaction_type === 'purchase'
                              ? 'bg-green-100 text-green-800'
                              : transaction.transaction_type === 'refund'
                              ? 'bg-orange-100 text-orange-800'
                              : transaction.transaction_type === 'welcome_bonus'
                              ? 'bg-purple-100 text-purple-800'
                              : (transaction.transaction_type === 'generation' || transaction.transaction_type === 'edit')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {transaction.transaction_type === 'purchase' && <CreditCard className="w-3 h-3" />}
                            {transaction.transaction_type === 'refund' && <RefreshCw className="w-3 h-3" />}
                            {(transaction.transaction_type === 'generation' || transaction.transaction_type === 'edit') && <BookOpen className="w-3 h-3" />}
                            {transaction.transaction_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-bold ${
                            transaction.amount > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium">{transaction.balance_after}</td>
                        <td className="py-3 px-4 text-sm max-w-md">
                          <div className="truncate">{transaction.description}</div>
                          {transaction.comic_job_id && (
                            <div className="text-xs text-gray-500 font-mono">Job: {transaction.comic_job_id.substring(0, 8)}...</div>
                          )}
                          {transaction.stripe_payment_intent_id && (
                            <div className="text-xs text-gray-500 font-mono">Stripe: {transaction.stripe_payment_intent_id.substring(0, 20)}...</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">{new Date(transaction.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Credit Addition Modal */}
      {showManualCreditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Manually Add Credits</h2>
                    <p className="text-sm text-gray-600">Add credits to any user account</p>
                  </div>
                </div>
                <button
                  onClick={closeManualCreditModal}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={manualCreditLoading}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Email <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={manualCreditEmail}
                      onChange={(e) => setManualCreditEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={manualCreditLoading}
                    />
                    <button
                      onClick={handleLookupUser}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      disabled={manualCreditLoading || !manualCreditEmail}
                    >
                      {manualCreditLoading ? 'Looking up...' : 'Lookup'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter the email and click Lookup to verify the user</p>
                </div>

                {userCreditSummary && userCreditSummary.success && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-semibold text-blue-900 mb-2">User Credit Summary</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-blue-700 font-medium">Current Balance</p>
                        <p className="text-2xl font-bold text-blue-900">{userCreditSummary.current_balance}</p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Total Purchased</p>
                        <p className="text-xl font-bold text-blue-900">{userCreditSummary.total_purchased}</p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Total Used</p>
                        <p className="text-xl font-bold text-blue-900">{userCreditSummary.total_used}</p>
                      </div>
                      <div>
                        <p className="text-blue-700 font-medium">Total Adjustments</p>
                        <p className="text-xl font-bold text-blue-900">{userCreditSummary.total_adjustments}</p>
                      </div>
                    </div>
                    {userCreditSummary.last_transaction && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <p className="text-blue-700 font-medium text-xs mb-1">Last Transaction</p>
                        <p className="text-xs text-blue-800">
                          {userCreditSummary.last_transaction.description} ({userCreditSummary.last_transaction.amount > 0 ? '+' : ''}{userCreditSummary.last_transaction.amount} credits)
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credits to Add <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={manualCreditAmount}
                    onChange={(e) => setManualCreditAmount(e.target.value)}
                    placeholder="100"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={manualCreditLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of credits to add to the user's account</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    value={manualCreditReason}
                    onChange={(e) => setManualCreditReason(e.target.value)}
                    placeholder="e.g., Compensation for failed purchase, Promotional credits, Support request, etc."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={manualCreditLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional - explain why credits are being added for audit trail</p>
                </div>
              </div>

              {manualCreditMessage && (
                <div className={`mb-4 p-4 rounded-lg ${
                  manualCreditMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm ${
                    manualCreditMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {manualCreditMessage.text}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeManualCreditModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={manualCreditLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualAddCredits}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={manualCreditLoading || !manualCreditEmail || !manualCreditAmount}
                >
                  {manualCreditLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      Add Credits
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation Modal */}
      {showReconcileModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Reconcile Order</h2>
                <button
                  onClick={closeReconcileModal}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={reconcileLoading}
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Order Details</h3>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Order ID:</span> {selectedOrder.id}</p>
                  <p><span className="font-medium">Amount:</span> {(selectedOrder.amount_total / 100).toFixed(2)} {selectedOrder.currency.toUpperCase()}</p>
                  <p><span className="font-medium">Payment Status:</span> {selectedOrder.payment_status}</p>
                  <p><span className="font-medium">Date:</span> {new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={reconcileEmail}
                    onChange={(e) => setReconcileEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={reconcileLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter the email of the user who made this purchase</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Credits <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    value={reconcileCredits}
                    onChange={(e) => setReconcileCredits(e.target.value)}
                    placeholder="100"
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={reconcileLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of credits to add to the user's account</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Package Name (optional)
                  </label>
                  <input
                    type="text"
                    value={reconcilePackageName}
                    onChange={(e) => setReconcilePackageName(e.target.value)}
                    placeholder="e.g., Starter Package"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={reconcileLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional package name for better tracking</p>
                </div>
              </div>

              {reconcileMessage && (
                <div className={`mb-4 p-4 rounded-lg ${
                  reconcileMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`text-sm ${
                    reconcileMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {reconcileMessage.text}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeReconcileModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={reconcileLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReconcile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={reconcileLoading || !reconcileEmail || !reconcileCredits}
                >
                  {reconcileLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Reconcile Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
