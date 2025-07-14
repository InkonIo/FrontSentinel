// components/ForMap/LayerSelectionBlock.jsx
import React from 'react';

// Опции для выбора базовой карты
const baseMapOptions = [
  { value: 'openstreetmap', label: 'Стандартный (OpenStreetMap)' },
  { value: 'sentinel', label: 'Натуральный цвет (Sentinel-Hub)' },
  { value: 'none', label: 'Выкл. базовый слой' }, // Добавляем опцию для отключения базовой карты
];

// Опции для выбора аналитического слоя
const analysisOptions = [
  { value: 'none', label: 'Выкл. аналитический слой' }, // Опция для выключения аналитического слоя
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

export default function LayerSelectionBlock({
  selectedPolygonData,        // Данные выбранного полигона (для аналитических слоев)
  activeBaseMapType,          // Текущий активный тип базовой карты
  onSelectBaseMap,            // Функция для выбора базовой карты
  activeAnalysisType,         // Текущий активный тип анализа
  onSelectAnalysisForPolygon, // Функция для выбора аналитического слоя
}) {
  return (
    <div style={{
      position: 'absolute',
      top: '650px', // Размещаем сверху, чтобы не конфликтовать с другими блоками снизу
      left: '10px',
      backgroundColor: 'rgba(26, 26, 26, 0.9)',
      color: '#f0f0f0',
      padding: '15px',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      zIndex: 999,
      minWidth: '280px', // Увеличиваем ширину для лучшего вида
      maxWidth: '350px',
      display: 'flex',
      flexDirection: 'column',
      gap: '15px', // Увеличиваем зазор между секциями
      fontFamily: 'Inter, sans-serif',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {/* Секция выбора базовой карты */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: '18px', color: '#4CAF50' }}>Выбор Базовой Карты</h4>
        <p style={{ margin: '0 0 10px', fontSize: '14px', lineHeight: '1.4' }}>
          Выберите базовый слой для отображения.
        </p>
        <select
          onChange={(e) => onSelectBaseMap(e.target.value)}
          value={activeBaseMapType || 'openstreetmap'}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #555', backgroundColor: '#333', color: '#f0f0f0',
            fontSize: '14px', cursor: 'pointer', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23f0f0f0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            backgroundSize: '16px'
          }}
        >
          {baseMapOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {activeBaseMapType && (activeBaseMapType !== 'none') && (
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#bbb' }}>
            Активный базовый слой: {baseMapOptions.find(opt => opt.value === activeBaseMapType)?.label}
          </p>
        )}
      </div>

      {/* Горизонтальная линия для разделения секций */}
      <hr style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }} />

      {/* Секция выбора аналитического слоя */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: '18px', color: '#4CAF50' }}>Анализ Полигона</h4>
        {selectedPolygonData ? (
          <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 'bold' }}>
            Выбран полигон: {selectedPolygonData.name || 'Без названия'}
          </p>
        ) : (
          <p style={{ margin: '0 0 10px', fontSize: '14px', lineHeight: '1.4' }}>
            Выберите метку с полигоном на карте, чтобы начать анализ.
          </p>
        )}
        <select
          onChange={(e) => {
            const selectedType = e.target.value;
            // Передаем весь объект полигона, чтобы функция onSelectAnalysisForPolygon могла работать
            onSelectAnalysisForPolygon(selectedPolygonData, selectedType); 
          }}
          value={activeAnalysisType || 'none'} // Устанавливаем текущий активный тип или 'none'
          disabled={!selectedPolygonData} // Отключаем, если полигон не выбран
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: '1px solid #555', backgroundColor: selectedPolygonData ? '#333' : '#222',
            color: selectedPolygonData ? '#f0f0f0' : '#888', fontSize: '14px',
            cursor: selectedPolygonData ? 'pointer' : 'not-allowed', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${selectedPolygonData ? '%23f0f0f0' : '%23888'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            backgroundSize: '16px'
          }}
        >
          {analysisOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedPolygonData && activeAnalysisType && activeAnalysisType !== 'none' && (
          <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#bbb' }}>
            Активный аналитический слой: {analysisOptions.find(opt => opt.value === activeAnalysisType)?.label}
          </p>
        )}
      </div>
    </div>
  );
}