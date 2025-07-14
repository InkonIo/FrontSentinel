import React, { useState, useEffect, useCallback } from 'react';
import { ImageOverlay } from 'react-leaflet';
import L from 'leaflet';

// >>> ВАЖНО: УСТАНОВИТЕ ВАШ БАЗОВЫЙ URL БЭКЕНДА ЗДЕСЬ! <<<
// Он должен быть ТОЛЬКО корнем вашего домена/приложения, без '/api' или '/polygons'.
// Например: 'http://localhost:8080' для локальной разработки, или
// 'back-production-b3f2.up.railway.app' для вашего развернутого бэкенда.
const BASE_API_URL = 'https://back-production-b3f2.up.railway.app'; // Обновленный URL

export default function PolygonAnalysisLayer({
  map, // Теперь принимаем map как пропс
  selectedPolygonData, // Полные данные выбранного полигона (включая coordinates)
  activeAnalysisType,    // Например: 'NDVI', 'TRUE_COLOR'
  analysisDateRange,     // Объект { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
  onLoadingChange,       // Коллбэк для уведомления родителя о состоянии загрузки
  onError                // Коллбэк для уведомления родителя об ошибках
}) {
  const [analysisImageUrl, setAnalysisImageUrl] = useState(null);
  const [imageBounds, setImageBounds] = useState(null); // Границы для ImageOverlay

  // Функция для запроса аналитического изображения с бэкенда
  const fetchAnalysisImage = useCallback(async () => {
    console.log('fetchAnalysisImage: Проверка зависимостей...');
    console.log('   selectedPolygonData:', selectedPolygonData);
    console.log('   activeAnalysisType:', activeAnalysisType);
    console.log('   analysisDateRange:', analysisDateRange);
    console.log('   map:', map); // <--- ВАЖНО: Проверяем, что map не null
    console.log('   selectedPolygonData.coordinates:', selectedPolygonData?.coordinates); // <--- ДОБАВЛЕНО: Логируем координаты

    // Проверяем наличие необходимых данных, включая map
    if (!selectedPolygonData || !activeAnalysisType || !analysisDateRange || !map) {
      console.log('fetchAnalysisImage: Одна или несколько зависимостей отсутствуют. Пропускаем запрос.');
      setAnalysisImageUrl(null);
      setImageBounds(null);
      return;
    }

    onLoadingChange(true); // Уведомляем родителя о начале загрузки
    setAnalysisImageUrl(null); // Сбрасываем предыдущее изображение
    setImageBounds(null);

    try {
      // Убедимся, что selectedPolygonData.coordinates существует и является массивом
      if (!selectedPolygonData.coordinates || !Array.isArray(selectedPolygonData.coordinates) || selectedPolygonData.coordinates.length === 0) {
        console.error('fetchAnalysisImage: selectedPolygonData.coordinates отсутствует или пуст. Текущие данные:', selectedPolygonData); // <--- ОБНОВЛЕНО: Добавлены текущие данные
        onError('Ошибка: Данные координат полигона отсутствуют.');
        onLoadingChange(false);
        return;
      }

      // Проверяем, является ли это массивом массивов (для мультиполигонов) или просто массивом координат
      // Leaflet-Draw обычно возвращает массив [lat, lng] для простых полигонов.
      // Если это массив массивов (например, [[lat, lng], [lat, lng]]), берем первое кольцо.
      const outerRing = Array.isArray(selectedPolygonData.coordinates[0]) && Array.isArray(selectedPolygonData.coordinates[0][0])
                             ? selectedPolygonData.coordinates[0]
                             : selectedPolygonData.coordinates;

      if (outerRing.length < 3) {
        console.error('fetchAnalysisImage: Полигон содержит менее 3 точек, невозможно сформировать действительный полигон. Координаты:', outerRing); // <--- ОБНОВЛЕНО: Добавлены координаты
        onError('Ошибка: Полигон содержит менее 3 точек.');
        onLoadingChange(false);
        return;
      }

      // Преобразуем координаты полигона из формата Leaflet [lat, lng] в GeoJSON [lng, lat]
      // GeoJSON всегда использует [долгота, широта]
      const geoJsonCoordinates = outerRing.map(coord => [coord[1], coord[0]]);
      const geoJsonPolygon = {
        type: "Polygon",
        coordinates: [geoJsonCoordinates] // GeoJSON полигон - это массив массивов координат
      };

      // Определяем bounding box полигона для наложения ImageOverlay
      // Leaflet.js getBounds() возвращает LatLngBounds, который можно преобразовать в [southWest, northEast]
      const bounds = L.polygon(outerRing).getBounds(); // Используем outerRing для получения границ
      const imageOverlayBounds = [
        [bounds.getSouth(), bounds.getWest()],
        [bounds.getNorth(), bounds.getEast()]
      ];

      console.log('fetchAnalysisImage: Рассчитанные границы изображения:', imageOverlayBounds);

      // Параметры для запроса к вашему бэкенд-эндпоинту
      const requestBody = {
        polygonGeoJson: JSON.stringify(geoJsonPolygon), // Отправляем GeoJSON как строку
        analysisType: activeAnalysisType,
        dateFrom: analysisDateRange.from,
        dateTo: analysisDateRange.to,
        width: 512, // Желаемая ширина изображения (можно сделать динамической)
        height: 512, // Желаемая высота изображения (можно сделать динамической)
      };

      console.log('fetchAnalysisImage: Тело запроса:', requestBody);

      // Получаем токен аутентификации пользователя из localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        onError('Ошибка: Токен аутентификации отсутствует. Пожалуйста, войдите в систему.');
        onLoadingChange(false);
        return;
      }

      console.log('fetchAnalysisImage: Отправка запроса к API...');
      const response = await fetch(`${BASE_API_URL}/api/sentinel/process-image`, { // Обновленный URL
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Ошибка загрузки аналитического слоя: ${response.status} - ${errorText}`;
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error && errorJson.error.message) {
                errorMessage = `Ошибка Sentinel Hub: ${errorJson.error.message}`;
            }
        } catch (e) {
            // Игнорируем ошибку парсинга JSON, используем необработанный текст
        }
        console.error('fetchAnalysisImage: Ошибка ответа API:', errorMessage);
        throw new Error(errorMessage);
      }

      // Получаем изображение как Blob и создаем URL объекта
      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      
      setAnalysisImageUrl(imageUrl);
      setImageBounds(imageOverlayBounds); // Устанавливаем границы для ImageOverlay
      console.log('fetchAnalysisImage: Изображение успешно загружено. URL изображения:', imageUrl);

    } catch (error) {
      console.error('fetchAnalysisImage: Ошибка при получении аналитического слоя:', error);
      onError(`Не удалось загрузить аналитический слой: ${error.message}`);
      setAnalysisImageUrl(null);
      setImageBounds(null);
    } finally {
      onLoadingChange(false); // Уведомляем родителя о завершении загрузки
      console.log('fetchAnalysisImage: Операция получения завершена.');
    }
  }, [selectedPolygonData, activeAnalysisType, analysisDateRange, map, onLoadingChange, onError]);

  // Эффект для вызова fetchAnalysisImage при изменении пропсов
  useEffect(() => {
    console.log('PolygonAnalysisLayer useEffect: Зависимости изменились, вызываем fetchAnalysisImage.');
    fetchAnalysisImage();
    // Очищаем URL объекта при размонтировании компонента
    return () => {
      if (analysisImageUrl) {
        URL.revokeObjectURL(analysisImageUrl);
        console.log('PolygonAnalysisLayer useEffect: Отменен старый URL изображения.');
      }
    };
  }, [fetchAnalysisImage]); // <--- ИЗМЕНЕНО: analysisImageUrl удален из зависимостей

  // Рендерим ImageOverlay, если есть URL изображения и границы
  console.log('PolygonAnalysisLayer render: analysisImageUrl:', analysisImageUrl, 'imageBounds:', imageBounds);
  return (
    analysisImageUrl && imageBounds ? (
      <ImageOverlay url={analysisImageUrl} bounds={imageBounds} opacity={0.7} zIndex={9999} />
    ) : null
  );
}
