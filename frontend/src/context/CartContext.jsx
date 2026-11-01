import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated, isLoading, role } = useAuth();
  const [cart, setCart] = useState({ items: [] });
  const [isCartLoading, setIsCartLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated || role !== 'USER') {
      setCart({ items: [] });
      return { success: true };
    }
    setIsCartLoading(true);
    const result = await api.get('/api/cart');
    if (result.data?.success) setCart(result.data.cart);
    setIsCartLoading(false);
    return result.error
      ? { success: false, error: result.error.message }
      : { success: true, cart: result.data.cart };
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (!isLoading) refreshCart();
  }, [isLoading, refreshCart]);

  const itemCount = useMemo(
    () => (cart.items || []).reduce((total, item) => total + item.quantity, 0),
    [cart],
  );
  const value = useMemo(
    () => ({ cart, itemCount, isCartLoading, refreshCart }),
    [cart, itemCount, isCartLoading, refreshCart],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider.');
  return context;
}
