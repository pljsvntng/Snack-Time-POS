import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {lazy,Suspense} from 'react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';

import Login from './pages/Login';
import POS from './pages/POS';
import NativeNavigation from './android/NativeNavigation';

const Dashboard=lazy(()=>import('./pages/Dashboard'));
const Products=lazy(()=>import('./pages/Products'));
const Inventory=lazy(()=>import('./pages/Inventory'));
const Transactions=lazy(()=>import('./pages/Transactions'));
const Reports=lazy(()=>import('./pages/Reports'));
const Users=lazy(()=>import('./pages/Users'));
const Settings=lazy(()=>import('./pages/Settings'));
const Screen=({component:Component})=><Suspense fallback={<div className="empty-state" role="status">Loading screen…</div>}><Component/></Suspense>;

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <NativeNavigation />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<ProtectedRoute roles={['admin']}><Screen component={Dashboard}/></ProtectedRoute>} />
              <Route path="/pos" element={<POS />} />
              <Route path="/products" element={<ProtectedRoute roles={['admin']}><Screen component={Products}/></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute roles={['admin']}><Screen component={Inventory}/></ProtectedRoute>} />
              <Route path="/transactions" element={<Screen component={Transactions}/>} />
              <Route path="/reports" element={<ProtectedRoute roles={['admin']}><Screen component={Reports}/></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute roles={['admin']}><Screen component={Users}/></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Screen component={Settings}/></ProtectedRoute>} />
            </Route>

            <Route path="/" element={<Navigate to="/pos" replace />} />
            <Route path="*" element={<Navigate to="/pos" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
