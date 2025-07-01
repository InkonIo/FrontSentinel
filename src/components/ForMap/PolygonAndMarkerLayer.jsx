// components/ForMap/PolygonAndMarkerLayer.jsx
import React from 'react';
import { Polygon, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

export default function PolygonAndMarkerLayer({ 
  polygons, 
  calculateArea, 
  formatArea, 
  selectedPolygon, 
  flyToMarker,
  onSelectAnalysisForPolygon // Новый пропс для выбора анализа
}) {
  // Marker icon for the center of polygons
  const polygonCenterIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png', // Default marker
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
  });

  // Список доступных аналитических слоев для выбора
  const analysisOptions = [
    { value: '', label: 'Выберите слой для анализа' }, // Опция по умолчанию
    { value: 'NDVI', label: 'NDVI (Индекс растительности)' },
    { value: 'FALSE_COLOR', label: 'Ложный цвет (Растительность)' },
    { value: 'FALSE_COLOR_URBAN', label: 'Ложный цвет (Городской)' },
    { value: 'MOISTURE_INDEX', label: 'Индекс влажности' },
    { value: 'NDSI', label: 'Индекс снега' },
    { value: 'NDWI', label: 'Индекс воды' },
    { value: 'SWIR', label: 'SWIR (Коротковолновый ИК)' },
    { value: 'SCENE_CLASSIFICATION', label: 'Карта классификации сцен' },
    { value: 'HIGHLIGHT_OPTIMIZED_NATURAL_COLOR', label: 'Оптимизированный натуральный цвет' },
  ];

  return (
    <>
      {polygons.map((polygon) => {
        const isSelected = selectedPolygon === polygon.id;
        
        // Leaflet polygon options
        const polygonOptions = {
          color: isSelected ? '#ff0000' : polygon.color, // Красный, если выделен
          fillOpacity: 0, // Установлено 0 для прозрачной заливки
          weight: isSelected ? 6 : 4, // <-- Толще граница: 6 для выделенного, 4 для остальных
          opacity: 1,
          lineJoin: 'round',
        };

        // Calculate centroid for the marker (simple average for now)
        // Убедимся, что координаты существуют и не пусты
        let center = [0, 0];
        if (polygon.coordinates && polygon.coordinates.length > 0) {
          // Проверяем, является ли polygon.coordinates массивом массивов (для мультиполигонов)
          // или просто массивом координат (для простых полигонов).
          // Если это массив массивов, берем первое кольцо.
          const outerRing = Array.isArray(polygon.coordinates[0][0]) 
                            ? polygon.coordinates[0] 
                            : polygon.coordinates; 
          
          // ИСПРАВЛЕНИЕ: Более надежная фильтрация и преобразование координат
          const validCoords = outerRing.filter(coord => {
            if (!Array.isArray(coord) || coord.length !== 2) {
              return false; // Не массив из двух элементов
            }
            const lat = parseFloat(coord[0]);
            const lng = parseFloat(coord[1]);
            return !isNaN(lat) && !isNaN(lng); // Оба должны быть действительными числами
          }).map(coord => [parseFloat(coord[0]), parseFloat(coord[1])]); // Преобразуем в числа

          if (validCoords.length > 0) { // Только если есть действительные координаты
            const latSum = validCoords.reduce((sum, coord) => sum + coord[0], 0);
            const lngSum = validCoords.reduce((sum, coord) => sum + coord[1], 0);
            center = [latSum / validCoords.length, lngSum / validCoords.length];
          } else {
            console.warn(`Полигон с ID ${polygon.id} имеет координаты, но ни одна из них не является действительной для расчета центра. Координаты:`, polygon.coordinates);
          }
        } else {
          console.warn(`Полигон с ID ${polygon.id} имеет пустые или некорректные данные координат. Маркер не будет отображен. Координаты:`, polygon.coordinates);
        }

        return (
          <Polygon key={polygon.id} positions={polygon.coordinates} pathOptions={polygonOptions}>
            {/* Optional marker at polygon center */}
            {center[0] !== 0 || center[1] !== 0 ? ( // Рендерим маркер только если центр не [0,0]
              <Marker 
                position={center} 
                icon={polygonCenterIcon}
                eventHandlers={{
                  click: () => {
                    console.log(`Маркер полигона с ID: ${polygon.id} был кликнут.`);
                    flyToMarker(center, 15); // Приближаем к маркеру с зумом 15
                  },
                }}
              >
                <Popup>
                  <div>
                    <strong>Название:</strong> {polygon.name || 'Без названия'} <br/>
                    <strong>Культура:</strong> {polygon.crop || 'Не указана'} <br/>
                    <strong>Площадь:</strong> {formatArea(calculateArea(polygon.coordinates))}
                    <hr style={{ margin: '10px 0' }} />
                    <strong style={{ display: 'block', marginBottom: '5px' }}>Анализ Sentinel:</strong>
                    <select
                      onChange={(e) => {
                        const selectedType = e.target.value;
                        if (selectedType) {
                          onSelectAnalysisForPolygon(polygon.id, selectedType);
                        }
                      }}
                      // Сбрасываем выбор после активации
                      value="" 
                      style={{ width: '100%', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      {analysisOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </Popup>
              </Marker>
            ) : null}
          </Polygon>
        );
      })}
    </>
  );
}
