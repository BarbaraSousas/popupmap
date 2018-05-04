var map = {
    config: {
        popupMap: {
            openMap: ".open-map",
            closeMap: ".close-map",
            containerMap: ".container-map",
            visible: "is-visible",
            notVisible: "is-not-visible"
        },
        projection: ol.proj.get('EPSG:4326')
    },
    init: function () {
        map.openAndCloseMap();
    },
    openAndCloseMap: function () {
        var openMap = map.config.popupMap.openMap;
        var closeMap = map.config.popupMap.closeMap;
        var containerMap = map.config.popupMap.containerMap;
        var visible = map.config.popupMap.visible;
        var notVisible = map.config.popupMap.notVisible;

        /* Evento para abrir o mapa */
        $(openMap).on("click", function (event) {
            $(containerMap).removeClass(notVisible) && $(containerMap).addClass(visible);
            $(closeMap).removeClass(notVisible) && $(closeMap).addClass(visible);

        });

        /* Evento para fechar o mapa */
        $(closeMap).on("click", function (event) {
            $(containerMap).removeClass(visible) && $(containerMap).addClass(notVisible);
            $(closeMap).removeClass(visible) && $(closeMap).addClass(notVisible);
        });

        map.buildMap();
        layer.setVisible(true);
    },
    buildMap: function () {
        /* Criando o mapa */

        var map_background = new ol.layer.Image({
            source: new ol.source.ImageArcGISRest({
                ratio: 1,
                url: 'https://services.arcgisonline.com/arcgis/rest/services/ESRI_Imagery_World_2D/MapServer'
            })
        });
        mapa = new ol.Map({
            target: 'map',
            layers: [map_background],
            features: source_features = new ol.source.Vector({}),
            view: new ol.View({
                center: ol.proj.transform([-51.1, -12.0], 'EPSG:4326', 'EPSG:3857'),
                zoom: 3,
                minZoom: 4,
                maxZoom: 19
            }),
            params: {
                crossOrigin: 'Anonymous'
            }
        });

        map.overlay();

        /* Feature e configurações necessarias para a função de ir as coordenadas de uma jpeg */
        source_features = new ol.source.Vector({});
        layer = new ol.layer.Vector({
            source: source_features,
            zIndex: 1,
            visible: false
        });
        project = mapa.getView().getProjection().getCode();
        mapa.addLayer(layer);

    },
    overlay: function () {
        var container = document.getElementById('popup');
        var content = document.getElementById('popup-content');
        var projection = map.config.projection;
        var closer = document.getElementById('popup-closer');

        /* Overlay que mostra as coordenadas do lugar clicado no mapa */
        var overlay = new ol.Overlay(({
            element: container,
            autoPan: true,
            autoPanAnimation: {
                duration: 250
            }
        }));
        mapa.addOverlay(overlay);
        mapa.on('singleclick', function (event) {
            var coordinate = event.coordinate;
            var hdms = ol.coordinate.toStringHDMS(ol.proj.transform(coordinate, 'EPSG:3857', 'EPSG:4326'))

            content.innerHTML = hdms;
            overlay.setPosition(coordinate);
        });

        $(closer).on("click", function () {
            overlay.setPosition(undefined);
            closer.blur();
            return false;
        });
    },
    dragoverHandler: function (event) {
        event.preventDefault();
    },
    dropHandler: function (event) {
        event.preventDefault();

        var dt = event.dataTransfer.files;

        var file = dt[0];
        if (file.type != "image/jpeg")
            alert('Arquivo no formato invalido. Envie somente arquivos JPEG');
        /* Extrair os dados de geolocalização da jpeg */
        EXIF.getData(file, function () {
            let todas_tags = EXIF.getAllTags(this);
            let lat = todas_tags.GPSLatitude;
            let lon = todas_tags.GPSLongitude;
            if (lat == undefined || lon == undefined) {
                alert('A imagem não tem coordenadas.');
            } else {
                let latRef = todas_tags.GPSLatitudeRef || "N";
                let lonRef = todas_tags.GPSLongitudeRef || "W";
                lat = (lat[0] + lat[1] / 60 + lat[2] / 3600) * (latRef == "N" ? 1 : -1);
                lon = (lon[0] + lon[1] / 60 + lon[2] / 3600) * (lonRef == "W" ? -1 : 1);
                map.centerMapAtPicCoordinate([lon, lat]);

                map.putIconAtImageCoordinate(lon, lat);
            }
        });
    },
    centerMapAtPicCoordinate: function (coordinates) {
        /* Verifica as coordenadas e as projeto no mapa principal */
        if (!(coordinates instanceof Array) || coordinates.length != 2)
            throw new Error('Não é possivel centralizar nas Coordenadas \'' + coordinates + '\'.');
        let v = mapa.getView();
        let project = mapa.getView().getProjection().getCode();
        let imgLocation = proj4('EPSG:4326', project, coordinates);
        v.animate({
            center: imgLocation,
            duration: 1000,
            zoom: 18
        });
    },
    putIconAtImageCoordinate: function (_longitude, _latitude) {
        /* Salva latitude e longitude numa variável */
        var latitude = _latitude;
        var longitude = _longitude;

        /* Os coloca numa array */
        this.get_coordinates = function () {
            return [longitude, latitude];
        }

        this.set_coordinates = function (coordinates) {
            longitude = coordinates[0];
            latitude = coordinates[1];
        }

        /* Verifica se o icone ja foi criado e a cria caso não tenha sido */
        function get_icon_for_map() {
            if (!map.putIconAtImageCoordinate.icon_map) {
                map.putIconAtImageCoordinate.icon_map = new ol.Feature({
                    geometry: new ol.geom.Point()
                });
                map.putIconAtImageCoordinate.icon_map.setStyle(new ol.style.Style({
                    image: new ol.style.Icon({
                        scale: 0.2,
                        src: 'https://image.flaticon.com/icons/png/128/149/149060.png'
                        // src: 'img/ic_photo_white_24px.svg'
                    }),
                    stroke: new ol.style.Stroke({
                        color: 'rgba(255, 255, 255, 1)',
                        width: 2
                    })
                }));
            }
            return map.putIconAtImageCoordinate.icon_map;
        }

        /* Adiciona na feature que recebe os dados da foto e projeta a imagem no mapa */
        let add_feat = map.putIconAtImageCoordinate.icon_map;
        get_icon_for_map().getGeometry().setCoordinates(proj4('EPSG:4326', project, this.get_coordinates()));
        if (add_feat == undefined)
            source_features.addFeature(map.putIconAtImageCoordinate.icon_map);
    }
}

window.onload = function () {
    map.init();
}
