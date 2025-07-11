import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

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
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  // Удаляем isDashboardPage, так как ProfileHeader будет всегда отображаться
  // const isDashboardPage = location.pathname === '/dashboard';

  return (
    <>
      {!isAuthenticated ? (
        <RegistrationModal onSuccess={handleLoginSuccess} />
      ) : (
        <>
          {/* ProfileHeader теперь рендерится на ВСЕХ страницах, без условий */}
          <ProfileHeader onLogout={handleLogout} />

          {/* Добавляем основной контейнер для контента, чтобы он не перекрывался заголовком */}
          <div className="main-content-wrapper">
            <Routes>
              <Route path="/register" element={<RegistrationModal onSuccess={handleLoginSuccess} />} />
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
              <Route path="/chat" element={<Chat />} />
              <Route path="/" element={<MainPage />} />
            </Routes>
          </div>
        </>
      )}
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
