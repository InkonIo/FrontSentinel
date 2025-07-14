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
// import AnalysisSelectionBlock from './AnalysisSelectionBlock'; // <--- УДАЛЕНО: Больше не нужен здесь

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
  setSelectedPolygon,
  isEditingMode,
  editingMapPolygon,
  // onSelectAnalysisForPolygon, // <--- УДАЛЕНО: Этот пропс теперь не нужен в MapComponent
  // activeAnalysisType,         // <--- УДАЛЕНО: Этот пропс теперь не нужен в MapComponent
  // setActiveAnalysisType,      // <--- УДАЛЕНО: Этот пропс теперь не нужен в MapComponent
  onLoadingChange,
  onError,
  onPointAdded,
  analysisDateRange,
  activeBaseMapType, // <--- НОВЫЙ ПРОП: Получаем активный тип базовой карты
}) {
  const mapRef = useRef();
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(13); // Изменено на 13, чтобы соответствовать MapContainer

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
    } else if (!isEditingMode && editableFGRef.current) {
      editableFGRef.current.clearLayers();
    }
  }, [isEditingMode, editingMapPolygon, editableFGRef]);

  // Этот эффект теперь не нужен, так как activeAnalysisType управляется в PolygonDrawMap
  // useEffect(() => {
  //   if (!selectedPolygon && activeAnalysisType) {
  //     setActiveAnalysisType(''); // Сбрасываем тип анализа, если полигон не выбран
  //     console.log('MapComponent: selectedPolygon сброшен, сбрасываем activeAnalysisType.');
  //   }
  // }, [selectedPolygon, activeAnalysisType, setActiveAnalysisType]);


  // console.log('MapComponent render check: selectedPolygon:', selectedPolygon, 'activeAnalysisType:', activeAnalysisType, 'mapInstance:', mapInstance); // Убраны activeAnalysisType из лога

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

      {/* Условный рендеринг базового слоя на основе activeBaseMapType */}
      {activeBaseMapType === 'openstreetmap' && (
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          zIndex={1} // Базовый слой
        />
      )}

      {activeBaseMapType === 'sentinel' && (
        <WMSTileLayer
          url="https://services.sentinel-hub.com/ogc/wms/5b29f7b4-15d8-44b1-b89e-345252847af1"
          layers="2_TONEMAPPED_NATURAL_COLOR"
          format="image/png"
          transparent={true}
          version="1.3.0"
          zIndex={100} // Базовый слой
        />
      )}
      {/* Если activeBaseMapType === 'none', никакой базовый слой не рендерится */}

      {/* Слой для подписей (Esri World Boundaries and Places) всегда поверх базового слоя */}
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
        attribution='&copy; <a href="https://www.esri.com/">Esri</a>, <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        zIndex={2} // Отображается поверх базового слоя
      />

      <PolygonAndMarkerLayer
        polygons={polygons}
        selectedPolygon={selectedPolygon}
        setSelectedPolygon={setSelectedPolygon}
        // onSelectAnalysisForPolygon={onSelectAnalysisForPolygon} // <--- УДАЛЕНО: Этот пропс теперь не нужен здесь
        // activeAnalysisType={activeAnalysisType}                 // <--- УДАЛЕНО: Этот пропс теперь не нужен здесь
        analysisDateRange={analysisDateRange}
        onLoadingChange={onLoadingChange}
        onError={onError}
        calculateArea={calculateArea}
        formatArea={formatArea}
        flyToMarker={flyToMarker}
        map={mapInstance}
      />

      {/* PolygonAnalysisLayer будет рендериться только если activeAnalysisType не 'none' 
          и будет управляться из PolygonDrawMap */}
      {/* <PolygonAnalysisLayer
          map={mapInstance}
          selectedPolygonData={selectedPolygon}
          activeAnalysisType={activeAnalysisType}
          analysisDateRange={analysisDateRange}
          onLoadingChange={onLoadingChange}
          onError={onError}
      /> */}
      {/* КОММЕНТАРИЙ: PolygonAnalysisLayer теперь рендерится в PolygonDrawMap, 
                    чтобы его можно было отключать, если selectedPolygonData не активен 
                    или activeAnalysisType === 'none'. 
                    Он больше не должен рендериться здесь в MapComponent. */}


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
            position="topright"
            onEdited={onPolygonEdited}
            draw={{
              polygon: false, rectangle: false, polyline: false,
              circle: false, marker: false, circlemarker: false,
            }}
            edit={{
              featureGroup: editableFGRef.current,
              remove: false,
              edit: false
            }}
          />
        </FeatureGroup>
      )}

      {/* <--- УДАЛЕНО: Блок выбора анализа теперь находится в PolygonDrawMap */}
      {/* <AnalysisSelectionBlock
        selectedPolygonData={selectedPolygon}
        activeAnalysisType={activeAnalysisType}
        onSelectAnalysisForPolygon={onSelectAnalysisForPolygon}
      /> */}
    </MapContainer>
  );
}