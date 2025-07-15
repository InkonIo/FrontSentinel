// components/ForMap/MapSidebar.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './MapSidebar.css'; // ✨ Этот файл CSS уже используется для стилизации компонента

export default function MapSidebar({
  polygons,
  selectedPolygon, 
  setSelectedPolygon, 
  deletePolygon,
  handleEditPolygon, 
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
  updatePolygonColor,
  isSavingPolygon,
  isFetchingPolygons,
  showCropsSection,
  savePolygonToDatabase,
  BASE_API_URL,
  // --- УДАЛЕНЫ ПРОПСЫ, СВЯЗАННЫЕ С АДМИН-ПАНЕЛЬЮ И ПОЛЬЗОВАТЕЛЯМИ ---
  // userRole, 
  // allUsers, 
  // selectedUserForAdminView, 
  // handleUserSelectForAdminView, 
  // --- КОНЕЦ УДАЛЕННЫХ ПРОПСОВ ---
}) {
  const [activeSection, setActiveSection] = useState('map');
  const [showPolygonsList, setShowPolygonsList] = useState(true);

  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState('');
  const [cropsByChapter, setCropsByChapter] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [varietiesByCrop, setVarietiesByCrop] = useState([]);
  const [selectedVariety, setSelectedVariety] = useState('');
  const [loadingCropData, setLoadingCropData] = useState(false);
  const [cropDataError, setCropDataError] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // State for sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(280); // Initial width
  const sidebarRef = useRef(null);
  const isResizing = useRef(false);
  

  useEffect(() => {
    if (location.pathname === '/') setActiveSection('home');
    else if (location.pathname === '/dashboard') setActiveSection('map');
    else if (location.pathname === '/chat') setActiveSection('ai-chat');
    else if (location.pathname === '/earthdata') setActiveSection('soil-data');
    else setActiveSection('');
  }, [location.pathname]);

  const fetchApiData = useCallback(async (url, setter, errorMessage) => {
    setLoadingCropData(true);
    setCropDataError(null);
    const token = localStorage.getItem('token');
    if (!token) {
      setCropDataError('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.');
      setLoadingCropData(false);
      return;
    }
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка загрузки: ${response.status} - ${errorText}`);
      }
      const data = await response.json();

      if (Array.isArray(data)) {
        if (url.includes('/chapters')) {
          setter(data.filter(item => typeof item === 'string'));
        } else if (url.includes('/by-chapter')) {
          setter(data.filter(item => item && typeof item.name === 'string'));
        } else if (url.includes('/by-crop')) {
          setter(data.filter(item => item && typeof item.name === 'string').map(variety => variety.name));
        } else {
          setter(data);
        }
      } else {
        setCropDataError(`Некорректный формат данных от сервера для ${url}.`);
        setter([]);
      }
    } catch (error) {
      console.error(errorMessage, error);
      setCropDataError(errorMessage + `: ${error.message}`);
      setter([]);
    } finally {
      setLoadingCropData(false);
    }
  }, []);

  useEffect(() => {
    fetchApiData(`${BASE_API_URL}/api/v1/crops/chapters`, setChapters, 'Не удалось загрузить главы культур');
  }, [fetchApiData, BASE_API_URL]);

  useEffect(() => {
    if (selectedChapter) {
      fetchApiData(`${BASE_API_URL}/api/v1/crops/by-chapter?chapter=${encodeURIComponent(selectedChapter)}`, setCropsByChapter, 'Не удалось загрузить культуры для выбранной главы');
      setSelectedCrop('');
      setVarietiesByCrop([]);
      setSelectedVariety('');
    } else {
      setCropsByChapter([]);
      setSelectedCrop('');
      setVarietiesByCrop([]);
      setSelectedVariety('');
    }
  }, [selectedChapter, fetchApiData, BASE_API_URL]);

  useEffect(() => {
    if (selectedCrop) {
      fetchApiData(`${BASE_API_URL}/api/v1/crops/by-crop?crop=${encodeURIComponent(selectedCrop)}`, setVarietiesByCrop, 'Не удалось загрузить сорта для выбранной культуры');
      setSelectedVariety('');
    } else {
      setVarietiesByCrop([]);
      setSelectedVariety('');
    }
  }, [selectedCrop, fetchApiData, BASE_API_URL]);

  const handleUpdatePolygonCrop = useCallback((polygonId, chapter, crop, variety) => {
    const parts = [];
    if (chapter) {
        parts.push(chapter);
    }
    if (crop) {
        parts.push(crop);
    }
    if (variety) {
        parts.push(variety);
    }
    const fullCropName = parts.join(',');
    const currentPolygonInProps = polygons.find(p => p.id === polygonId);

    if (currentPolygonInProps && currentPolygonInProps.crop !== fullCropName) {
        updatePolygonCrop(polygonId, fullCropName);
    }
}, [polygons, updatePolygonCrop]); 

  useEffect(() => {
    if (selectedPolygon && selectedPolygon.id && !loadingCropData && chapters.length > 0) { 
      const polygon = polygons.find(p => p.id === selectedPolygon.id); 
      if (polygon && polygon.crop) {
        const parts = polygon.crop.split(',');
        const chapterFromPolygon = parts[0] || '';
        const cropFromPolygon = parts[1] || '';
        const varietyFromPolygon = parts[2] || '';

        if (chapters.includes(chapterFromPolygon)) {
            setSelectedChapter(chapterFromPolygon);
        } else {
            setSelectedChapter('');
        }

        if (cropFromPolygon && cropsByChapter.some(c => c.name === cropFromPolygon)) {
            setSelectedCrop(cropFromPolygon);
        } else {
            setSelectedCrop('');
        }

        if (varietyFromPolygon && varietiesByCrop.includes(varietyFromPolygon)) {
            setSelectedVariety(varietyFromPolygon);
        } else {
            setSelectedVariety('');
        }

      } else {
        setSelectedChapter('');
        setSelectedCrop('');
        setSelectedVariety('');
      }
    } else if (!selectedPolygon) { 
      setSelectedChapter('');
      setSelectedCrop('');
      setSelectedVariety('');
    }
  }, [selectedPolygon, polygons, chapters, cropsByChapter, varietiesByCrop, loadingCropData]); 

  // Resizer functions

  // 1. Объявляем handleMouseMove ПЕРВОЙ, так как она не зависит от других.
  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current || !sidebarRef.current) return;

    // Прямое изменение DOM для максимальной плавности
    const newWidth = document.documentElement.clientWidth - e.clientX;
    const minWidth = 200;
    const maxWidth = 600; // Можно настроить максимальную ширину

    const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    
    // Используем requestAnimationFrame для более плавной анимации
    requestAnimationFrame(() => {
        if (sidebarRef.current) {
            sidebarRef.current.style.width = `${clampedWidth}px`;
        }
    });
  }, []); // Зависимостей нет, так как ref не вызывает ре-рендер

  // 2. Объявляем handleMouseUp ВТОРОЙ, она зависит от handleMouseMove
  const handleMouseUp = useCallback(() => {
    if (isResizing.current && sidebarRef.current) {
      // Обновляем состояние React только в самом конце
      const finalWidth = parseInt(sidebarRef.current.style.width, 10);
      setSidebarWidth(finalWidth);
    }

    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.classList.remove('no-select');
    document.body.style.cursor = '';
  }, [handleMouseMove, setSidebarWidth]); // Указываем зависимости

  // 3. Объявляем handleMouseDown ПОСЛЕДНЕЙ
  const handleMouseDown = useCallback((e) => {
    e.preventDefault(); // Предотвращаем побочные эффекты, например, выделение
    isResizing.current = true;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    document.body.classList.add('no-select');
    document.body.style.cursor = 'ew-resize';
  }, [handleMouseMove, handleMouseUp]); // Указываем зависимости

  // --- УДАЛЕНА КНОПКА АДМИНА ---
  // const adminButton = userRole === 'ADMIN' ? ( 
  //   <Link to="/admin-panel" className="sidebar-link"> 
  //     <i className="fa-solid fa-user-gear"></i>
  //     <span className="link-text">Админ</span>
  //   </Link>
  // ) : null;
  // --- КОНЕЦ УДАЛЕННОЙ КНОПКИ ---

  return (
    <div className={`map-sidebar-container`} ref={sidebarRef} style={{ width: `${sidebarWidth}px` }}>
      <div className="map-sidebar-content-wrapper">
        <h2 className="map-sidebar-section-title"style={{ marginTop: '-5px' }} data-text="Управление картой">Управление картой</h2>
        <hr className="map-sidebar-hr" />

        {/* --- УДАЛЕН БЛОК: Выпадающий список пользователей для админа --- */}
        {/* {userRole === 'ADMIN' && allUsers.length > 0 && (
          <div className="map-sidebar-admin-section">
            <h3 className="map-sidebar-section-title" data-text="Пользователи">Пользователи</h3>
            <select
              className="map-sidebar-dropdown-select"
              onChange={handleUserSelectForAdminView}
              value={selectedUserForAdminView ? selectedUserForAdminView.id : ''}
              disabled={isFetchingPolygons}
            >
              <option value="">Выберите пользователя (Админ)</option>
              {allUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.email} (ID: {user.id})
                </option>
              ))}
            </select>
            <hr className="map-sidebar-hr" />
          </div>
        )} */}
        {/* --- КОНЕЦ УДАЛЕННОГО БЛОКА --- */}

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
                // Если список скрыт и мы его показываем, то загружаем полигоны
                // Если выбран пользователь для админ-просмотра, загружаем его полигоны
                // Иначе загружаем полигоны текущего пользователя
                // showMyPolygons(selectedUserForAdminView ? selectedUserForAdminView.id : null); // УДАЛЕНО: selectedUserForAdminView больше не пропс
                showMyPolygons(); // Вызываем без аргументов, чтобы загрузить полигоны текущего пользователя
              }
              setShowPolygonsList(prev => !prev);
            }}
            disabled={isSavingPolygon || isFetchingPolygons || isDrawing || isEditingMode}
            className="map-sidebar-button toggle-list-button"
            aria-label={isFetchingPolygons ? 'Загружаю список' : (showPolygonsList ? 'Скрыть список полигонов' : 'Показать список полигонов')}
          >
            {isFetchingPolygons ? '📂 Загружаю...' : '👀 Список'}
          </button>
        </div>

        <hr className="map-sidebar-hr" />

        {showPolygonsList && polygons.length > 0 ? ( 
          <div className="polygon-list-section">
            <h3 className="polygon-list-header" data-text={`Полигоны (${polygons.length})`}>
              📐 Полигоны ({polygons.length})
            </h3>
            <div className="polygon-list-container">
              {polygons.map((polygon, idx) => (
                <div
                  key={polygon.id}
                  className={`polygon-item ${selectedPolygon && selectedPolygon.id === polygon.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedPolygon(polygon); 
                    handleEditPolygon(polygon.id); 
                  }}
                >
                  <div className="polygon-item-header">
                    {selectedPolygon && selectedPolygon.id === polygon.id ? (
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
                      {(selectedPolygon && selectedPolygon.id === polygon.id && (isEditingMode || isDrawing)) && (
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
                  {selectedPolygon && selectedPolygon.id === polygon.id && (
                    <div className="polygon-meta-edit">
                      <div className="polygon-meta-group">
                        <label htmlFor={`color-picker-${polygon.id}`} className="polygon-detail-label">
                          Цвет полигона:
                        </label>
                        <input
                          id={`color-picker-${polygon.id}`}
                          type="color"
                          value={polygon.color || '#000000'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updatePolygonColor(polygon.id, e.target.value);
                          }}
                          onBlur={(e) => {
                            e.stopPropagation();
                            const originalPoly = polygons.find(p => p.id === polygon.id);
                            if (originalPoly && originalPoly.color !== e.target.value) {
                                const polyToSave = { ...originalPoly, color: e.target.value };
                                savePolygonToDatabase(polyToSave, true);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="polygon-color-input"
                          disabled={isSavingPolygon || isFetchingPolygons}
                        />
                      </div>

                      <div className="polygon-meta-group">
                        <label htmlFor={`chapter-select-${polygon.id}`} className="polygon-detail-label">
                          Глава культуры:
                        </label>
                        <select
                          id={`chapter-select-${polygon.id}`}
                          value={selectedChapter}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedChapter(e.target.value);
                            setSelectedCrop('');
                            setSelectedVariety('');
                            handleUpdatePolygonCrop(polygon.id, e.target.value, '', '');
                          }}
                          onBlur={(e) => {
                              e.stopPropagation();
                          }}
                          disabled={isSavingPolygon || isFetchingPolygons || loadingCropData}
                          className="polygon-crop-select"
                        >
                          <option value="">Выберите главу</option>
                          {chapters.map((chapter) => (
                            <option key={chapter} value={chapter}>
                              {chapter}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedChapter && (
                        <div className="polygon-meta-group">
                          <label htmlFor={`crop-select-${polygon.id}`} className="polygon-detail-label">
                            Культура:
                          </label>
                          <select
                            id={`crop-select-${polygon.id}`}
                            value={selectedCrop}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedCrop(e.target.value);
                              setSelectedVariety('');
                              handleUpdatePolygonCrop(polygon.id, selectedChapter, e.target.value, '');
                            }}
                            onBlur={(e) => {
                                e.stopPropagation();
                            }}
                            disabled={isSavingPolygon || isFetchingPolygons || loadingCropData || !selectedChapter}
                            className="polygon-crop-select"
                          >
                            <option value="">Выберите культуру</option>
                            {cropsByChapter.map((crop) => (
                              <option key={crop.name || ''} value={crop.name || ''}>
                                {crop.name || 'Неизвестная культура'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedCrop && (
                        <div className="polygon-meta-group">
                          <label htmlFor={`variety-select-${polygon.id}`} className="polygon-detail-label">
                            Сорт:
                          </label>
                          <select
                            id={`variety-select-${polygon.id}`}
                            value={selectedVariety}
                            onChange={(e) => {
                              e.stopPropagation();
                              console.log('MapSidebar: Variety selected:', e.target.value);
                              setSelectedVariety(e.target.value);
                              handleUpdatePolygonCrop(polygon.id, selectedChapter, selectedCrop, e.target.value);
                            }}
                            onBlur={(e) => {
                                e.stopPropagation();
                            }}
                            disabled={isSavingPolygon || isFetchingPolygons || loadingCropData || !selectedCrop}
                            className="polygon-crop-select"
                          >
                            <option value="">Выберите сорт</option>
                            {varietiesByCrop.map((variety) => (
                              <option key={variety} value={variety}>
                                {variety}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {cropDataError && (
                        <div className="crops-error-message">
                          ⚠️ {cropDataError}
                        </div>
                      )}

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
                  {selectedPolygon && selectedPolygon.id !== polygon.id && (
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
        ) : ( 
          showPolygonsList && !isFetchingPolygons && (
            <div className="polygon-list-section">
              <h3 className="polygon-list-header">
                📐 Полигоны (0)
              </h3>
              <p className="no-polygons-message">Полигоны не найдены.</p>
            </div>
          )
        )}
      </div>

      {showCropsSection && (
        <div className="crops-summary-section">
          <div className="crops-summary-header">
            <h4 className="crops-summary-title">
              🌾 Сводка культур
            </h4>
            <div className="crops-summary-actions">
              <button
                onClick={() => fetchApiData(`${BASE_API_URL}/api/v1/crops/chapters`, setChapters, 'Не удалось обновить главы культур')}
                disabled={loadingCropData || isSavingPolygon || isFetchingPolygons}
                className="crops-summary-button"
                aria-label="Обновить данные по культурам"
              >
                {loadingCropData ? 'Загружаю...' : ''}
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

          {cropDataError && (
            <div className="crops-error-message">
              ⚠️ {cropDataError}
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
                        const fullCrop = p.crop;
                        if (fullCrop) {
                            acc[fullCrop] = (acc[fullCrop] || 0) + area;
                        }
                        return acc;
                      }, {})
                    ).map(([fullCrop, area]) => (
                      <div key={fullCrop} className="crop-tag">
                        {fullCrop}: {formatArea(area)}
                      </div>
                    ))}фф
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Resizer Handle */}
      <div className="resizer" onMouseDown={handleMouseDown}></div>
    </div>
  );
}