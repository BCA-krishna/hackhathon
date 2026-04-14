import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import ErrorBanner from '../components/ErrorBanner';

export default function POSPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/pos/products');
      setProducts(res.data.data || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch POS products:', err);
      setError('Could not load product list. Try uploading some data first.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productName === product.productName);
      if (existing) {
        return prev.map((item) =>
          item.productName === product.productName ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productName) => {
    setCart((prev) => prev.filter((item) => item.productName !== productName));
  };

  const updateQuantity = (productName, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productName === productName) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      // For simplicity, we send each cart item as a separate sale record
      // A more robust system would have a Transaction/Order model
      await Promise.all(
        cart.map((item) =>
          axios.post('/api/pos/sale', {
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            category: item.category
          })
        )
      );
      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Checkout failed:', err);
      setError('Failed to complete sale. Database quota might be reached.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    p.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Spinner label="Initializing POS terminal..." />;

  return (
    <div className="flex h-full flex-col gap-6 md:flex-row">
      {/* Product Selection Area */}
      <div className="flex-1 space-y-6">
        <section className="rounded-3xl border border-slate-700 bg-slate-900/55 p-6 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Point of Sale</h1>
              <p className="text-sm text-slate-400 font-medium">Capture real-time business transactions</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-950/80 px-4 py-2 pl-10 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 sm:w-64"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>
        </section>

        <ErrorBanner message={error} />

        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-400 text-sm font-semibold flex items-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Sale recorded successfully! Dashboard updated.
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <motion.div
              layout
              key={product.productName}
              whileHover={{ scale: 1.02 }}
              onClick={() => addToCart(product)}
              className="cursor-pointer rounded-2xl border border-slate-700 bg-slate-900/60 p-5 transition-all hover:bg-slate-800/80 hover:shadow-xl hover:shadow-emerald-500/5"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {product.category || 'General'}
                </span>
                <span className="text-lg font-bold text-white">₹{product.price}</span>
              </div>
              <h3 className="font-semibold text-white leading-tight">{product.productName}</h3>
              <p className="mt-1 text-xs text-slate-500 italic">Recently sold</p>
            </motion.div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 font-medium border-2 border-dashed border-slate-800 rounded-3xl">
              No products matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>

      {/* Cart Area */}
      <div className="w-full shrink-0 md:w-80 lg:w-96">
        <div className="sticky top-6 rounded-3xl border border-emerald-500/20 bg-emerald-950/10 p-6 backdrop-blur-xl shadow-2xl shadow-emerald-500/5">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-white">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4Z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" />
            </svg>
            Review Sale
          </h2>

          <div className="max-h-[400px] space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div
                  key={item.productName}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.productName}</p>
                    <p className="text-xs text-slate-500">₹{item.price}/unit</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-slate-950 p-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.productName, -1); }}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-white hover:bg-slate-700"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-white">{item.quantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateQuantity(item.productName, 1); }}
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-white hover:bg-slate-700"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productName)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {cart.length === 0 && (
              <div className="py-20 text-center text-sm text-slate-500 italic">
                Cart is empty. Select products on the left.
              </div>
            )}
          </div>

          <div className="mt-8 space-y-4 border-t border-slate-800 pt-6">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tax (0%)</span>
              <span className="font-semibold text-white">₹0.00</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">Total Amount</span>
              <span className="text-2xl font-bold text-emerald-400">₹{calculateTotal()}</span>
            </div>
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isProcessing}
              className="w-full rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Spinner size="sm" /> Recording...
                </>
              ) : (
                <>
                   Complete Sale
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
