// components/ForMap/AnalysisSelectionBlock.jsx
import React from 'react';

// Список доступных аналитических слоев для выбора
const analysisOptions = [
  { value: '', label: 'Выкл. слой' }, // <--- ИЗМЕНЕНО: Опция для выключения слоя
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

export default function AnalysisSelectionBlock({
  selectedPolygonData, // Полные данные выбранного полигона
  activeAnalysisType,  // Текущий активный тип анализа
  onSelectAnalysisForPolygon // Функция для выбора слоя
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '35px',
      left: '10px',
      backgroundColor: 'rgba(26, 26, 26, 0.9)', // Темный полупрозрачный фон
      color: '#f0f0f0',
      padding: '15px',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      zIndex: 999, // Убедимся, что блок поверх карты
      minWidth: '250px',
      maxWidth: '300px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      fontFamily: 'Inter, sans-serif',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h4 style={{ margin: '0', fontSize: '18px', color: '#4CAF50' }}>Анализ Полигона</h4>
      
      {/* Текст сообщения в зависимости от selectedPolygonData */}
      {selectedPolygonData ? (
        <p style={{ margin: '0', fontSize: '14px', fontWeight: 'bold' }}>
          Выбран полигон: {selectedPolygonData.name || 'Без названия'}
        </p>
      ) : (
        <p style={{ margin: '0', fontSize: '14px', lineHeight: '1.4' }}>
          Выберите метку с полигоном на карте, чтобы начать анализ.
        </p>
      )}

      {/* Выпадающий список теперь всегда виден, но может быть отключен */}
      <select
        onChange={(e) => {
          const selectedType = e.target.value;
          onSelectAnalysisForPolygon(selectedPolygonData, selectedType); 
        }}
        value={activeAnalysisType || ''} // Устанавливаем текущий активный тип или пустую строку
        disabled={!selectedPolygonData} // Отключаем, если полигон не выбран
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #555',
          backgroundColor: selectedPolygonData ? '#333' : '#222', // Изменяем цвет, когда отключено
          color: selectedPolygonData ? '#f0f0f0' : '#888', // Изменяем цвет текста, когда отключено
          fontSize: '14px',
          cursor: selectedPolygonData ? 'pointer' : 'not-allowed', // Изменяем курсор
          appearance: 'none', // Убираем стандартные стрелки
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${selectedPolygonData ? '%23f0f0f0' : '%23888'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          backgroundSize: '16px'
        }}
      >
        {analysisOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      
      {/* Отображаем активный слой только если полигон выбран и слой активен */}
      {selectedPolygonData && activeAnalysisType && activeAnalysisType !== '' && (
        <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#bbb' }}>
          Активный слой: {analysisOptions.find(opt => opt.value === activeAnalysisType)?.label}
        </p>
      )}
    </div>
  );
}
