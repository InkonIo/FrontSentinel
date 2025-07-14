// components/ForMap/PolygonDrawMap.jsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // Импортируем useNavigate для программной навигации
import MapComponent from './MapComponent'; // Импортируем компонент карты
import MapSidebar from './MapSidebar';     // Импортируем компонент боковой панели
import ToastNotification from './ToastNotification'; // Импортируем новый компонент тоста
import ConfirmDialog from './ConfirmDialog'; // Новый компонент диалога подтверждения
import PolygonAnalysisLayer from './PolygonAnalysisLayer'; // Импортируем компонент для аналитических слоев
import AnalysisSelectionBlock from './AnalysisSelectionBlock'; // Импортируем новый компонент
import * as L from 'leaflet';              // Импортируем библиотеку Leaflet для работы с геометрией
import './Map.css';                        // CSS-файл для специфичных стилей карты (если нужен)

// >>> ВАЖНО: УСТАНОВИТЕ ВАШ БАЗОВЫЙ URL БЭКЕНДА ЗДЕСЬ! <<<
// Он должен быть ТОЛЬКО корнем вашего вашего домена/приложения, без '/api' или '/polygons'.
// Например: 'http://localhost:8080' для локальной разработки, или
// 'https://back-production-b3f2.up.railway.app' для вашего Railway App.
const BASE_API_URL = 'https://back-production-b3f2.up.railway.app'; 

// --- Вспомогательная функция для безопасного парсинга тела ответа ---
async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (e) {
      console.error("Failed to parse JSON, falling back to text:", e); // Используем console.error для реальных ошибок
      return await response.text();
    }
  } else {
    return await response.text();
  }
}

// --- Вспомогательная функция для замыкания кольца полигона ---
// Принимает массив координат Leaflet ([lat, lng])
const ensurePolygonClosed = (coordinates) => {
  if (!coordinates || coordinates.length < 3) {
    return coordinates; // Недостаточно точек для полигона
  }

  // Создаем копию массива, чтобы не мутировать оригинал
  let cleanedCoordinates = [...coordinates];

  // Удаляем дублирующиеся точки в конце, если последняя точка совпадает с предпоследней
  // Это важно, потому что Leaflet Draw иногда добавляет последнюю точку дважды
  while (cleanedCoordinates.length >= 2 &&
         cleanedCoordinates[cleanedCoordinates.length - 1][0] === cleanedCoordinates[cleanedCoordinates.length - 2][0] &&
         cleanedCoordinates[cleanedCoordinates.length - 1][1] === cleanedCoordinates[cleanedCoordinates.length - 2][1]) {
    cleanedCoordinates.pop();
  }

  // После очистки, убеждаемся, что кольцо замкнуто (первая и последняя точки совпадают)
  const firstPoint = cleanedCoordinates[0];
  const lastPoint = cleanedCoordinates[cleanedCoordinates.length - 1];

  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    // Если не совпадают, добавляем первую точку в конец
    return [...cleanedCoordinates, firstPoint];
  }
  return cleanedCoordinates; // Кольцо уже замкнуто или было замкнуто после очистки
};


