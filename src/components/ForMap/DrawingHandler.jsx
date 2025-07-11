// components/ForMap/DrawingHandler.jsx
import React, { useState, useEffect } from 'react';
import { Polygon, useMapEvents } from 'react-leaflet';

// Пользовательский компонент для рисования полигонов
export default function DrawingHandler({ onPolygonComplete, onStopAndSave, isDrawing, setIsDrawing, onPointAdded }) {
  const [currentPath, setCurrentPath] = useState([]); // Состояние для хранения текущих координат рисуемого полигона
  const [hoveredPoint, setHoveredPoint] = useState(null); // Точка, следующая за курсором, для визуализации линии

  // Предоставление текущего пути родительскому компоненту через глобальные методы window.
  // Это позволяет родителю вручную сохранить рисуемый полигон.
  useEffect(() => {
    if (onStopAndSave) {
      window.getCurrentPath = () => currentPath;
      window.clearCurrentPath = () => setCurrentPath([]);
    }
    // Функция очистки: удаляем глобальные методы при размонтировании компонента
    return () => { 
      if (onStopAndSave) {
        delete window.getCurrentPath;
        delete window.clearCurrentPath;
      }
    };
  }, [currentPath, onStopAndSave]); // Пересоздавать эффект только при изменении currentPath или onStopAndSave

  // Хук useMapEvents позволяет реагировать на события карты Leaflet
  useMapEvents({
    click: (e) => {
      console.log('DrawingHandler: Click event. isDrawing:', isDrawing, 'currentPath length:', currentPath.length);
      // Если режим рисования не активен, игнорируем клик
      if (!isDrawing) return;

      const newPoint = [e.latlng.lat, e.latlng.lng]; // Получаем координаты клика
      setCurrentPath((prev) => {
        const updatedPath = [...prev, newPoint];
        // Вызываем onPointAdded каждый раз, когда добавляется новая точка
        if (onPointAdded) {
          console.log('DrawingHandler: Calling onPointAdded.');
          onPointAdded();
        }
        return updatedPath;
      });
    },
    dblclick: (e) => {
      console.log('DrawingHandler: Double click event. isDrawing:', isDrawing, 'currentPath length:', currentPath.length);
      // Если режим рисования не активен или точек меньше 3 (недостаточно для полигона), игнорируем двойной клик
      if (!isDrawing || currentPath.length < 3) return;

      // Завершаем рисование: передаем полный путь полигона родительскому компоненту
      onPolygonComplete(currentPath);
      setCurrentPath([]); // Очищаем текущий путь
      setIsDrawing(false); // Выключаем режим рисования
    },
    mousemove: (e) => {
      console.log('DrawingHandler: Mousemove event. isDrawing:', isDrawing, 'currentPath length:', currentPath.length);
      // Если режим рисования активен и есть хотя бы одна точка в пути, обновляем hoveredPoint
      if (isDrawing && currentPath.length > 0) {
        setHoveredPoint([e.latlng.lat, e.latlng.lng]);
      }
    },
    mouseout: () => {
      console.log('DrawingHandler: Mouseout event. isDrawing:', isDrawing, 'currentPath length:', currentPath.length);
      // Когда курсор покидает карту, очищаем hoveredPoint
      setHoveredPoint(null); 
    }
  });

  // Если режим рисования не активен или точек нет, ничего не рендерим
  if (!isDrawing || currentPath.length === 0) {
    return null;
  }

  // Создаем путь для отображения: добавляем hoveredPoint, если он есть и достаточно точек
  const displayPath = hoveredPoint && currentPath.length >= 1 
    ? [...currentPath, hoveredPoint]
    : currentPath;

  // Рендерим полигон только если точек достаточно для его формирования (минимум 3, для отображения линии достаточно 2 точки, но для завершенного полигона нужно 3)
  if (displayPath.length > 2) {
    return (
      <Polygon
        positions={displayPath} // Координаты для отображения
        pathOptions={{
          color: 'blue', // Цвет обводки
          fillOpacity: 0.2, // Прозрачность заливки
          dashArray: '5, 5', // Пунктирная линия
          weight: 2 // Толщина линии
        }}
      />
    );
  }

  return null;
}
