// components/ForMap/PolygonDrawMap.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from './MapComponent';
import MapSidebar from './MapSidebar';
import ToastNotification from './ToastNotification';
import ConfirmDialog from './ConfirmDialog';
import PolygonAnalysisLayer from './PolygonAnalysisLayer';
import LayerSelectionBlock from './LayerSelectionBlock'; // <--- ИЗМЕНЕНО: Импортируем новый компонент

import * as L from 'leaflet';
import './Map.css';

const BASE_API_URL = 'http://localhost:8080';

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (e) {
      console.error("Failed to parse JSON, falling back to text:", e);
      return await response.text();
    }
  } else {
    return await response.text();
  }
}

const ensurePolygonClosed = (coordinates) => {
  if (!coordinates || coordinates.length < 3) {
    return coordinates;
  }
  let cleanedCoordinates = [...coordinates];
  while (cleanedCoordinates.length >= 2 &&
         cleanedCoordinates[cleanedCoordinates.length - 1][0] === cleanedCoordinates[cleanedCoordinates.length - 2][0] &&
         cleanedCoordinates[cleanedCoordinates.length - 1][1] === cleanedCoordinates[cleanedCoordinates.length - 2][1]) {
    cleanedCoordinates.pop();
  }
  const firstPoint = cleanedCoordinates[0];
  const lastPoint = cleanedCoordinates[cleanedCoordinates.length - 1];
  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    return [...cleanedCoordinates, firstPoint];
  }
  return cleanedCoordinates;
};