export default function PolygonDrawMap({ handleLogout }) {
  const [polygons, setPolygons] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedPolygon, setSelectedPolygon] = useState(null); // <--- ИЗМЕНЕНО: Теперь хранит полный объект полигона или null
  const [editingMapPolygon, setEditingMapPolygon] = useState(null); // Полигон, который редактируется на карте (для react-leaflet-draw)
  const editableFGRef = useRef();

  // Состояние для тост-уведомлений
  const [toast, setToast] = useState({ message: '', type: '', visible: false });
  // Состояние для отслеживания количества нарисованных точек (для пошаговых подсказок)
  const [drawnPointsCount, setDrawnPointsCount] = useState(0);

  // Состояния для индикаторов загрузки/сохранения на БЭКЕНДЕ
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);
  const [isFetchingPolygons, setIsFetchingPolygons] = useState(false);
  // Состояние для диалога подтверждения очистки
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  // Новые состояния для аналитических слоев
  const [activeAnalysisType, setActiveAnalysisType] = useState(null);
  const [analysisDateRange, setAnalysisDateRange] = useState({ from: '', to: '' });
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false); // Индикатор загрузки аналитического слоя

  const navigate = useNavigate(); // Инициализируем хук навигации


  // Функция для отображения тост-уведомлений
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, visible: true });
    const timer = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 5000); // Сообщение исчезнет через 5 секунд
    return () => clearTimeout(timer); // Очистка таймера
  }, []);

  const calculateArea = useCallback((coordinates) => {
  if (coordinates.length < 3) return 0;

  const R = 6378137; // Радиус Земли в метрах
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
  return Math.abs(area); // в м²
}, []);

  const formatArea = useCallback((area) => {
  if (area < 10000) return `${area.toFixed(1)} м²`;
  if (area < 1000000) return `${(area / 10000).toFixed(1)} га`;
  return `${(area / 1000000).toFixed(1)} км²`;
}, []);

  // --- Функция сохранения/обновления полигона в БД ---
  const savePolygonToDatabase = useCallback(async (polygonData, isUpdate = false) => {
    // Деструктурируем все поля, включая name, crop, comment и color
    const { id, name, coordinates, crop, comment, color } = polygonData;

    if (!name || name.trim() === '') {
      showToast('Ошибка сохранения: название полигона не может быть пустым.', 'error');
      console.error('Ошибка сохранения: название полигона не может быть пустым.');
      return;
    }

    // Преобразуем Leaflet [lat, lng] в GeoJSON [lng, lat]
    // И сразу замыкаем кольцо
    let geoJsonCoords = ensurePolygonClosed(coordinates).map(coord => [coord[1], coord[0]]);

    // Формируем GeoJSON Geometry (ТОЛЬКО геометрию, без Feature и properties)
    const geoJsonGeometry = {
        type: "Polygon",
        coordinates: [geoJsonCoords] // Теперь это строка только с геометрией
    };
    const geoJsonString = JSON.stringify(geoJsonGeometry);

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) { // Вызываем handleLogout, если он передан
        handleLogout();
      } else {
        navigate('/login'); // Запасной вариант перенаправления
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
        // Теперь отправляем name, crop, comment и color как ОТДЕЛЬНЫЕ поля в теле запроса,
        // а geoJson - только строковое представление геометрии.
        body: JSON.stringify({
          id: isUpdate ? id : undefined,
          geoJson: geoJsonString, // Отправляем только GeoJSON Geometry
          name: name,             // Отдельное поле для имени
          crop: crop || null,     // Отдельное поле для культуры (если нет, отправляем null)
          comment: comment || null, // Отдельное поле для комментария (если нет, отправляем null)
          color: color || '#0000FF' // Отдельное поле для цвета (по умолчанию синий, если не задан)
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

        // Обновляем локальное состояние с реальным ID от сервера.
        // Это вызовет эффект сохранения в localStorage.
        setPolygons(prev => prev.map(p => p.id === id ? { ...p, id: String(actualPolygonId) } : p));
      } else {
        // Если это обновление, локальное состояние уже должно быть обновлено
        // через updatePolygonName/updatePolygonCrop/handleStopAndSaveEdit
        // Здесь мы просто подтверждаем, что polygonData актуальна.
        setPolygons(prev => prev.map(p => p.id === id ? { ...polygonData } : p));
      }

    } catch (error) {
      showToast(`Не удалось ${isUpdate ? 'обновить' : 'сохранить'} полигон на сервере: ${error.message}`, 'error');
      console.error(`Ошибка при ${isUpdate ? 'обновлении' : 'сохранении'} полигона на сервере:`, error);
    } finally {
      setIsSavingPolygon(false);
    }
  }, [showToast, handleLogout, navigate]); // Добавляем handleLogout и navigate в зависимости

  // --- Коллбэки для управления полигонами ---

  // Начать режим рисования
  const startDrawing = () => {
    console.log('startDrawing: Entering drawing mode');
    setIsDrawing(true);
    setSelectedPolygon(null); // <--- ИЗМЕНЕНО: Сбрасываем выбранный полигон
    setIsEditingMode(false);
    setEditingMapPolygon(null);
    editableFGRef.current?.clearLayers(); // Очищаем временный слой редактирования
    setDrawnPointsCount(0); // Сбрасываем счетчик точек при начале нового рисования
    // Показываем первый тост с инструкциями для первого клика
    showToast(
      '📍 Режим рисования активен. На карте выберите свое поле и поставьте первую точку.',
      'info'
    );
  };

  // Callback, который MapComponent должен вызывать при каждом добавлении точки
  const handlePointAdded = useCallback(() => {
    setDrawnPointsCount(prevCount => {
      const newCount = prevCount + 1;
      console.log(`PolygonDrawMap: handlePointAdded called. New count: ${newCount}`);
      return newCount;
    });
  }, []);

  // Эффект для отображения тостеров в зависимости от количества нарисованных точек
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


  // Остановить режим рисования (без сохранения)
  const stopDrawing = () => {
    console.log('stopDrawing: Exiting drawing mode');
    if (window.clearCurrentPath) {
      window.clearCurrentPath();
    }
    showToast('Режим рисования остановлен.', 'info');
  };

  // Коллбэк, вызываемый DrawingHandler при завершении рисования (двойной клик)
  const onPolygonComplete = useCallback((coordinates) => {
    console.log('onPolygonComplete: New polygon completed', coordinates);
    // Замыкаем кольцо сразу после получения координат от DrawingHandler
    const closedCoordinates = ensurePolygonClosed(coordinates);

    // Генерируем случайный цвет в формате HEX для нового полигона
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    const newPolygon = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Временный ID
      coordinates: closedCoordinates, // Используем уже замкнутые координаты
      color: randomColor, // Присваиваем случайный цвет
      crop: null,
      name: `Новый полигон ${new Date().toLocaleString()}`,
      comment: null // Инициализируем комментарий
    };

    // Сразу добавляем в локальное состояние (и это вызовет сохранение в localStorage через useEffect)
    setPolygons((prev) => [...prev, newPolygon]);

    setIsDrawing(false);
    setDrawnPointsCount(0); // Сбрасываем счетчик точек
    setSelectedPolygon(newPolygon); // <--- ИЗМЕНЕНО: Передаем полный объект
    showToast('Полигон нарисован и сохранен локально! Отправка на сервер...', 'info');

    // Автоматическое сохранение нового полигона в БД с именем по умолчанию
    savePolygonToDatabase(newPolygon);
  }, [savePolygonToDatabase, showToast]);

  // НОВАЯ ФУНКЦИЯ: Обновление цвета полигона (в локальном состоянии и затем в БД)
  const updatePolygonColor = useCallback((polygonId, newColor) => {
    console.log(`updatePolygonColor: Updating polygon ${polygonId} with color ${newColor}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, color: newColor } : p
      );
      // Если обновленный полигон был выбран, обновляем и selectedPolygon
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
    // Сохранение в БД будет вызвано onBlur в MapSidebar
  }, [selectedPolygon]); // Добавил selectedPolygon в зависимости

  // Удалить полигон по ID из локального состояния и БД
  const deletePolygon = useCallback(async (id) => {
    console.log('deletePolygon: Attempting to delete polygon with ID', id);
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) { // Вызываем handleLogout, если он передан
        handleLogout();
      } else {
        navigate('/login'); // Запасной вариант перенаправления
      }
      return;
    }

    // Удаляем сначала из локального состояния для мгновенного отклика (вызовет сохранение в localStorage)
    setPolygons((prev) => prev.filter((p) => p.id !== id));
    setSelectedPolygon(null); // <--- ИЗМЕНЕНО: Сбрасываем выбранный полигон
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
      // Если удаление с сервера не удалось, рассмотрите возможность вернуть полигон в UI
      // или предложить опцию "повторить синхронизацию"
    }
  }, [editingMapPolygon, showToast, handleLogout, navigate]);

  // Запуск диалога подтверждения очистки всех полигонов
  const confirmClearAll = useCallback(() => {
    setShowClearAllConfirm(true);
  }, []);

  // Отмена очистки всех полигонов
  const cancelClearAll = useCallback(() => {
    setShowClearAllConfirm(false);
    showToast('Очистка всех полигонов отменена.', 'info');
  }, [showToast]);

  // Подтверждение очистки всех полигонов (из локального состояния и из БД)
  const handleClearAllConfirmed = useCallback(async () => {
    setShowClearAllConfirm(false);
    showToast('Начинаю очистку всех полигонов...', 'info');

    // Очищаем локальное состояние и localStorage для мгновенного отклика
    setPolygons([]);
    localStorage.removeItem('savedPolygons');

    setSelectedPolygon(null); // <--- ИЗМЕНЕНО: Сбрасываем выбранный полигон
    setIsDrawing(false);
    setIsEditingMode(false);
    setEditingMapPolygon(null);
    editableFGRef.current?.clearLayers(); // Очищаем временный слой редактирования
    showToast('Все полигоны удалены локально. Отправка запроса на сервер...', 'info');

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) { // Вызываем handleLogout, если он передан
        handleLogout();
      } else {
        navigate('/login'); // Запасной вариант перенаправления
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

  // Очистить все полигоны (теперь вызывает подтверждение)
  const clearAll = useCallback(() => {
    if (polygons.length === 0) {
      showToast('На карте нет полигонов для удаления.', 'info');
      return;
    }
    confirmClearAll();
  }, [polygons.length, confirmClearAll, showToast]);

  // Очистить все назначенные культуры со всех полигонов (только на фронтенде)
  const clearAllCrops = useCallback(() => {
    console.log('clearAllCrops: Clearing all assigned crops.');
    // Обновляем локальное состояние (вызовет сохранение в localStorage).
    setPolygons((prev) => prev.map((p) => ({ ...p, crop: null, comment: null, color: '#0000FF' }))); // Также очищаем комментарий и сбрасываем цвет на синий
    // Если выбранный полигон был изменен, обновляем его
    if (selectedPolygon) {
      setSelectedPolygon(prev => ({ ...prev, crop: null, comment: null, color: '#0000FF' }));
    }
    showToast('Все культуры, комментарии и цвета полигонов сброшены. Синхронизируйте с сервером вручную, если необходимо.', 'info');
  }, [showToast, selectedPolygon]); // Добавил selectedPolygon в зависимости

  // Обновить культуру для конкретного полигона (в локальном состоянии и затем в БД)
  const updatePolygonCrop = useCallback((polygonId, newCrop) => {
    console.log(`updatePolygonCrop: Updating polygon ${polygonId} with crop ${newCrop}.`);
    // Обновляем локальное состояние (вызовет сохранение в localStorage)
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) => (p.id === polygonId ? { ...p, crop: newCrop } : p));
      // Если обновленный полигон был выбран, обновляем и selectedPolygon
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys; 
    });
    // Сохранение в БД будет вызвано onBlur в MapSidebar
  }, [selectedPolygon]); // Добавил selectedPolygon в зависимости

  // Обновление имени полигона (в локальном состоянии и затем в БД)
  const updatePolygonName = useCallback((polygonId, newName) => {
    console.log(`updatePolygonName: Updating polygon ${polygonId} with name ${newName}.`);
    // Обновляем локальное состояние (вызовет сохранение в localStorage)
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, name: newName } : p
      );
      // Если обновленный полигон был выбран, обновляем и selectedPolygon
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys; 
    });
    // Сохранение в БД будет вызвано onBlur в MapSidebar
  }, [selectedPolygon]); // Добавил selectedPolygon в зависимости

  // НОВАЯ ФУНКЦИЯ: Обновление комментария полигона (в локальном состоянии и затем в БД)
  const updatePolygonComment = useCallback((polygonId, newComment) => {
    console.log(`updatePolygonComment: Updating polygon ${polygonId} with comment ${newComment}.`);
    setPolygons((prev) => {
      const updatedPolys = prev.map((p) =>
        p.id === polygonId ? { ...p, comment: newComment } : p
      );
      // Если обновленный полигон был выбран, обновляем и selectedPolygon
      if (selectedPolygon && selectedPolygon.id === polygonId) {
        setSelectedPolygon(updatedPolys.find(p => p.id === polygonId));
      }
      return updatedPolys;
    });
    // Сохранение в БД будет вызвано onBlur в MapSidebar
  }, [selectedPolygon]); // Добавил selectedPolygon в зависимости

  // Коллбэк для выбора аналитического слоя для полигона
  const onSelectAnalysisForPolygon = useCallback((polygonData, analysisType) => { // <--- ИЗМЕНЕНО: Теперь принимает полный объект polygonData
    console.log(`onSelectAnalysisForPolygon: Selected polygon ${polygonData.id} for analysis type ${analysisType}`);
    
    // Если выбран тот же полигон и тот же тип анализа, то выключаем слой
    if (selectedPolygon && selectedPolygon.id === polygonData.id && activeAnalysisType === analysisType) {
      setActiveAnalysisType(null); // Выключаем активный тип анализа
      // setSelectedPolygon(null); // Не сбрасываем выбранный полигон, чтобы блок оставался активным
      showToast(`Слой "${analysisType}" для полигона выключен.`, 'info');
    } else {
      setSelectedPolygon(polygonData); // <--- ИЗМЕНЕНО: Устанавливаем полный объект полигона
      setActiveAnalysisType(analysisType); // Устанавливаем активный тип анализа
      
      // Устанавливаем диапазон дат для анализа (можно сделать динамическим, но пока фиксировано)
      const today = new Date();
      // Получаем дату за 2 месяца до текущей
      const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
      setAnalysisDateRange({
        from: twoMonthsAgo.toISOString().split('T')[0], // ФорматГГГГ-MM-DD
        to: today.toISOString().split('T')[0] // ФорматГГГГ-MM-DD
      });

      showToast(`Загрузка слоя "${analysisType}" для полигона...`, 'info');
    }
  }, [selectedPolygon, activeAnalysisType, showToast]); // selectedPolygon и activeAnalysisType в зависимостях

  // Коллбэк для обновления состояния загрузки аналитического слоя
  const handleAnalysisLoadingChange = useCallback((isLoading) => {
    setIsAnalysisLoading(isLoading);
  }, []);

  // Коллбэк для обработки ошибок аналитического слоя
  const handleAnalysisError = useCallback((errorMessage) => {
    showToast(errorMessage, 'error');
    setActiveAnalysisType(null); // Сбрасываем активный тип анализа при ошибке
  }, [showToast]);


  // --- Логика редактирования полигона с помощью react-leaflet-draw ---

  // Функция для начала редактирования выбранного полигона
  const handleEditPolygon = useCallback((polygonId) => {
    console.log(`[handleEditPolygon] Attempting to edit polygon with ID: ${polygonId}`);
    // Сбросить флаги сохранения/загрузки на всякий случай
    setIsSavingPolygon(false);
    setIsFetchingPolygons(false);

    // Очищаем режим рисования, если он активен
    if (isDrawing) {
      console.log('[handleEditPolygon] Exiting drawing mode.');
      setIsDrawing(false);
      if (window.clearCurrentPath) window.clearCurrentPath(); // Очищаем незавершенное рисование
    }
    
    // Если уже был активен режим редактирования (например, нажали на другой полигон),
    // очищаем предыдущие слои, которыми управлял EditControl.
    if (editableFGRef.current) {
        editableFGRef.current.clearLayers();
    }

    const polygonToEdit = polygons.find((p) => p.id === polygonId);
    if (!polygonToEdit) {
      console.error('[handleEditPolygon] Polygon for editing not found in state.');
      showToast('Полигон для редактирования не найден.', 'error');
      return;
    }

    // Устанавливаем состояния, которые вызовут рендеринг MapComponent
    // и активацию эффекта редактирования в нем
    setIsEditingMode(true); 
    setEditingMapPolygon(polygonToEdit); // Передаем полигон для редактирования в MapComponent
    setSelectedPolygon(polygonToEdit); // <--- ИЗМЕНЕНО: Передаем полный объект полигона
    // Показываем тост с инструкциями для редактирования
    showToast(
      `📍 Режим редактирования активен. Перемещайте вершины полигона, чтобы изменить его форму. Нажмите "Остановить и сохранить" в боковой панели, чтобы применить изменения.`, 
      'info'
    );
    console.log('[handleEditPolygon] isEditingMode set to TRUE. isSavingPolygon and isFetchingPolygons set to FALSE.');
  }, [polygons, isDrawing, showToast]); 

  // Функция для программной остановки и сохранения редактирования (как формы, так и карты)
  const handleStopAndSaveEdit = useCallback(() => {
    console.log('handleStopAndSaveEdit: Attempting to stop and save.');
    // Если мы в режиме рисования, завершаем рисование (и очищаем DrawingHandler)
    if (isDrawing) {
      if (window.clearCurrentPath) window.clearCurrentPath(); 
      stopDrawing(); 
      showToast('Рисование остановлено.', 'info'); // Тост при остановке рисования
    } 
    // Если мы в режиме редактирования формы/карты, сохраняем изменения.
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
                  // Обновляем локальное состояние напрямую (вызовет сохранение в localStorage)
                  setPolygons(prev => prev.map(p => p.id === updatedPoly.id ? updatedPoly : p));
                  // Если редактируемый полигон был выбран, обновляем и selectedPolygon
                  if (selectedPolygon && selectedPolygon.id === updatedPoly.id) {
                    setSelectedPolygon(updatedPoly); // <--- ИЗМЕНЕНО: Обновляем selectedPolygon
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
      showToast('Редактирование завершено и сохранено.', 'success'); // Тост при завершении редактирования
    } else {
      showToast('Нет активных режимов для сохранения.', 'info');
    }
  }, [isDrawing, stopDrawing, isEditingMode, editingMapPolygon, polygons, savePolygonToDatabase, showToast, selectedPolygon]); // Добавил selectedPolygon в зависимости


  // Коллбэк, вызываемый EditControl после завершения редактирования формы полигона
  const onPolygonEdited = useCallback(async (e) => {
    // Этот коллбэк EditControl может быть вызван, если пользователь завершил редактирование
    // с помощью кнопок EditControl (хотя они скрыты) или нажав Esc.
    console.log('onPolygonEdited: Event received from EditControl. Layers:', e.layers);
    
    // Если мы все еще в режиме редактирования, сбрасываем его UI-состояние
    if (isEditingMode) {
      setIsEditingMode(false);
      setEditingMapPolygon(null);
      // editableFGRef.current?.clearLayers(); // Слой уже будет очищен при handleStopAndSaveEdit
      showToast('Редактирование формы на карте завершено.', 'info');
    }
  }, [isEditingMode, editingMapPolygon, showToast]);


  // Функция для загрузки "Моих полигонов" с сервера
  const showMyPolygons = useCallback(async () => {
    showToast('Загрузка ваших полигонов с сервера...', 'info');
    
    const token = localStorage.getItem('token');
    if (!token) {
      showToast('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.', 'error');
      console.error('Ошибка: Токен аутентификации отсутствует.');
      if (handleLogout) { // Вызываем handleLogout, если он передан
        handleLogout();
      } else {
        navigate('/login'); // Запасной вариант перенаправления
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
            // Теперь name, crop, comment и color приходят как отдельные поля в item из PolygonAreaResponseDto
            let name = item.name || `Загруженный полигон ${item.id || String(Date.now())}`;
            let crop = item.crop || null;
            let comment = item.comment || null; // Извлекаем комментарий
            let color = item.color || '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'); // Извлекаем цвет, если нет - генерируем случайный

            try {
              const geoJsonObj = JSON.parse(item.geoJson); // item.geoJson теперь должен быть чистой геометрией

              // Проверяем, является ли это чистой геометрией Polygon
              if (geoJsonObj && geoJsonObj.type === "Polygon" && geoJsonObj.coordinates && geoJsonObj.coordinates[0]) {
                  // Замыкаем кольцо при загрузке, на всякий случай
                  coordinates = ensurePolygonClosed(geoJsonObj.coordinates[0].map(coord => [coord[1], coord[0]])); // [lng, lat] to [lat, lng]
              } 
              else {
                  // Если структура не соответствует Polygon
                  console.warn('Invalid GeoJSON Geometry structure for item (expected Polygon directly):', item);
              }

            } catch (e) {
              console.error('Failed to parse geoJson for item:', item, e);
              // Устанавливаем пустые координаты, чтобы не сломать отрисовку
              coordinates = []; 
            }

            return {
              id: String(item.id), 
              coordinates: coordinates,
              color: color, 
              crop: crop, 
              name: name,
              comment: comment // Передаем комментарий в объект полигона
            };
          }).filter(p => p.coordinates.length >= 3); // Отфильтровываем полигоны без координат

          setPolygons(loadedPolygons); // Обновляем основное состояние полигонов (вызовет сохранение в localStorage)
          showToast(`Загружено ${loadedPolygons.length} ваших полигонов с сервера.`, 'success');
          
          setIsDrawing(false);
          setIsEditingMode(false);
          setEditingMapPolygon(null);
          editableFGRef.current?.clearLayers(); 
          setSelectedPolygon(null); // <--- ИЗМЕНЕНО: Сбрасываем выбранный полигон
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
  }, [showToast, handleLogout, navigate]); // Добавляем handleLogout и navigate в зависимости

  // Эффект для инициализации полигонов: сначала из localStorage, затем из API
  useEffect(() => {
    let loadedFromLocalStorage = false;
    try {
      const storedPolygons = localStorage.getItem('savedPolygons');
      if (storedPolygons !== null && storedPolygons !== '[]') { // Проверяем, что не null и не пустой массив
        const parsedPolygons = JSON.parse(storedPolygons);
        // Дополнительная валидация, чтобы убедиться, что данные выглядят как массив полигонов
        // Теперь также проверяем наличие 'comment' и 'color'
        if (Array.isArray(parsedPolygons) && parsedPolygons.every(p => p && p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 3 && 'comment' in p && 'color' in p)) {
          // Замыкаем кольцо для полигонов, загруженных из localStorage
          const closedPolygons = parsedPolygons.map(p => ({
            ...p,
            coordinates: ensurePolygonClosed(p.coordinates)
          }));
          setPolygons(closedPolygons);
          showToast('Полигоны загружены с локального устройства.', 'success');
          loadedFromLocalStorage = true;
        } else {
          console.warn('Invalid polygons data format in localStorage. Clearing and attempting to load from server.', parsedPolygons);
          localStorage.removeItem('savedPolygons'); // Очищаем поврежденные или некорректные данные
        }
      } else {
        console.log('localStorage для полигонов пуст или отсутствует. Загружаю с сервера.');
      }
    } catch (error) {
      console.error("Критическая ошибка парсинга полигонов из localStorage. Очищаю и пытаюсь загрузить с сервера:", error);
      showToast('Критическая ошибка загрузки полигонов с локального устройства, пытаюсь загрузить с сервера.', 'error');
      localStorage.removeItem('savedPolygons'); // Очищаем данные, вызвавшие ошибку
    }

    // Если не удалось загрузить из localStorage, или localStorage был пуст/некорректен, загружаем с сервера
    if (!loadedFromLocalStorage) {
      const token = localStorage.getItem('token');
      if (!token) {
        // Если токена нет при загрузке страницы, сразу перенаправляем на логин
        if (handleLogout) {
          handleLogout();
        } else {
          navigate('/login');
        }
        return;
      }
      showMyPolygons();
    }
  }, [showToast, showMyPolygons, handleLogout, navigate]); // Добавляем handleLogout и navigate в зависимости

  // Получаем данные выбранного полигона для PolygonAnalysisLayer
  // <--- ИЗМЕНЕНО: finalSelectedPolygonData теперь просто ссылается на selectedPolygon,
  // так как selectedPolygon уже является полным объектом.
  // Замыкание кольца уже происходит при загрузке/создании полигона.
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
        selectedPolygon={selectedPolygon} // <--- Передаем полный объект
        setSelectedPolygon={setSelectedPolygon}
        isEditingMode={isEditingMode} 
        editingMapPolygon={editingMapPolygon} // <-- Передаем полигон для редактирования
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon} // НОВЫЙ ПРОП: Передаем функцию выбора анализа
        activeAnalysisType={activeAnalysisType} // НОВЫЙ ПРОП: Передаем активный тип анализа
        analysisDateRange={analysisDateRange} // НОВЫЙ ПРОП: Передаем диапазон дат анализа
        onLoadingChange={handleAnalysisLoadingChange} // НОВЫЙ ПРОП: Передаем коллбэк для загрузки
        onError={handleAnalysisError} // НОВЫЙ ПРОП: Передаем коллбэк для ошибок
        onPointAdded={handlePointAdded} // НОВЫЙ ПРОП: Передаем коллбэк для добавления точек
      />

      <MapSidebar
        polygons={polygons}
        selectedPolygon={selectedPolygon} // <--- Передаем полный объект
        setSelectedPolygon={setSelectedPolygon}
        deletePolygon={deletePolygon}
        handleEditPolygon={handleEditPolygon}
        // Удалены props, связанные с API Wikipedia
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
        updatePolygonColor={updatePolygonColor} // НОВЫЙ ПРОП: Передаем функцию обновления цвета
        isSavingPolygon={isSavingPolygon} 
        isFetchingPolygons={isFetchingPolygons} 
        showCropsSection={(polygons && polygons.length > 0) || isDrawing || isEditingMode || selectedPolygon} 
        savePolygonToDatabase={savePolygonToDatabase} 
        BASE_API_URL={BASE_API_URL} // Передаем BASE_API_URL в MapSidebar
      />

      <ToastNotification 
        message={toast.message} 
        type={toast.type} 
        visible={toast.visible} 
      />

      {/* Диалог подтверждения очистки всех полигонов */} 
      {showClearAllConfirm && ( 
        <ConfirmDialog 
          message="Вы уверены, что хотите удалить ВСЕ полигоны? Это действие необратимо." 
          onConfirm={handleClearAllConfirmed} 
          onCancel={cancelClearAll} 
          isProcessing={isSavingPolygon} // Используем isSavingPolygon как индикатор процесса 
        /> 
      )}

      {/* Рендерим PolygonAnalysisLayer только если есть выбранный полигон и активный тип анализа */}
      {finalSelectedPolygonData && activeAnalysisType && (
        <PolygonAnalysisLayer
          selectedPolygonData={finalSelectedPolygonData} // Передаем полный объект полигона с замкнутым кольцом
          activeAnalysisType={activeAnalysisType}
          analysisDateRange={analysisDateRange}
          onLoadingChange={handleAnalysisLoadingChange}
          onError={handleAnalysisError}
        />
      )}

      {/* Индикатор загрузки аналитического слоя */}
      {isAnalysisLoading && (
        <div style={{
          position: 'absolute', bottom: '35px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)', color: 'white', padding: '10px 20px',
          borderRadius: '8px', zIndex: 1000, fontSize: '14px', textAlign: 'center',
        }}>
          Загрузка аналитического слоя...
        </div>
      )}

      {/* НОВЫЙ БЛОК ДЛЯ ВЫБОРА АНАЛИЗА */}
      <AnalysisSelectionBlock
        selectedPolygonData={finalSelectedPolygonData} // <--- Передаем полный объект
        activeAnalysisType={activeAnalysisType}
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon}
      />
    </div>
  );
}
