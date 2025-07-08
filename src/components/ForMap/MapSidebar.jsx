// components/ForMap/MapSidebar.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MapSidebar.css'; // Import the updated CSS

export default function MapSidebar({
  polygons,
  selectedPolygon,
  setSelectedPolygon,
  deletePolygon,
  handleEditPolygon,
  crops,
  loadingCrops,
  cropsError,
  fetchCropsFromAPI,
  clearAllCrops,
  updatePolygonCrop,
  calculateArea,
  formatArea,
  startDrawing,
  stopDrawing,
  handleStopAndSaveEdit,
  isDrawing,
  isEditingMode,
  clearAll,
  handleLogout,
  showMyPolygons,
  updatePolygonName,
  updatePolygonComment,
  isSavingPolygon,
  isFetchingPolygons,
  showCropsSection,
  savePolygonToDatabase,
}) {

  const [isBurgerMenuOpen, setIsBurgerMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('map');
  const [showPolygonsList, setShowPolygonsList] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/') setActiveSection('home');
    else if (location.pathname === '/dashboard') setActiveSection('map');
    else if (location.pathname === '/chat') setActiveSection('ai-chat');
    else if (location.pathname === '/earthdata') setActiveSection('soil-data');
    else setActiveSection('');
  }, [location.pathname]);

  const handleNavigate = (path, section) => {
    setIsBurgerMenuOpen(false);
    setActiveSection(section);
    navigate(path);
  };

  const toggleBurgerMenu = () => {
    setIsBurgerMenuOpen(prev => !prev);
  };

  return (
    <div className={`map-sidebar-container`}>
      {/* Burger Menu Button */}
      <button className="burger-menu-icon" onClick={toggleBurgerMenu} aria-label="Открыть/закрыть меню">
        {isBurgerMenuOpen ? '✕' : '☰'}
      </button>

      {/* Dropdown Menu */}
      {isBurgerMenuOpen && (
        <div className="map-sidebar-dropdown-menu">
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/', 'home'); }}
            className={`map-menu-item ${activeSection === 'home' ? 'active' : ''}`}
          >
            🏠 <span className="menu-item-text">Главная</span>
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/dashboard', 'map'); }}
            className={`map-menu-item ${activeSection === 'map' ? 'active' : ''}`}
          >
            🗺️ <span className="menu-item-text">Карта</span>
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/chat', 'ai-chat'); }}
            className={`map-menu-item ${activeSection === 'ai-chat' ? 'active' : ''}`}
          >
            🤖 <span className="menu-item-text">ИИ-чат</span>
          </a>
          <a
            href="#"
            onClick={e => { e.preventDefault(); handleNavigate('/earthdata', 'soil-data'); }}
            className={`map-menu-item ${activeSection === 'soil-data' ? 'active' : ''}`}
          >
            🌱 <span className="menu-item-text">Данные почвы</span>
          </a>

          <button onClick={handleLogout} className="map-menu-item map-logout">
            🚪 <span className="menu-item-text">Выйти</span>
          </button>
        </div>
      )}

      {/* Wrapper for scrollable content */}
      <div className="map-sidebar-content-wrapper">
        <h2 className="map-sidebar-section-title" data-text="Управление картой">Управление картой</h2>
        <hr className="map-sidebar-hr" />

        <div className="map-sidebar-controls">
          <button
            onClick={startDrawing}
            disabled={isDrawing || isEditingMode || isSavingPolygon || isFetchingPolygons}
            className="map-sidebar-button draw-button"
            aria-label={isDrawing ? 'Рисование активно' : 'Начать рисование полигона'}
          >
            {isDrawing ? '✏️ Рисую' : '✏️ Рисовать'}
          </button>

          <button
            onClick={clearAll}
            disabled={isSavingPolygon || isFetchingPolygons || polygons.length === 0}
            className="map-sidebar-button clear-button"
            aria-label="Очистить все полигоны"
          >
            🗑️ Очистить
          </button>

          <button
            onClick={() => {
              if (!showPolygonsList) {
                showMyPolygons();
              }
              setShowPolygonsList(prev => !prev);
            }}
            disabled={isSavingPolygon || isFetchingPolygons || isDrawing || isEditingMode}
            className="map-sidebar-button toggle-list-button"
            aria-label={isFetchingPolygons ? 'Загружаю список' : (showPolygonsList ? 'Скрыть список полигонов' : 'Показать список полигонов')}
          >
            {isFetchingPolygons ? '📂 Загружаю...' : (showPolygonsList ? '🙈 Список' : '👀 Список')}
          </button>
        </div>

        <hr className="map-sidebar-hr" />

        {showPolygonsList && polygons.length > 0 && (
          <div className="polygon-list-section">
            <h3 className="polygon-list-header" data-text={`Полигоны (${polygons.length})`}>
              📐 Полигоны ({polygons.length})
            </h3>
            <div className="polygon-list-container">
              {polygons.map((polygon, idx) => (
                <div
                  key={polygon.id}
                  className={`polygon-item ${selectedPolygon === polygon.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPolygon(polygon.id);
                    handleEditPolygon(polygon.id);
                  }}
                >
                  <div className="polygon-item-header">
                    {selectedPolygon === polygon.id ? (
                      <input
                        type="text"
                        value={polygon.name || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updatePolygonName(polygon.id, e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Return') {
                            e.stopPropagation();
                            const updatedPoly = polygons.find(p => p.id === polygon.id);
                            if (updatedPoly && updatedPoly.name !== (e.target.value || '').trim()) {
                               const polyToSave = { ...updatedPoly, name: (e.target.value || '').trim() };
                               savePolygonToDatabase(polyToSave, true);
                            }
                            e.target.blur();
                          }
                        }}
                        onBlur={(e) => {
                          e.stopPropagation();
                          const updatedPoly = polygons.find(p => p.id === polygon.id);
                          if (updatedPoly && updatedPoly.name !== (e.target.value || '').trim()) {
                             const polyToSave = { ...updatedPoly, name: (e.target.value || '').trim() };
                             savePolygonToDatabase(polyToSave, true);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="polygon-name-input"
                        disabled={isSavingPolygon || isFetchingPolygons}
                      />
                    ) : (
                      <strong className="polygon-name-display">
                        {polygon.name || `Полигон #${idx + 1}`}
                      </strong>
                    )}

                    <div className="polygon-actions">
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePolygon(polygon.id); }}
                        className="polygon-action-button delete"
                        disabled={isSavingPolygon || isFetchingPolygons}
                      >
                        Удалить
                      </button>
                      {(selectedPolygon === polygon.id && (isEditingMode || isDrawing)) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStopAndSaveEdit(polygon.id); }}
                          disabled={(!isEditingMode && !isDrawing) || isSavingPolygon || isFetchingPolygons}
                          className="polygon-action-button save-polygon"
                        >
                          {isSavingPolygon ? '💾 Сохраняю...' : '💾 Сохранить'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="polygon-details-info">
                    <div className="polygon-details-row">
                      <span>Точек: {polygon.coordinates.length}</span>
                      <span>Площадь: {formatArea(calculateArea(polygon.coordinates))}</span>
                      <div style={{ backgroundColor: polygon.color }} className="polygon-color-box"></div>
                    </div>
                  </div>
                  {selectedPolygon === polygon.id && (
                    <div className="polygon-meta-edit">
                      <div className="polygon-meta-group">
                        <label htmlFor={`crop-select-${polygon.id}`} className="polygon-detail-label">
                          Культура:
                        </label>
                        <select
                          id={`crop-select-${polygon.id}`}
                          value={polygon.crop || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            updatePolygonCrop(polygon.id, e.target.value);
                          }}
                          onBlur={(e) => {
                            e.stopPropagation();
                            const originalPoly = polygons.find(p => p.id === polygon.id);
                            if (originalPoly && originalPoly.crop !== e.target.value) {
                                const polyToSave = { ...originalPoly, crop: e.target.value };
                                savePolygonToDatabase(polyToSave, true);
                            }
                          }}
                          disabled={isSavingPolygon || isFetchingPolygons}
                          className="polygon-crop-select"
                        >
                          <option value="">Выберите культуру</option>
                          {crops.map((crop) => (
                            <option key={crop} value={crop}>
                              {crop}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="polygon-meta-group">
                        <label htmlFor={`comment-input-${polygon.id}`} className="polygon-detail-label">
                          Комментарий:
                        </label>
                        <input
                          id={`comment-input-${polygon.id}`}
                          type="text"
                          placeholder="Добавить комментарий..."
                          value={polygon.comment || ''}
                          onChange={(e) => {
                            e.stopPropagation();
                            updatePolygonComment(polygon.id, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Return') {
                              e.stopPropagation();
                              const updatedPoly = polygons.find(p => p.id === polygon.id);
                              if (updatedPoly && updatedPoly.comment !== (e.target.value || '').trim()) {
                                 const polyToSave = { ...updatedPoly, comment: (e.target.value || '').trim() };
                                 savePolygonToDatabase(polyToSave, true);
                              }
                              e.target.blur();
                            }
                          }}
                          onBlur={(e) => {
                            e.stopPropagation();
                            const originalPoly = polygons.find(p => p.id === polygon.id);
                            if (originalPoly && originalPoly.comment !== (e.target.value || '').trim()) {
                              const polyToSave = { ...originalPoly, comment: (e.target.value || '').trim() };
                              savePolygonToDatabase(polyToSave, true);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="polygon-comment-input"
                          disabled={isSavingPolygon || isFetchingPolygons}
                        />
                      </div>
                    </div>
                  )}
                  {selectedPolygon !== polygon.id && (
                    <div className="polygon-summary-display">
                      {polygon.crop && `🌾 ${polygon.crop}`}
                      {polygon.crop && polygon.comment && ' | '}
                      {polygon.comment && `💬 ${polygon.comment}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div> {/* End of map-sidebar-content-wrapper */}

      {showCropsSection && (
        <div className="crops-summary-section">
          <div className="crops-summary-header">
            <h4 className="crops-summary-title">
              🌾 Сводка культур
            </h4>
            <div className="crops-summary-actions">
              <button
                onClick={fetchCropsFromAPI}
                disabled={loadingCrops || isSavingPolygon || isFetchingPolygons}
                className="crops-summary-button"
                aria-label="Обновить данные по культурам"
              >
                {loadingCrops ? 'Загружаю...' : '🔄'}
              </button>
              <button
                onClick={clearAllCrops}
                disabled={isSavingPolygon || isFetchingPolygons}
                className="crops-summary-button clear-crops"
                aria-label="Очистить все культуры"
              >
                🗑️
              </button>
            </div>
          </div>

          {cropsError && (
            <div className="crops-error-message">
              ⚠️ {cropsError}
            </div>
          )}

          <div className="crops-summary-content">
            <div className="crops-summary-details">
              <div><strong>Сводка:</strong></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <div>Полигонов: {polygons.length}</div>
                <div>С культурами: {polygons.filter((p) => p.crop).length}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  Общая площадь:{' '}
                  {formatArea(polygons.reduce((total, p) => total + calculateArea(p.coordinates), 0))}
                </div>
              </div>
              {polygons.some((p) => p.crop) && (
                <div className="crops-by-type">
                  <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>По культурам:</div>
                  <div className="crops-by-type-list">
                    {Object.entries(
                      polygons.filter((p) => p.crop).reduce((acc, p) => {
                        const area = calculateArea(p.coordinates);
                        const baseCrop = p.crop;
                        if (baseCrop) {
                            acc[baseCrop] = (acc[baseCrop] || 0) + area;
                        }
                        return acc;
                      }, {})
                    ).map(([crop, area]) => (
                      <div key={crop} className="crop-tag">
                        {crop}: {formatArea(area)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
