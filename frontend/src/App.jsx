import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import NativeNavigation from './android/NativeNavigation';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <NativeNavigation />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<ProtectedRoute roles={['admin']}><Dashboard /></ProtectedRoute>} />
              <Route path="/pos" element={<POS />} />
              <Route path="/products" element={<ProtectedRoute roles={['admin']}><Products /></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute roles={['admin']}><Inventory /></ProtectedRoute>} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute roles={['admin']}><Users /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
            </Route>

            <Route path="/" element={<Navigate to="/pos" replace />} />
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
