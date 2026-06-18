import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Broadcast from './pages/Broadcast';
import Leads from './pages/Leads';
import Posts from './pages/Posts';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import AccountAutomation from './pages/AccountAutomation';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    sessionStorage.getItem('isAuthenticated') === 'true' || localStorage.getItem('isAuthenticated') === 'true'
  );

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública de Login (redireciona para / se já estiver autenticado) */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLoginSuccess} />
            )
          }
        />

        {/* Rotas protegidas (redireciona para /login se não estiver autenticado) */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <MainLayout />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="leads" element={<Leads />} />
          <Route path="posts" element={<Posts />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="automation" element={<AccountAutomation />} />
        </Route>

        {/* Qualquer outra rota redireciona com base no status do login */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