export default function PolygonDrawMap({ handleLogout }) {
  const [polygons, setPolygons] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [editingMapPolygon, setEditingMapPolygon] = useState(null);
  const editableFGRef = useRef();

  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  const [drawnPointsCount, setDrawnPointsCount] = useState(0);

  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  const [isFetchingPolygons, setIsFetchingPolygons] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Состояния для аналитических слоев
  const [activeAnalysisType, setActiveAnalysisType] = useState('none'); // По умолчанию 'none'
  const [analysisDateRange, setAnalysisDateRange] = useState({ from: '', to: '' });
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  // Новое состояние для активного типа базовой карты
  const [activeBaseMapType, setActiveBaseMapType] = useState('openstreetmap'); // По умолчанию OpenStreetMap

  const navigate = useNavigate();

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
    const timer = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const calculateArea = useCallback((coordinates) => {
    if (coordinates.length < 3) return 0;
    const R = 6378137;
    let area = 0;
    for (let i = 0, len = coordinates.length; i < len; i++) {
      const [lat1, lon1] = coordinates[i];
      const [lat2, lon2] = coordinates[(i + 1) % len];
      const phi1 = (lat1 * Math.PI) / 180;
      const phi2 = (lat2 * Math.PI) / 180;
      const dLambda = ((lon2 - lon1) * Math.PI) / 180;
      area += dLambda * (2 + Math.sin(phi1) + Math.sin(phi2));
    }
    area = (area * R * R) / 2.0;
    return Math.abs(area);
  }, []);

  const formatArea = useCallback((area) => {
    if (area < 10000) return `${area.toFixed(1)} м²`;
    if (area < 1000000) return `${(area / 10000).toFixed(1)} га`;
    return `${(area / 1000000).toFixed(1)} км²`;
  }, []);

  const savePolygonToDatabase = useCallback(async (polygonData, isUpdate = false) => {
    const { id, name, coordinates, crop, comment, color } = polygonData;
    if (!name || name.trim() === '') {
      showToast('Ошибка сохранения: название полигона не может быть пустым.', 'error');
      console.error('Ошибка сохранения: название полигона не может быть пустым.');
      return;
    }
    let geoJsonCoords = ensurePolygonClosed(coordinates).map(coord => [coord[1], coord[0]]);
    const geoJsonGeometry = {
        type: "Polygon",
        coordinates: [geoJsonCoords]
    };
    const geoJsonString = JSON.stringify(geoJsonGeometry);
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) {
        handleLogout();
      } else {
        navigate('/login');
      }
      return;
    }
    setIsSavingPolygon(true);
    try {
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate ? `${BASE_API_URL}/api/polygons/${id}` : `${BASE_API_URL}/api/polygons`;
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: isUpdate ? id : undefined,
          geoJson: geoJsonString,
          name: name,
          crop: crop || null,
          comment: comment || null,
          color: color || '#0000FF'
        }),
      });
      const responseBody = await parseResponseBody(response);
      if (!response.ok) {
        let errorMessage = response.statusText;
        if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
          errorMessage = responseBody.message;
        } else if (typeof responseBody === 'string' && responseBody.length > 0) {
          errorMessage = responseBody;
        }
        showToast(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона на сервере: ${errorMessage}`, 'error');
        if (response.status === 401 || response.status === 403) {
          if (handleLogout) {
            handleLogout();
          } else {
            navigate('/login');
          }
        }
        throw new Error(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона на сервере: ${response.status} - ${errorMessage}`);
      }
      showToast(`Полигон "${name}" успешно ${isUpdate ? 'обновлен' : 'сохранен'} на сервере!`, 'success');
      console.log(`Полигон успешно ${isUpdate ? 'обновлен' : 'сохранен'} на сервере:`, responseBody);
      if (!isUpdate) {
        const actualPolygonId = (typeof responseBody === 'object' && responseBody !== null && responseBody.id)
                                ? responseBody.id
                                : (typeof responseBody === 'string' ? responseBody : id);
        setPolygons(prev => prev.map(p => p.id === id ? { ...p, id: String(actualPolygonId) } : p));
      } else {
        setPolygons(prev => prev.map(p => p.id === id ? { ...polygonData } : p));
      }
    } catch (error) {
      showToast(`Не удалось ${isUpdate ? 'обновить' : 'сохранить'} полигон на сервере: ${error.message}`, 'error');
      console.error(`Ошибка при ${isUpdate ? 'обновлении' : 'сохранении'} полигона на сервере:`, error);
    } finally {
      setIsSavingPolygon(false);
    }
  }, [showToast, handleLogout, navigate]);

  const startDrawing = () => {
    console.log('startDrawing: Entering drawing mode');
    setIsDrawing(true);
    setSelectedPolygon(null);
    setIsEditingMode(false);
    setEditingMapPolygon(null);
    editableFGRef.current?.clearLayers();
    setDrawnPointsCount(0);
    showToast(
      '📍 Режим рисования активен. На карте выберите свое поле и поставьте первую точку.',
      'info'
    );
  };

  const handlePointAdded = useCallback(() => {
    setDrawnPointsCount(prevCount => {
      const newCount = prevCount + 1;
      console.log(`PolygonDrawMap: handlePointAdded called. New count: ${newCount}`);
      return newCount;
    });
  }, []);

  useEffect(() => {
    console.log(`PolygonDrawMap: useEffect for toasts. isDrawing: ${isDrawing}, drawnPointsCount: ${drawnPointsCount}`);
    if (isDrawing) {
      if (drawnPointsCount === 1) {
        console.log('PolygonDrawMap: Showing toast for 1 point.');
        showToast('Отлично! Теперь добавьте еще точки. Для создания полигона необходимо минимум 3 точки.', 'info');
      } else if (drawnPointsCount >= 3) {
        console.log('PolygonDrawMap: Showing toast for >= 3 points.');
        showToast('Вы нарисовали достаточно точек. Двойной клик на карте завершит рисование полигона.', 'info');
      }
    }
  }, [drawnPointsCount, isDrawing, showToast]);

  const stopDrawing = () => {
    console.log('stopDrawing: Exiting drawing mode');
    if (window.clearCurrentPath) {
      window.clearCurrentPath();
    }
    showToast('Режим рисования остановлен.', 'info');
  };

  const onPolygonComplete = useCallback((coordinates) => {
    console.log('onPolygonComplete: New polygon completed', coordinates);
    const closedCoordinates = ensurePolygonClosed(coordinates);
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    const newPolygon = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      coordinates: closedCoordinates,
      color: randomColor,
      crop: null,
      name: `Новый полигон ${new Date().toLocaleString()}`,
      comment: null
    };
    setPolygons((prev) => [...prev, newPolygon]);
    setIsDrawing(false);
    setDrawnPointsCount(0);
    setSelectedPolygon(newPolygon);
    showToast('Полигон нарисован и сохранен локально! Отправка на сервер...', 'info');
    savePolygonToDatabase(newPolygon);
  }, [savePolygonToDatabase, showToast]);

  const updatePolygonColor = useCallback((polygonId, newColor) => {
    console.log(`updatePolygonColor: Updating polygon ${polygonId} with color ${newColor}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, color: newColor } : p
      );
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
  }, [selectedPolygon]);

  const deletePolygon = useCallback(async (id) => {
    console.log('deletePolygon: Attempting to delete polygon with ID', id);
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) {
        handleLogout();
      } else {
        navigate('/login');
      }
      return;
    }
    setPolygons((prev) => prev.filter((p) => p.id !== id));
    setSelectedPolygon(null);
    if (editingMapPolygon && editingMapPolygon.id === id) {
      setIsEditingMode(false);
      setEditingMapPolygon(null);
    }
    showToast('Полигон удален локально. Отправка запроса на сервер...', 'info');
    try {
      const response = await fetch(`${BASE_API_URL}/api/polygons/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const responseBody = await parseResponseBody(response);
      if (!response.ok) {
        let errorMessage = response.statusText;
        if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
          errorMessage = responseBody.message;
        } else if (typeof responseBody === 'string' && responseBody.length > 0) {
          errorMessage = responseBody;
        }
        showToast(`Ошибка удаления полигона с сервера: ${errorMessage}`, 'error');
        if (response.status === 401 || response.status === 403) {
          if (handleLogout) {
            handleLogout();
          } else {
            navigate('/login');
          }
        }
        throw new Error(`Ошибка удаления полигона с сервера: ${response.status} - ${errorMessage}`);
      }
      showToast('Полигон успешно удален с сервера!', 'success');
      console.log(`Polygon with ID ${id} successfully deleted from DB.`);
    } catch (error) {
      showToast(`Не удалось удалить полигон с сервера: ${error.message}`, 'error');
      console.error('Ошибка при удалении полигона из БД:', error);
    }
  }, [editingMapPolygon, showToast, handleLogout, navigate]);

  const confirmClearAll = useCallback(() => {
    setShowClearAllConfirm(true);
  }, []);

  const cancelClearAll = useCallback(() => {
    setShowClearAllConfirm(false);
    showToast('Очистка всех полигонов отменена.', 'info');
  }, [showToast]);

  const handleClearAllConfirmed = useCallback(async () => {
    setShowClearAllConfirm(false);
    showToast('Начинаю очистку всех полигонов...', 'info');
    setPolygons([]);
    localStorage.removeItem('savedPolygons');
    setSelectedPolygon(null);
    setIsDrawing(false);
    setIsEditingMode(false);
    setEditingMapPolygon(null);
    editableFGRef.current?.clearLayers();
    showToast('Все полигоны удалены локально. Отправка запроса на сервер...', 'info');
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) {
        handleLogout();
      } else {
        navigate('/login');
      }
      return;
    }
    setIsSavingPolygon(true);
    try {
        const response = await fetch(`${BASE_API_URL}/api/polygons/clear-all`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const responseBody = await parseResponseBody(response);
        if (!response.ok) {
            let errorMessage = response.statusText;
            if (typeof responseBody === 'object' && responseBody !== null && responseBody.message) {
              errorMessage = responseBody.message;
            } else if (typeof responseBody === 'string' && responseBody.length > 0) {
              errorMessage = responseBody;
            }
            showToast(`Ошибка очистки всех полигонов с сервера: ${errorMessage}`, 'error');
            if (response.status === 401 || response.status === 403) {
              if (handleLogout) {
                handleLogout();
              } else {
                navigate('/login');
              }
            }
            throw new Error(`Ошибка очистки всех полигонов с сервера: ${response.status} - ${errorMessage}`);
        }
        showToast('Все полигоны успешно удалены с сервера!', 'success');
        console.log('All polygons successfully cleared from DB.');
    } catch (error) {
        showToast(`Не удалось очистить все полигоны с сервера: ${error.message}`, 'error');
        console.error('Ошибка при очистке всех полигонов из БД:', error);
    } finally {
      setIsSavingPolygon(false);
    }
  }, [showToast, handleLogout, navigate]);

  const clearAll = useCallback(() => {
    if (polygons.length === 0) {
      showToast('На карте нет полигонов для удаления.', 'info');
      return;
    }
    confirmClearAll();
  }, [polygons.length, confirmClearAll, showToast]);

  const clearAllCrops = useCallback(() => {
    console.log('clearAllCrops: Clearing all assigned crops.');
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null, comment: null, color: '#0000FF' })));
    if (selectedPolygon) {
      setSelectedPolygon(prev => ({ ...prev, crop: null, comment: null, color: '#0000FF' }));
    }
    showToast('Все культуры, комментарии и цвета полигонов сброшены. Синхронизируйте с сервером вручную, если необходимо.', 'info');
  }, [showToast, selectedPolygon]);

  const updatePolygonCrop = useCallback((polygonId, newCrop) => {
    console.log(`updatePolygonCrop: Updating polygon ${polygonId} with crop ${newCrop}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) => (p.id === polygonId ? { ...p, crop: newCrop } : p));
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
  }, [selectedPolygon]);

  const updatePolygonName = useCallback((polygonId, newName) => {
    console.log(`updatePolygonName: Updating polygon ${polygonId} with name ${newName}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, name: newName } : p
      );
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
  }, [selectedPolygon]);

  const updatePolygonComment = useCallback((polygonId, newComment) => {
    console.log(`updatePolygonComment: Updating polygon ${polygonId} with comment ${newComment}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, comment: newComment } : p
      );
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
  }, [selectedPolygon]);

  const onSelectAnalysisForPolygon = useCallback((polygonData, analysisType) => {
    console.log(`onSelectAnalysisForPolygon: Selected polygon ${polygonData.id} for analysis type ${analysisType}`);
    
    if (selectedPolygon && selectedPolygon.id === polygonData.id && activeAnalysisType === analysisType) {
      setActiveAnalysisType('none'); // Выключаем активный тип анализа
      showToast(`Слой "${analysisType}" для полигона выключен.`, 'info');
    } else {
      setSelectedPolygon(polygonData);
      setActiveAnalysisType(analysisType);
      
      const today = new Date();
      const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
      setAnalysisDateRange({
        from: twoMonthsAgo.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0]
      });
      showToast(`Загрузка слоя "${analysisType}" для полигона...`, 'info');
    }
  }, [selectedPolygon, activeAnalysisType, showToast]);

  const handleAnalysisLoadingChange = useCallback((isLoading) => {
    setIsAnalysisLoading(isLoading);
  }, []);

  const handleAnalysisError = useCallback((errorMessage) => {
    showToast(errorMessage, 'error');
    setActiveAnalysisType('none');
  }, [showToast]);


  const handleEditPolygon = useCallback((polygonId) => {
    console.log(`[handleEditPolygon] Attempting to edit polygon with ID: ${polygonId}`);
    setIsSavingPolygon(false);
    setIsFetchingPolygons(false);
    if (isDrawing) {
      console.log('[handleEditPolygon] Exiting drawing mode.');
      setIsDrawing(false);
      if (window.clearCurrentPath) window.clearCurrentPath();
    }
    if (editableFGRef.current) {
        editableFGRef.current.clearLayers();
    }
    const polygonToEdit = polygons.find((p) => p.id === polygonId);
    if (!polygonToEdit) {
      console.error('[handleEditPolygon] Polygon for editing not found in state.');
      showToast('Полигон для редактирования не найден.', 'error');
      return;
    }
    setIsEditingMode(true);
    setEditingMapPolygon(polygonToEdit);
    setSelectedPolygon(polygonToEdit);
    showToast(
      `📍 Режим редактирования активен. Перемещайте вершины полигона, чтобы изменить его форму. Нажмите "Остановить и сохранить" в боковой панели, чтобы применить изменения.`,
      'info'
    );
    console.log('[handleEditPolygon] isEditingMode set to TRUE. isSavingPolygon and isFetchingPolygons set to FALSE.');
  }, [polygons, isDrawing, showToast]);

  const handleStopAndSaveEdit = useCallback(() => {
    console.log('handleStopAndSaveEdit: Attempting to stop and save.');
    if (isDrawing) {
      if (window.clearCurrentPath) window.clearCurrentPath();
      stopDrawing();
      showToast('Рисование остановлено.', 'info');
    }
    else if (isEditingMode && editableFGRef.current) {
      editableFGRef.current.eachLayer(layer => {
        if (layer.editing && layer.editing.enabled()) {
          console.log('handleStopAndSaveEdit: Disabling editing for active layer.');
          layer.editing.disable();
          if (editingMapPolygon) {
              const geoJson = layer.toGeoJSON();
              const updatedCoords = geoJson.geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
              const currentPolygonInState = polygons.find(p => p.id === editingMapPolygon.id);
              if (currentPolygonInState) {
                  const updatedPoly = {
                      ...currentPolygonInState,
                      coordinates: updatedCoords,
                  };
                  setPolygons(prev => prev.map(p => p.id === updatedPoly.id ? updatedPoly : p));
                  if (selectedPolygon && selectedPolygon.id === updatedPoly.id) {
                    setSelectedPolygon(updatedPoly);
                  }
                  showToast('Форма полигона обновлена и сохранена локально! Отправка на сервер...', 'info');
                  savePolygonToDatabase(updatedPoly, true);
              }
          }
        }
      });
      console.log('handleStopAndSaveEdit: Forcing state reset for editing mode.');
      setIsEditingMode(false);
      setEditingMapPolygon(null);
      editableFGRef.current?.clearLayers();
      showToast('Редактирование завершено и сохранено.', 'success');
    } else {
      showToast('Нет активных режимов для сохранения.', 'info');
    }
  }, [isDrawing, stopDrawing, isEditingMode, editingMapPolygon, polygons, savePolygonToDatabase, showToast, selectedPolygon]);

  const onPolygonEdited = useCallback(async (e) => {
    console.log('onPolygonEdited: Event received from EditControl. Layers:', e.layers);
    if (isEditingMode) {
      setIsEditingMode(false);
      setEditingMapPolygon(null);
      showToast('Редактирование формы на карте завершено.', 'info');
    }
  }, [isEditingMode, editingMapPolygon, showToast]);

  const showMyPolygons = useCallback(async () => {
    showToast('Загрузка ваших полигонов с сервера...', 'info');
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) {
        handleLogout();
      } else {
        navigate('/login');
      }
      return;
    }
    setIsFetchingPolygons(true);
    try {
        const response = await fetch(`${BASE_API_URL}/api/polygons/my`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await parseResponseBody(response);
        if (!response.ok) {
            let errorMessage = response.statusText;
            if (typeof data === 'object' && data !== null && data.message) {
              errorMessage = data.message;
            } else if (typeof data === 'string' && data.length > 0) {
              errorMessage = data;
            }
            showToast(`Ошибка загрузки полигонов с сервера: ${errorMessage}`, 'error');
            if (response.status === 401 || response.status === 403) {
              if (handleLogout) {
                handleLogout();
              } else {
                navigate('/login');
              }
            }
            throw new Error(`Ошибка загрузки полигонов с сервера: ${response.status} - ${errorMessage}`);
        }
        console.log('Мои полигоны загружены с сервера:', data);
        if (data && Array.isArray(data)) {
          const loadedPolygons = data.map(item => {
            let coordinates = [];
            let name = item.name || `Загруженный полигон ${item.id || String(Date.now())}`;
            let crop = item.crop || null;
            let comment = item.comment || null;
            let color = item.color || '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
            try {
              const geoJsonObj = JSON.parse(item.geoJson);
              if (geoJsonObj && geoJsonObj.type === "Polygon" && geoJsonObj.coordinates && geoJsonObj.coordinates[0]) {
                  coordinates = ensurePolygonClosed(geoJsonObj.coordinates[0].map(coord => [coord[1], coord[0]]));
              }
              else {
                  console.warn('Invalid GeoJSON Geometry structure for item (expected Polygon directly):', item);
              }
            } catch (e) {
              console.error('Failed to parse geoJson for item:', item, e);
              coordinates = [];
            }
            return {
              id: String(item.id),
              coordinates: coordinates,
              color: color,
              crop: crop,
              name: name,
              comment: comment
            };
          }).filter(p => p.coordinates.length >= 3);
          setPolygons(loadedPolygons);
          showToast(`Загружено ${loadedPolygons.length} ваших полигонов с сервера.`, 'success');
          setIsDrawing(false);
          setIsEditingMode(false);
          setEditingMapPolygon(null);
          editableFGRef.current?.clearLayers();
          setSelectedPolygon(null);
        } else {
          showToast('Сервер вернул некорректный формат данных для полигонов.', 'error');
          console.error('Сервер вернул некорректный формат данных:', data);
        }
    } catch (error) {
        showToast(`Не удалось загрузить мои полигоны с сервера: ${error.message}`, 'error');
        console.error('Ошибка при загрузке моих полигонов с сервера:', error);
    } finally {
      setIsFetchingPolygons(false);
    }
  }, [showToast, handleLogout, navigate]);

  useEffect(() => {
    let loadedFromLocalStorage = false;
    try {
      const storedPolygons = localStorage.getItem('savedPolygons');
      if (storedPolygons !== null && storedPolygons !== '[]') {
        const parsedPolygons = JSON.parse(storedPolygons);
        if (Array.isArray(parsedPolygons) && parsedPolygons.every(p => p && p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 3 && 'comment' in p && 'color' in p)) {
          const closedPolygons = parsedPolygons.map(p => ({
            ...p,
            coordinates: ensurePolygonClosed(p.coordinates)
          }));
          setPolygons(closedPolygons);
          showToast('Полигоны загружены с локального устройства.', 'success');
          loadedFromLocalStorage = true;
        } else {
          console.warn('Invalid polygons data format in localStorage. Clearing and attempting to load from server.', parsedPolygons);
          localStorage.removeItem('savedPolygons');
        }
      } else {
        console.log('localStorage для полигонов пуст или отсутствует. Загружаю с сервера.');
      }
    } catch (error) {
      console.error("Критическая ошибка парсинга полигонов из localStorage. Очищаю и пытаюсь загрузить с сервера:", error);
      showToast('Критическая ошибка загрузки полигонов с локального устройства, пытаюсь загрузить с сервера.', 'error');
      localStorage.removeItem('savedPolygons');
    }
    if (!loadedFromLocalStorage) {
      const token = localStorage.getItem('token');
      if (!token) {
        if (handleLogout) {
          handleLogout();
        } else {
          navigate('/login');
        }
        return;
      }
      showMyPolygons();
    }
  }, [showToast, showMyPolygons, handleLogout, navigate]);

  const finalSelectedPolygonData = selectedPolygon;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
      <MapComponent
        polygons={polygons}
        onPolygonComplete={onPolygonComplete}
        onPolygonEdited={onPolygonEdited}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        editableFGRef={editableFGRef}
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        isEditingMode={isEditingMode}
        editingMapPolygon={editingMapPolygon}
        // УДАЛЕНО: onSelectAnalysisForPolygon, activeAnalysisType, setActiveAnalysisType больше не передаются напрямую в MapComponent
        analysisDateRange={analysisDateRange}
        onLoadingChange={handleAnalysisLoadingChange}
        onError={handleAnalysisError}
        onPointAdded={handlePointAdded}
        activeBaseMapType={activeBaseMapType} // <--- НОВЫЙ ПРОП: Передаем активный тип базовой карты
      />

      <MapSidebar
        polygons={polygons}
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        deletePolygon={deletePolygon}
        handleEditPolygon={handleEditPolygon}
        clearAllCrops={clearAllCrops}
        calculateArea={calculateArea}
        formatArea={formatArea}
        updatePolygonCrop={updatePolygonCrop}
        startDrawing={startDrawing}
        stopDrawing={stopDrawing}
        handleStopAndSaveEdit={handleStopAndSaveEdit}
        isDrawing={isDrawing}
        isEditingMode={isEditingMode}
        clearAll={clearAll}
        handleLogout={handleLogout}
        showMyPolygons={showMyPolygons}
        updatePolygonName={updatePolygonName}
        updatePolygonComment={updatePolygonComment}
        updatePolygonColor={updatePolygonColor}
        isSavingPolygon={isSavingPolygon}
        isFetchingPolygons={isFetchingPolygons}
        showCropsSection={true}        
        savePolygonToDatabase={savePolygonToDatabase}
        BASE_API_URL={BASE_API_URL}
      />

      <ToastNotification
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
      />

      {showClearAllConfirm && (
        <ConfirmDialog
          message="Вы уверены, что хотите удалить ВСЕ полигоны? Это действие необратимо."
          onConfirm={handleClearAllConfirmed}
          onCancel={cancelClearAll}
          isProcessing={isSavingPolygon}
        />
      )}

      {/* Рендерим PolygonAnalysisLayer только если есть выбранный полигон и активный тип анализа */}
      {finalSelectedPolygonData && activeAnalysisType && activeAnalysisType !== 'none' && ( // Добавляем проверку на 'none'
        <PolygonAnalysisLayer
          selectedPolygonData={finalSelectedPolygonData}
          activeAnalysisType={activeAnalysisType}
          analysisDateRange={analysisDateRange}
          onLoadingChange={handleAnalysisLoadingChange}
          onError={handleAnalysisError}
        />
      )}

      {isAnalysisLoading && (
        <div style={{
          position: 'absolute', bottom: '35px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '10px 20px',
          borderRadius: '8px', zIndex: 1000, fontSize: '14px', textAlign: 'center',
        }}>
          Загрузка аналитического слоя...
        </div>
      )}

      {/* <--- ИЗМЕНЕНО: Используем новый LayerSelectionBlock вместо старого AnalysisSelectionBlock */}
      <LayerSelectionBlock
        selectedPolygonData={finalSelectedPolygonData}
        activeBaseMapType={activeBaseMapType}
        onSelectBaseMap={setActiveBaseMapType}
        activeAnalysisType={activeAnalysisType}
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon}
      />
    </div>
  );
}