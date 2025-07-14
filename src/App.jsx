import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import Home from './pages/Home';
import MainPage from './components/MainPage';
import EarthData from './components/EarthData';
import RegistrationModal from './components/RegistrationModal'; // Предполагается, что это ваша страница входа/регистрации
import ProfileHeader from './components/ProfileHeader';
import Chat from './components/Chat';
import PolygonDrawMap from './components/ForMap/PolygonDrawMap';
import AppLayout from './components/ForMap/AppLayout';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const navigate = useNavigate(); // Инициализируем хук навигации

  // useCallback для handleLogout, чтобы он не пересоздавался постоянно
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    navigate('/login'); // Перенаправляем на страницу входа после выхода
  }, [navigate]); // Зависимость от navigate

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
    navigate('/dashboard'); // Перенаправляем на дашборд после успешного входа
  }, [navigate]); // Зависимость от navigate

  useEffect(() => {
    const token = localStorage.getItem('token');
    const isAuth = !!token;
    setIsAuthenticated(isAuth);

    // Логика перенаправления, если пользователь не аутентифицирован
    // и пытается получить доступ к защищенным маршрутам
    const publicPaths = ['/', '/login', '/register', '/home']; // Определяем публичные маршруты
    if (!isAuth && !publicPaths.includes(location.pathname)) {
      navigate('/login');
    }
  }, [location.pathname, navigate]); // Добавляем navigate в зависимости

  return (
    <>
      {/* ProfileHeader всегда отображается, если пользователь аутентифицирован */}
      {isAuthenticated && <ProfileHeader onLogout={handleLogout} />}

      {/* Условный рендеринг маршрутов в зависимости от статуса аутентификации */}
      <div className="main-content-wrapper" style={{ paddingTop: isAuthenticated ? '30px' : '0' }}>
        <Routes>
          {/* Маршруты для неаутентифицированных пользователей */}
          {!isAuthenticated && (
            <>
              <Route path="/login" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
              <Route path="/register" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
              {/* Перенаправление на страницу входа по умолчанию, если не аутентифицирован */}
              <Route path="*" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
            </>
          )}

          {/* Маршруты для аутентифицированных пользователей */}
          {isAuthenticated && (
            <>
              <Route path="/home" element={<Home />} />
              
              {/* AppLayout оборачивает PolygonDrawMap и получает handleLogout */}
              <Route 
                path="/dashboard" 
                element={
                  <AppLayout handleLogout={handleLogout}>
                    <PolygonDrawMap handleLogout={handleLogout} /> {/* Передаем handleLogout в PolygonDrawMap */}
                  </AppLayout>
                } 
              />
              
              <Route path="/earthdata" element={<EarthData />} />
              {/* ПЕРЕДАЕМ handleLogout в Chat */}
              <Route path="/chat" element={<Chat handleLogout={handleLogout} />} /> 
              
              <Route path="/" element={<MainPage />} /> {/* Главная страница для аутентифицированных */}
              {/* Запасной маршрут для аутентифицированных пользователей */}
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
