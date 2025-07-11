// components/ForMap/MapComponent.jsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, FeatureGroup, WMSTileLayer } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import * as L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import DrawingHandler from './DrawingHandler';
import MapInteractionHandler from './MapInteractionHandler';

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
  editingMapPolygon,
  onSelectAnalysisForPolygon,
  activeAnalysisType,
  isAnalysisLoading,
  onLoadingChange,
  onError,
  analysisDateRange,
  onPointAdded // Колбэк для уведомления о добавлении точки
}) {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null); // СОСТОЯНИЕ для экземпляра карты
  const [zoom, setZoom] = useState(13);

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

  const stopAndSaveDrawingFromMap = useCallback((currentPath) => {
    if (currentPath && currentPath.length >= 3) {
      onPolygonComplete(currentPath);
    }
    setIsDrawing(false);
    if (window.clearCurrentPath) window.clearCurrentPath();
  }, [onPolygonComplete, setIsDrawing]);

  useEffect(() => {
    if (isEditingMode && editableFGRef.current && editingMapPolygon) {
      console.log('[MapComponent useEffect] Editing mode active, ref and polygon available.');
      editableFGRef.current.clearLayers();

      const leafletPolygon = L.polygon(editingMapPolygon.coordinates);
      editableFGRef.current.addLayer(leafletPolygon);

      if (leafletPolygon.editing) {
        leafletPolygon.editing.enable();
        console.log('[MapComponent useEffect] Enabled Leaflet editing for polygon:', editingMapPolygon.id);
      } else {
        console.error('[MapComponent useEffect] Leaflet polygon editing not available for this layer.');
      }
    } else if (!isEditingMode && editableFGRef.current) {
      editableFGRef.current.clearLayers();
      console.log('[MapComponent useEffect] Editing mode off, cleared editable layers.');
    }
  }, [isEditingMode, editableFGRef, editingMapPolygon]);

  // УДАЛЕН: useEffect для прослушивания событий DRAWVERTEX на mapInstance,
  // так как теперь DrawingHandler будет напрямую вызывать onPointAdded.
  // Это предотвращает дублирование и обеспечивает более надежный вызов.

  return (
    <MapContainer
      center={[43.2567, 76.9286]}
      zoom={13}
      style={{ height: '100%', flex: 1 }}
      ref={mapRef}
      zoomControl={false}
      whenCreated={(mapInstance) => {
        mapRef.current = mapInstance;
        setMapInstance(mapInstance); // СОХРАНЯЕМ ЭКЗЕМПЛЯР КАРТЫ В СОСТОЯНИЕ
        setZoom(mapInstance.getZoom());
      }}
    >
      {/* Передаем все необходимые пропсы, включая mapInstance */}
      <MapInteractionHandler 
        mapInstance={mapInstance} // <-- ПЕРЕДАЕМ ЭКЗЕМПЛЯР КАРТЫ
        polygons={polygons}
        selectedPolygon={selectedPolygon}
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon}
        activeAnalysisType={activeAnalysisType}
        analysisDateRange={analysisDateRange}
        onLoadingChange={onLoadingChange}
        onError={onError}
        calculateArea={calculateArea}
        formatArea={formatArea}
        setZoom={setZoom}
      />

      <WMSTileLayer
        url="https://services.sentinel-hub.com/ogc/wms/5b29f7b4-15d8-44b1-b89e-345252847af1" // Ваш Instance ID
        layers="2_TONEMAPPED_NATURAL_COLOR" // Стандартное название слоя для True Color Sentinel-2 L2A
        format="image/png"
        transparent={true}
        version="1.3.0"
      />

      <DrawingHandler
        onPolygonComplete={onPolygonComplete}
        onStopAndSave={stopAndSaveDrawingFromMap}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        onPointAdded={onPointAdded} // <-- ТЕПЕРЬ ПЕРЕДАЕМ onPointAdded В DrawingHandler
      />

      {isEditingMode && (
        <FeatureGroup ref={editableFGRef}>
          <EditControl
            position="topright"
            onEdited={onPolygonEdited}
            draw={{
              polygon: false, rectangle: false, polyline: false,
              circle: false, marker: false, circlemarker: false
            }}
            edit={{
              featureGroup: editableFGRef.current,
              remove: false,
              edit: false,
            }}
          />
        </FeatureGroup>
      )}
    </MapContainer>
  );
}
