// components/ForMap/PolygonDrawMap.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapComponent from './MapComponent';
import MapSidebar from './MapSidebar';
import ToastNotification from './ToastNotification';
import ConfirmDialog from './ConfirmDialog';
import PolygonAnalysisLayer from './PolygonAnalysisLayer';
import LayerSelectionBlock from './LayerSelectionBlock';
import UserSelectionBlock from './UserSelectionBlock';
import * as L from 'leaflet';
import './Map.css';
import { jwtDecode } from 'jwt-decode';

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
  const editableFGRef = useRef(); // <--- Убедитесь, что эта строка присутствует и корректна

  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  const [drawnPointsCount, setDrawnPointsCount] = useState(0);

  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  const [isFetchingPolygons, setIsFetchingPolygons] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  const [activeAnalysisType, setActiveAnalysisType] = useState('none');
  const [analysisDateRange, setAnalysisDateRange] = useState({ from: '', to: '' });
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

  const [activeBaseMapType, setActiveBaseMapType] = useState('openstreetmap');

  const [userRole, setUserRole] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserForAdminView, setSelectedUserForAdminView] = useState(null);

  // Новое состояние для хранения высоты LayerSelectionBlock
  const [layerBlockHeight, setLayerBlockHeight] = useState(0);
  const layerBlockInitialBottom = 35; // Это значение 'bottom' из LayerSelectionBlock

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
      if (handleLogout) handleLogout();
      else navigate('/login');
      return;
    }
    setIsSavingPolygon(true);
    try {
      const method = isUpdate ? 'PUT' : 'POST';
      const url = isUpdate ? `${BASE_API_URL}/api/polygons/${id}` : `${BASE_API_URL}/api/polygons/create`;
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
        throw new Error(`Ошибка ${isUpdate ? 'обновления' : 'сохранения'} полигона на сервере: ${response.status}`);
      }
      
      showToast(`Полигон "${name}" успешно ${isUpdate ? 'обновлен' : 'сохранен'} на сервере!`, 'success');

      if (!isUpdate) {
        const actualPolygonId = (typeof responseBody === 'object' && responseBody?.id) ? responseBody.id : (typeof responseBody === 'string' ? responseBody : id);
        setPolygons(prev => prev.map(p => p.id === id ? { ...p, id: String(actualPolygonId) } : p));
      } else {
        setPolygons(prev => prev.map(p => p.id === id ? { ...polygonData } : p));
        
        setSelectedPolygon(null);
        setIsEditingMode(false);
      }

    } catch (error) {
      showToast(`Не удалось ${isUpdate ? 'обновить' : 'сохранить'} полигон на сервере: ${error.message}`, 'error');
      console.error(`Ошибка при ${isUpdate ? 'обновлении' : 'сохранении'} полигона на сервере:`, error);
    } finally {
      setIsSavingPolygon(false);
    }
  }, [showToast, handleLogout, navigate, setSelectedPolygon, setIsEditingMode]);

  const startDrawing = () => {
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
      return newCount;
    });
  }, []);

  useEffect(() => {
    if (isDrawing) {
      if (drawnPointsCount === 1) {
        showToast('Отлично! Теперь добавьте еще точки. Для создания полигона необходимо минимум 3 точки.', 'info');
      } else if (drawnPointsCount >= 3) {
        showToast('Вы нарисовали достаточно точек. Двойной клик на карте завершит рисование полигона.', 'info');
      }
    }
  }, [drawnPointsCount, isDrawing, showToast]);

  const stopDrawing = () => {
    if (window.clearCurrentPath) {
      window.clearCurrentPath();
    }
    showToast('Режим рисования остановлен.', 'info');
  };

  const onPolygonComplete = useCallback((coordinates) => {
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
      const response = await fetch(`${BASE_API_URL}/api/polygons/delete/${id}`, {
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
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null, comment: null, color: '#0000FF' })));
    if (selectedPolygon) {
      setSelectedPolygon(prev => ({ ...prev, crop: null, comment: null, color: '#0000FF' }));
    }
    showToast('Все культуры, комментарии и цвета полигонов сброшены. Синхронизируйте с сервером вручную, если необходимо.', 'info');
  }, [showToast, selectedPolygon]);

  const updatePolygonCrop = useCallback((polygonId, newCrop) => {
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) => (p.id === polygonId ? { ...p, crop: newCrop } : p));
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
  }, [selectedPolygon]);

  const updatePolygonName = useCallback((polygonId, newName) => {
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
    if (selectedPolygon && selectedPolygon.id === polygonData.id && activeAnalysisType === analysisType) {
      setActiveAnalysisType('none');
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
    setIsSavingPolygon(false);
    setIsFetchingPolygons(false);
    if (isDrawing) {
      setIsDrawing(false);
      if (window.clearCurrentPath) window.clearCurrentPath();
    }
    // НЕ ОЧИЩАЙТЕ editableFGRef.current здесь. Это делает MapComponent в своем useEffect.
    // if (editableFGRef.current) {
    //     editableFGRef.current.clearLayers();
    // }
    const polygonToEdit = polygons.find((p) => p.id === polygonId);
    if (!polygonToEdit) {
      console.error('Polygon for editing not found in state.');
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
  }, [polygons, isDrawing, showToast]);

  const handleStopAndSaveEdit = useCallback(() => { 
    if (isDrawing) { 
      if (window.clearCurrentPath) window.clearCurrentPath(); 
      stopDrawing(); 
      showToast('Рисование остановлено.', 'info'); 
    } 
    else if (isEditingMode) { 
      let updatedCoordinates = null;
      let leafletLayerToDisableEditing = null;

      if (editableFGRef.current) {
          editableFGRef.current.eachLayer(layer => {
              // Находим полигон, который был добавлен для редактирования
              if (layer instanceof L.Polygon) {
                  // Получаем координаты из Leaflet слоя
                  updatedCoordinates = layer.toGeoJSON().geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
                  leafletLayerToDisableEditing = layer; // Сохраняем ссылку на слой для отключения редактирования
              }
          });
      }
      // Если координаты не были получены из Leaflet слоя (например, если не было изменений на карте),
      // используем координаты из состояния editingMapPolygon.
      if (!updatedCoordinates || updatedCoordinates.length === 0) {
          console.log("handleStopAndSaveEdit: Не удалось получить обновленные координаты из Leaflet слоя. Использую editingMapPolygon.coordinates.");
          updatedCoordinates = editingMapPolygon ? editingMapPolygon.coordinates : null;
      }

      if (!updatedCoordinates || updatedCoordinates.length === 0) {
          console.error("handleStopAndSaveEdit: Критическая ошибка: Не удалось получить обновленные координаты для сохранения.");
          showToast('Ошибка: Не удалось получить координаты полигона для сохранения.', 'error');
          return; // Прекращаем выполнение, если нет координат
      }

      // Находим текущий полигон в состоянии polygons по ID editingMapPolygon
      const currentPolygonInState = polygons.find(p => p.id === editingMapPolygon?.id);
      
      if (currentPolygonInState) { 
          const updatedPoly = { 
              ...currentPolygonInState, 
              coordinates: updatedCoordinates, 
          }; 
          
          setPolygons(prev => prev.map(p => p.id === updatedPoly.id ? updatedPoly : p)); 
          if (selectedPolygon && selectedPolygon.id === updatedPoly.id) { 
            setSelectedPolygon(updatedPoly); 
          } 
          
          // Отключаем редактирование на Leaflet слое
          if (leafletLayerToDisableEditing && leafletLayerToDisableEditing.editing && leafletLayerToDisableEditing.editing.enabled()) {
              leafletLayerToDisableEditing.editing.disable();
              console.log('handleStopAndSaveEdit: Редактирование Leaflet слоя отключено.');
          }

          showToast('Форма полигона обновлена и сохранена локально! Отправка на сервер...', 'info'); 
          savePolygonToDatabase(updatedPoly, true); 
      } else {
          console.error("handleStopAndSaveEdit: Полигон для обновления не найден в состоянии polygons.");
          showToast('Ошибка: Редактируемый полигон не найден.', 'error');
      }
      
      console.log('handleStopAndSaveEdit: Принудительный сброс состояния режима редактирования.'); 
      setIsEditingMode(false); 
      setEditingMapPolygon(null); 
      editableFGRef.current?.clearLayers(); // Очищаем FeatureGroup после сохранения
      showToast('Редактирование завершено и сохранено.', 'success'); 
    } else { 
      showToast('Нет активных режимов для сохранения.', 'info'); 
    } 
  }, [isDrawing, stopDrawing, isEditingMode, editingMapPolygon, polygons, savePolygonToDatabase, showToast, selectedPolygon]);

  const onPolygonEdited = useCallback(async (e) => {
    console.log("onPolygonEdited: Событие редактирования полигона на карте.");
    let editedLayers = e.layers;
    editedLayers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
            const newCoordinates = layer.toGeoJSON().geometry.coordinates[0].map(coord => [coord[1], coord[0]]); // Leaflet to [lat, lng]
            console.log("onPolygonEdited: Новые координаты после редактирования:", newCoordinates);

            setPolygons(prevPolygons => {
                return prevPolygons.map(p => {
                    if (editingMapPolygon && p.id === editingMapPolygon.id) {
                        return { ...p, coordinates: newCoordinates };
                    }
                    return p;
                });
            });
            // Обновляем editingMapPolygon, чтобы он отражал последние координаты
            setEditingMapPolygon(prev => prev ? { ...prev, coordinates: newCoordinates } : null);
        }
    });
    // onPolygonEdited вызывается после завершения редактирования на карте.
    // Если вы хотите, чтобы кнопка "Сохранить" была нажата пользователем,
    // то здесь не нужно вызывать savePolygonToDatabase.
    // setIsEditingMode(false); // Не сбрасываем режим редактирования здесь, пока пользователь не нажмет "Сохранить"
    // setEditingMapPolygon(null); // Не сбрасываем здесь
    showToast('Форма полигона изменена. Нажмите "Сохранить" для сохранения изменений.', 'info');
  }, [editingMapPolygon, setPolygons, setEditingMapPolygon, showToast]);

  const showMyPolygons = useCallback(async (userIdToFetch = null) => {
    const fetchUrl = userIdToFetch ? `${BASE_API_URL}/api/polygons/user/${userIdToFetch}` : `${BASE_API_URL}/api/polygons/user`;
    showToast(`Загрузка полигонов${userIdToFetch ? ` для пользователя ${userIdToFetch}` : ' текущего пользователя'} с сервера...`, 'info');
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
        const response = await fetch(fetchUrl, {
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

  const fetchAllUsers = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn("Токен отсутствует, не могу загрузить всех пользователей.");
      return;
    }
    try {
      const response = await fetch(`${BASE_API_URL}/api/v1/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.status === 403) {
        console.warn("Доступ запрещен для загрузки всех пользователей. Возможно, вы не админ.");
        setAllUsers([]);
        return;
      }
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ошибка при получении списка пользователей: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      setAllUsers(data);
    } catch (error) {
      console.error("Ошибка при загрузке всех пользователей:", error);
      setAllUsers([]);
    }
  }, [BASE_API_URL]);

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
      }
    } catch (error) {
      console.error("Критическая ошибка парсинга полигонов из localStorage. Очищаю и пытаюсь загрузить с сервера:", error);
      showToast('Критическая ошибка загрузки полигонов с локального устройства, пытаюсь загрузить с сервера.', 'error');
      localStorage.removeItem('savedPolygons');
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        if (handleLogout) {
            handleLogout();
        } else {
            navigate('/login');
        }
        return;
    }

    try {
        const decodedToken = jwtDecode(token);
        const roles = decodedToken.roles;
        if (roles && Array.isArray(roles) && roles.includes('ROLE_ADMIN')) {
            setUserRole('ADMIN');
            fetchAllUsers();
        } else {
            setUserRole('USER');
        }
    } catch (error) {
        console.error("Ошибка декодирования токена или определения роли:", error);
        setUserRole('GUEST');
        showToast('Ошибка определения роли пользователя. Пожалуйста, перезайдите.', 'error');
        if (handleLogout) {
            handleLogout();
        } else {
            navigate('/login');
        }
        return;
    }

    if (!loadedFromLocalStorage) {
      showMyPolygons();
    }
  }, [showToast, showMyPolygons, handleLogout, navigate, fetchAllUsers]);

  const handleUserSelectForAdminView = useCallback((event) => {
    const userId = event.target.value;
    const user = allUsers.find(u => String(u.id) === userId); 
    setSelectedUserForAdminView(user || null);

    if (user) {
        showToast(`Просмотр полигонов для пользователя: ${user.email}`, 'info');
        showMyPolygons(user.id);
    } else {
        showToast('Просмотр полигонов текущего пользователя (админа).', 'info');
        showMyPolygons(null);
    }
  }, [allUsers, showMyPolygons, showToast]);


  const finalSelectedPolygonData = selectedPolygon;

  // Вычисляем позицию bottom для UserSelectionBlock
  // Она должна быть на 40px выше верха LayerSelectionBlock.
  // Верх LayerSelectionBlock находится на `window.innerHeight - (layerBlockInitialBottom + layerBlockHeight)`.
  // Или проще, bottom UserSelectionBlock должен быть `layerBlockInitialBottom + layerBlockHeight + 40`.
  const userBlockCalculatedBottom = `${layerBlockInitialBottom + layerBlockHeight + 30}px`;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', position: 'relative' }}>
      <MapComponent
        polygons={polygons}
        onPolygonComplete={onPolygonComplete}
        onPolygonEdited={onPolygonEdited}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        editableFGRef={editableFGRef} // <--- Убедитесь, что editableFGRef передается здесь
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        isEditingMode={isEditingMode}
        editingMapPolygon={editingMapPolygon}
        analysisDateRange={analysisDateRange}
        onLoadingChange={handleAnalysisLoadingChange}
        onError={handleAnalysisError}
        onPointAdded={() => { /* Placeholder for future use */ }}
        activeBaseMapType={activeBaseMapType}
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
        userRole={userRole}
        allUsers={allUsers}
        selectedUserForAdminView={selectedUserForAdminView}
        handleUserSelectForAdminView={handleUserSelectForAdminView}
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

      {finalSelectedPolygonData && activeAnalysisType && activeAnalysisType !== 'none' && (
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

      {userRole === 'ADMIN' && (
        <UserSelectionBlock
          userRole={userRole}
          allUsers={allUsers}
          selectedUserForAdminView={selectedUserForAdminView}
          handleUserSelectForAdminView={handleUserSelectForAdminView}
          calculatedBottom={userBlockCalculatedBottom} // Передаем вычисленное значение bottom
        />
      )}

      <LayerSelectionBlock
        selectedPolygonData={finalSelectedPolygonData}
        activeBaseMapType={activeBaseMapType}
        onSelectBaseMap={setActiveBaseMapType}
        activeAnalysisType={activeAnalysisType}
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon}
        setBlockHeight={setLayerBlockHeight} // Передаем функцию-сеттер
      />
    </div>
  );
}
