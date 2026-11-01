import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';
import ProductListPage from './pages/ProductListPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx';
import CartPage from './pages/CartPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import DefaultAddressPage from './pages/DefaultAddressPage.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import Layout from './components/Layout.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CartProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<ProductListPage />} />
              <Route path="/products/:productId" element={<ProductDetailPage />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
              <Route path="/admin/login" element={<AuthPage mode="admin" />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/cart" element={<RequireAuth roles={['USER']}><CartPage /></RequireAuth>} />
              <Route path="/checkout" element={<RequireAuth roles={['USER']}><CheckoutPage /></RequireAuth>} />
              <Route path="/orders" element={<RequireAuth roles={['USER']}><OrdersPage /></RequireAuth>} />
              <Route path="/orders/:orderId" element={<RequireAuth roles={['USER']}><OrderDetailPage /></RequireAuth>} />
              <Route path="/account/address" element={<RequireAuth roles={['USER']}><DefaultAddressPage /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth roles={['ADMIN']}><AdminDashboardPage /></RequireAuth>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </CartProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
export default App;
