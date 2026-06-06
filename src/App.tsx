import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Posts from './pages/Posts';
import Analytics from './pages/Analytics';
import Inbox from './pages/Inbox';
import Broadcast from './pages/Broadcast';
import Login from './pages/Login';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    sessionStorage.getItem('isAuthenticated') === 'true'
  );

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
              <Login onLogin={() => setIsAuthenticated(true)} />
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
          <Route path="posts" element={<Posts />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="broadcast" element={<Broadcast />} />
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

