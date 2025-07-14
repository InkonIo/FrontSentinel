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
import PolygonAnalysisLayer from './PolygonAnalysisLayer';

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
  selectedPolygon, // Получаем из родителя
  setSelectedPolygon, // Получаем из родителя
  isEditingMode,
  editingMapPolygon,
  onSelectAnalysisForPolygon, // Теперь этот пропс используется здесь
  activeAnalysisType, // Получаем из родителя
  setActiveAnalysisType, // Функция для установки активного типа анализа
  onLoadingChange,      // <--- ЭТОТ ПРОПС НУЖНО ИСПОЛЬЗОВАТЬ
  onError,              // <--- ЭТОТ ПРОПС НУЖНО ИСПОЛЬЗОВАТЬ
  onPointAdded,
  analysisDateRange,
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
        console.log('MapEventsHandler: mapInstance установлен в:', map);
      }
    }, [map, setMapInstance]);
    return null;
  }

  const calculateArea = useCallback((coordinates) => {
    const outerRing = Array.isArray(coordinates[0][0]) ? coordinates[0] : coordinates;
    if (outerRing.length < 3) return 0;
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
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

  // Эффект для инициализации EditControl при изменении editingMapPolygon
  useEffect(() => {
    if (isEditingMode && editingMapPolygon && editableFGRef.current) {
      const layerGroup = editableFGRef.current;
      layerGroup.clearLayers();
      const leafletPolygon = L.polygon(editingMapPolygon.coordinates, {
        color: editingMapPolygon.color,
        fillOpacity: 0.2,
        weight: 4,
      }).addTo(layerGroup);
      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        console.log(`EditControl: Editing enabled for polygon ID: ${editingMapPolygon.id}`);
      } else {
        console.warn(`EditControl: Editing not available for polygon ID: ${editingMapPolygon.id}. Check Leaflet.Editable plugin.`);
      }
      // mapRef.current?.fitBounds(leafletPolygon.getBounds()); // УДАЛЕНО: Больше не приближаем автоматически
    } else if (!isEditingMode && editableFGRef.current) {
      editableFGRef.current.clearLayers();
    }
  }, [isEditingMode, editingMapPolygon, editableFGRef]);

  // Сбрасываем activeAnalysisType при изменении selectedPolygon
  useEffect(() => {
    if (!selectedPolygon && activeAnalysisType) {
      setActiveAnalysisType(''); // Сбрасываем тип анализа, если полигон не выбран
      console.log('MapComponent: selectedPolygon сброшен, сбрасываем activeAnalysisType.');
    }
  }, [selectedPolygon, activeAnalysisType, setActiveAnalysisType]);


  console.log('MapComponent render check: selectedPolygon:', selectedPolygon, 'activeAnalysisType:', activeAnalysisType, 'mapInstance:', mapInstance);

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
          console.log('MapContainer: mapInstance установлен в whenCreated:', mapInstance);
          setCurrentZoom(mapInstance.getZoom());
        }
      }}
    >
      <MapEventsHandler />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <PolygonAndMarkerLayer
        polygons={polygons}
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon}
        activeAnalysisType={activeAnalysisType}
        analysisDateRange={analysisDateRange}
        onLoadingChange={onLoadingChange} // <--- ИЗМЕНЕНО: Используем пропс onLoadingChange
        onError={onError} // <--- ИЗМЕНЕНО: Используем пропс onError
        calculateArea={calculateArea}
        formatArea={formatArea}
        flyToMarker={flyToMarker}
        map={mapInstance}
      />

      {selectedPolygon && activeAnalysisType && mapInstance && (
        <PolygonAnalysisLayer
          map={mapInstance}
          selectedPolygonData={selectedPolygon}
          activeAnalysisType={activeAnalysisType}
          analysisDateRange={analysisDateRange}
          onLoadingChange={onLoadingChange} // <--- ИЗМЕНЕНО: Используем пропс onLoadingChange
          onError={onError} // <--- ИЗМЕНЕНО: Используем пропс onError
        />
      )}

      <WMSTileLayer
        url="https://services.sentinel-hub.com/ogc/wms/5c9e1f51-c86f-4b6f-ad22-8310886f2aab"
        layers="2_TONEMAPPED_NATURAL_COLOR"
        format="image/png"
        transparent={true}
        version="1.3.0"
      />

      <DrawingHandler
        onPolygonComplete={onPolygonComplete}
        onStopAndSave={window.getCurrentPath}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        onPointAdded={onPointAdded}
      />

      {isEditingMode && (
        <FeatureGroup ref={editableFGRef}>
          <EditControl
            position="topright" // Кнопки будут в правом верхнем углу
            onEdited={onPolygonEdited}
            draw={{
              polygon: false, rectangle: false, polyline: false,
              circle: false, marker: false, circlemarker: false,
            }}
            edit={{
              featureGroup: editableFGRef.current,
              remove: false,
              // *** Добавьте эту строку, чтобы скрыть кнопку 'Edit layers' ***
              edit: false // Это скроет кнопку 'Edit layers'
            }}
          />
        </FeatureGroup>
      )}
    </MapContainer>
  );
}
