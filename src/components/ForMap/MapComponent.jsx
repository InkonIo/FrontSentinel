// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, useMapEvents, useMap, WMSTileLayer } from 'react-leaflet'; // Добавлен WMSTileLayer
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import DrawingHandler from './DrawingHandler';
import PolygonAndMarkerLayer from './PolygonAndMarkerLayer'; // Компонент для отображения полигонов и маркеров

// Исправляем иконки по умолчанию для Leaflet Draw
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function MapComponent({
  polygons,
  onPolygonComplete,
  onPolygonEdited,
  setIsDrawing,
  isDrawing,
  editableFGRef,
  selectedPolygon,
  isEditingMode,
  editingMapPolygon // <-- Новый пропс: полигон, который сейчас редактируется
}) {
  const mapRef = useRef(null);
  const [zoom, setZoom] = useState(13); // Состояние для отслеживания текущего зума карты

  // Внутренний компонент для доступа к экземпляру карты через useMap
  // Объявляем его внутри MapComponent, чтобы он имел доступ к map
  const MapInteractionHandler = () => {
    const map = useMap(); // Получаем экземпляр карты Leaflet

    // Функция для центрирования и приближения к маркеру
    const flyToMarker = useCallback((latlng, newZoom = 15) => {
      if (map) {
        map.flyTo(latlng, newZoom, {
          duration: 1.5, // Длительность анимации в секундах
        });
      }
    }, [map]);

    useMapEvents({
      zoomend: (e) => {
        setZoom(e.target.getZoom());
      },
    });

    // Рендерим PolygonAndMarkerLayer здесь, передавая ему flyToMarker
    return (
      <PolygonAndMarkerLayer
        polygons={polygons}
        zoom={zoom}
        calculateArea={calculateArea}
        formatArea={formatArea}
        selectedPolygon={selectedPolygon}
        flyToMarker={flyToMarker} // Передаем функцию flyToMarker
      />
    );
  };


  // Мемоизированные функции для расчета и форматирования площади (передаются в PolygonAndMarkerLayer)
  const calculateArea = useCallback((coordinates) => {
    if (coordinates.length < 3) return 0;
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    let area = 0;
    const n = coordinates.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const lat1 = toRadians(coordinates[i][0]);
      const lat2 = toRadians(coordinates[j][0]);
      const deltaLon = toRadians(coordinates[j][1] - coordinates[i][1]);

      const E =
        2 *
        Math.asin(
          Math.sqrt(
            Math.pow(Math.sin((lat2 - lat1) / 2), 2) +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.pow(Math.sin(deltaLon / 2), 2)
          )
        );
      area += E * R * R;
    }
    return Math.abs(area) / 2;
  }, []);

  const formatArea = useCallback((area) => {
    if (area < 10000) return `${area.toFixed(1)} м²`;
    if (area < 1000000) return `${(area / 10000).toFixed(1)} га`;
    return `${(area / 1000000).toFixed(1)} км²`;
  }, []);

  // stopAndSaveDrawingFromMap больше не используется напрямую здесь, DrawingHandler обрабатывает это
  const stopAndSaveDrawingFromMap = useCallback((currentPath) => {
    if (currentPath && currentPath.length >= 3) {
      onPolygonComplete(currentPath);
    }
    setIsDrawing(false);
    if (window.clearCurrentPath) window.clearCurrentPath();
  }, [onPolygonComplete, setIsDrawing]);

  // НОВЫЙ ЭФФЕКТ ДЛЯ РЕДАКТИРОВАНИЯ:
  // Этот эффект отвечает за добавление полигона в editableFGRef и включение редактирования
  useEffect(() => {
    // Проверяем, что режим редактирования включен, реф доступен и есть полигон для редактирования
    if (isEditingMode && editableFGRef.current && editingMapPolygon) {
      console.log('[MapComponent useEffect] Editing mode active, ref and polygon available.');
      // Очищаем любые предыдущие слои в editableFGRef, чтобы убедиться, что только один полигон активен для редактирования
      editableFGRef.current.clearLayers();

      // Создаем Leaflet Polygon слой из координат полигона, который редактируется
      const leafletPolygon = L.polygon(editingMapPolygon.coordinates);
      editableFGRef.current.addLayer(leafletPolygon); // Добавляем его в FeatureGroup

      // Включаем режим редактирования Leaflet для этого слоя
      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        console.log('[MapComponent useEffect] Enabled Leaflet editing for polygon:', editingMapPolygon.id);
      } else {
        console.error('[MapComponent useEffect] Leaflet polygon editing not available for this layer.');
      }
    } else if (!isEditingMode && editableFGRef.current) {
      // Если режим редактирования выключен, очищаем все активные слои редактирования
      editableFGRef.current.clearLayers();
      console.log('[MapComponent useEffect] Editing mode off, cleared editable layers.');
    }
  }, [isEditingMode, editableFGRef, editingMapPolygon]); // Зависимости для этого эффекта

  return (
    <MapContainer
      center={[43.2567, 76.9286]}
      zoom={13}
      style={{ height: '100%', flex: 1 }}
      ref={mapRef}
      whenCreated={(mapInstance) => {
        mapRef.current = mapInstance;
        setZoom(mapInstance.getZoom());
      }}
    >
      <MapInteractionHandler /> {/* Теперь MapInteractionHandler рендерит PolygonAndMarkerLayer */}

      {/* Тайловый слой карты Sentinel-2 True Color (WMS) */}
      <WMSTileLayer
        url="https://services.sentinel-hub.com/ogc/wms/f15c44d0-bbb8-4c66-b94e-6a8c7ab39349" // Ваш Instance ID
        layers="1_TRUE_COLOR" // Стандартное название слоя для True Color Sentinel-2 L2A
        format="image/png"
        transparent={true}
        version="1.3.0"
      />

      {/* DrawingHandler: отвечает за рисование полигонов вручную */}
      <DrawingHandler
        onPolygonComplete={onPolygonComplete}
        onStopAndSave={stopAndSaveDrawingFromMap} 
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
      />

      {/* FeatureGroup для управления слоями, которые могут быть отредактированы с помощью EditControl */}
      {/* Этот FeatureGroup и EditControl рендерятся ТОЛЬКО если isEditingMode активен */}
      {isEditingMode && ( 
        <FeatureGroup ref={editableFGRef}>
          {/* EditControl теперь всегда внутри FeatureGroup, если FeatureGroup рендерится */}
          <EditControl
            position="topright"
            onEdited={onPolygonEdited}
            draw={{
              polygon: false, rectangle: false, polyline: false,
              circle: false, marker: false, circlemarker: false
            }}
            edit={{
              featureGroup: editableFGRef.current, // editableFGRef.current будет доступен здесь, так как FeatureGroup уже отрендерился
              remove: false, // Отключаем кнопку удаления
              edit: false,   // Отключаем кнопку редактирования
            }}
          />
        </FeatureGroup>
      )}
    </MapContainer>
  );
}
