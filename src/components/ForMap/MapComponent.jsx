// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, WMSTileLayer, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import DrawingHandler from './DrawingHandler';
import PolygonAndMarkerLayer from './PolygonAndMarkerLayer';
// PolygonAnalysisLayer импортируется, но не используется напрямую в этом файле,
// так как он отображается в PolygonDrawMap.jsx
// import PolygonAnalysisLayer from './PolygonAnalysisLayer';

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
  editableFGRef, // <<< Этот пропс может быть undefined, если не передан
  selectedPolygon,
  setSelectedPolygon,
  isEditingMode,
  editingMapPolygon,
  onLoadingChange,
  onError,
  onPointAdded,
  analysisDateRange,
  activeBaseMapType,
}) {
  const mapRef = useRef();
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(13);

  const flyToMarker = useCallback((center, zoom) => {
    if (mapRef.current) {
      mapRef.current.flyTo(center, zoom);
    }
  }, []);

  function MapEventsHandler() {
    const map = useMap();
    useEffect(() => {
      if (map) {
        mapRef.current = map;
        setMapInstance(map);
      }
    }, [map, setMapInstance]);
    return null;
  }

  const calculateArea = useCallback((coordinates) => {
    // Убедитесь, что coordinates в формате [lat, lng]
    const outerRing = Array.isArray(coordinates[0][0]) ? coordinates[0] : coordinates;
    if (outerRing.length < 3) return 0;
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const R = 6371000; // Радиус Земли в метрах
    let area = 0;
    const n = outerRing.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const lat1 = toRadians(outerRing[i][0]);
      const lat2 = toRadians(outerRing[j][0]);
      const deltaLon = toRadians(outerRing[j][1] - outerRing[i][1]);
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

  // ЭФФЕКТ ДЛЯ АКТИВАЦИИ РЕЖИМА РЕДАКТИРОВАНИЯ
  useEffect(() => {

    // Убедитесь, что editableFGRef.current существует, прежде чем пытаться с ним работать
    if (isEditingMode && editingMapPolygon && editableFGRef && editableFGRef.current) {
      editableFGRef.current.clearLayers(); // Очищаем предыдущие слои

      // Создаем Leaflet Polygon из координат
      // Убедитесь, что editingMapPolygon.coordinates имеет формат [[lat, lng], [lat, lng], ...]
      // Если координаты в формате [[lng, lat]], нужно их поменять местами: coord => [coord[1], coord[0]]
      const leafletPolygon = L.polygon(editingMapPolygon.coordinates, {
        color: editingMapPolygon.color,
        fillOpacity: 0.2, // Сделать его немного прозрачным, чтобы видеть подложку
        weight: 4,
        // Дополнительный стиль для редактируемого полигона
        dashArray: '5, 10', // Пунктирная линия
        lineCap: 'round',
        lineJoin: 'round'
      });
      
      // Добавляем полигон в FeatureGroup для редактирования
      leafletPolygon.addTo(editableFGRef.current);

      // КЛЮЧЕВОЙ МОМЕНТ: Активация редактирования для этого конкретного слоя
      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        // Проверка наличия вершин редактирования
        if (leafletPolygon.editing._editHandlers && leafletPolygon.editing._editHandlers.length > 0) {
            console.log("MapComponent: Обнаружены вершины редактирования.");
        } else {
            console.warn("MapComponent: Вершины редактирования не обнаружены после включения.");
        }
      } else {
        console.error("MapComponent ERROR: leafletPolygon.editing недоступен. Проверьте загрузку Leaflet.Editable.");
        console.log("leafletPolygon объект:", leafletPolygon);
      }

      // Дополнительная проверка: убедитесь, что FeatureGroup содержит слои

    } else if (!isEditingMode && editableFGRef && editableFGRef.current) {
      // Когда выходим из режима редактирования, очищаем группу
      editableFGRef.current.clearLayers();
    }
  }, [isEditingMode, editingMapPolygon, editableFGRef]); // editableFGRef добавлен в зависимости

  return (
    <MapContainer
      center={[43.2567, 76.9286]}
      zoom={13}
      style={{ height: '100%', flex: 1 }}
      ref={mapRef}
      zoomControl={false}
      whenCreated={(mapInstance) => {
        if (mapInstance) {
          mapRef.current = mapInstance;
          setMapInstance(mapInstance);
          setCurrentZoom(mapInstance.getZoom());
        }
      }}
    >
      <MapEventsHandler />

      {activeBaseMapType === 'openstreetmap' && (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          zIndex={1}
        />
      )}

      {activeBaseMapType === 'sentinel' && (
        <WMSTileLayer
          url="https://services.sentinel-hub.com/ogc/wms/5b29f7b4-15d8-44b1-b89e-345252847af1"
          layers="2_TONEMAPPED_NATURAL_COLOR"
          format="image/png"
          transparent={true}
          version="1.3.0"
          zIndex={100}
        />
      )}

      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        attribution='&copy; <a href="https://www.esri.com/">Esri</a>, <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        zIndex={2}
      />

      <PolygonAndMarkerLayer
        polygons={polygons}
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        analysisDateRange={analysisDateRange}
        onLoadingChange={onLoadingChange}
        onError={onError}
        calculateArea={calculateArea}
        formatArea={formatArea}
        flyToMarker={flyToMarker}
        map={mapInstance}
      />

      <DrawingHandler
        onPolygonComplete={onPolygonComplete}
        onStopAndSave={window.getCurrentPath}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        onPointAdded={onPointAdded}
      />

     
      {isEditingMode && (
        <FeatureGroup ref={editableFGRef} zIndex={500}>
          <EditControl
            position="topright"
            onEdited={onPolygonEdited}
            draw={{
              polygon: false, rectangle: false, polyline: false,
              circle: false, marker: false, circlemarker: false,
            }}
            edit={{
              featureGroup: editableFGRef.current,
              remove: false,
              // УДАЛЕНА СТРОКА: edit: true
            }}
          />
        </FeatureGroup>
      )}
    </MapContainer>
  );
}
