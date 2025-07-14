// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import Home from './pages/Home';
import MainPage from './components/MainPage';
import EarthData from './components/EarthData';
import RegistrationModal from './components/RegistrationModal';
import ProfileHeader from './components/ProfileHeader';
import Chat from './components/Chat';
import PolygonDrawMap from './components/ForMap/PolygonDrawMap';
import AppLayout from './components/ForMap/AppLayout';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // <-- НОВОЕ СОСТОЯНИЕ ДЛЯ РОЛИ
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role'); // <-- УДАЛЯЕМ РОЛЬ ПРИ ВЫХОДЕ
    setIsAuthenticated(false);
    setUserRole(null); // <-- ОЧИЩАЕМ РОЛЬ
    navigate('/login');
  }, [navigate]);

  const handleLoginSuccess = useCallback((role) => { // <-- ТЕПЕРЬ ПРИНИМАЕТ 'role'
    setIsAuthenticated(true);
    setUserRole(role); // <-- УСТАНАВЛИВАЕМ РОЛЬ
    navigate('/dashboard');
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role'); // <-- ПОЛУЧАЕМ РОЛЬ ИЗ LOCALSTORAGE
    const isAuth = !!token;
    setIsAuthenticated(isAuth);
    setUserRole(role); // <-- УСТАНАВЛИВАЕМ РОЛЬ ПРИ ЗАГРУЗКЕ

    const publicPaths = ['/', '/login', '/register', '/home'];
    if (!isAuth && !publicPaths.includes(location.pathname)) {
      navigate('/login');
    }
  }, [location.pathname, navigate]);

  const isAdmin = userRole === 'ROLE_ADMIN'; // <-- ПРОВЕРКА НА АДМИНА

  return (
    <>
      {isAuthenticated && <ProfileHeader onLogout={handleLogout} />}

      <div className="main-content-wrapper" style={{ paddingTop: isAuthenticated ? '30px' : '0' }}>
        <Routes>
          {!isAuthenticated && (
            <>
              <Route path="/login" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
              <Route path="/register" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
              <Route path="*" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
            </>
          )}

          {isAuthenticated && (
            <>
              <Route path="/home" element={<Home />} />
              <Route 
                path="/dashboard" 
                element={
                  <AppLayout handleLogout={handleLogout}>
                    <PolygonDrawMap handleLogout={handleLogout} />
                  </AppLayout>
                } 
              />
              <Route path="/earthdata" element={<EarthData />} />
              <Route path="/chat" element={<Chat handleLogout={handleLogout} />} />
              <Route path="/" element={<MainPage />} />

              {/* МАРШРУТЫ ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА */}
              {isAdmin && ( // <-- УСЛОВНЫЙ РЕНДЕРИНГ
                <>
                  <Route path="/admin-panel" element={<div><h1>Панель администратора</h1><p>Добро пожаловать, администратор!</p></div>} />
                </>
              )}

              <Route path="*" element={<MainPage />} />
            </>
          )}
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;