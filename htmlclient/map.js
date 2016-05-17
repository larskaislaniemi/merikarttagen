var modeDrawing = false;
var drawInteraction; 
var modifyInteraction;
var selectInteraction;
var dragBoxInteraction;
var features = new ol.Collection();
var currentFeatureSelection  = null;
var selectedExtent = null;

var wgs84Sphere = new ol.Sphere(6378137);
var KM2NM = 0.539956803;

var lvAttributionText = '&copy; Liikennevirasto. Aineistolisenssi Liikenneviraston <a href="http://www.liikennevirasto.fi/avoindata/kayttoehdot/merikartoitusaineiston-lisenssi">sivuilla</a>.';
// EPSG 3067 definition, ETRS-TM35FIN
proj4.defs("EPSG:3067","+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

var extent = [50199.4814, 6582464.0358, 761274.6247, 7799839.8902];

var projection = new ol.proj.Projection({
  code: 'EPSG:3067',
  extent: extent
});

var layers = [
  new ol.layer.Tile({
    extent: extent,
    projection: projection,
    source: new ol.source.TileWMS({
      url: 'http://meri.kaislaniemi.net:81/service',
      crossOrigin: 'anonymous',
      attributions: lvAttributionText,
      params: {
        'LAYERS': 'merikartta_s025',
        'FORMAT': 'image/png'
      },
      serverType: 'geoserver',
      //serverType: /** @type {ol.source.wms.ServerType} */ ('mapserver')
    }),
    minResolution: 5,
    maxResolution: 15,
  }),
  new ol.layer.Tile({
    extent: extent,
    projection: projection,
    source: new ol.source.TileWMS({
      url: 'http://meri.kaislaniemi.net:81/service',
      crossOrigin: 'anonymous',
      attributions: lvAttributionText,
      params: {
        'LAYERS': 'merikartta_s050',
        'FORMAT': 'image/png'
      },
      serverType: 'geoserver',
      //serverType: /** @type {ol.source.wms.ServerType} */ ('mapserver')
    }),
    minResolution: 15,
    maxResolution: 25,
  }),
  new ol.layer.Tile({
    extent: extent,
    projection: projection,
    source: new ol.source.TileWMS({
      url: 'http://meri.kaislaniemi.net:81/service',
      crossOrigin: 'anonymous',
      attributions: lvAttributionText,
      params: {
        'LAYERS': 'merikartta_s100',
        'FORMAT': 'image/png'
      },
      serverType: 'geoserver',
    }),
    minResolution: 35,
    maxResolution: 45,
  })
  
];

var formatCoordinateSimple = function(c) {
  var options = {
    inproj: 'EPSG:4326',
    outproj: 'EPSG:4326',
    coord: c
  };

  return formatCoordinate(options);
}

var formatCoordinate = function(options) {
  var latdeg, latmin, londeg, lonmin, coordStr;
  var proj;
  
  outproj = (options.outproj || 'EPSG:4326');
  if (outproj != 'EPSG:4326') return "N/A";

  inproj = (options.inproj || 'EPSG:4326');

  var c = ol.proj.transform(options.coord, inproj, outproj);
 
  latdeg = Math.floor(c[1]);
  latmin = ((c[1] - latdeg)*60.0).toFixed(2);
  londeg = Math.floor(c[0]);
  lonmin = ((c[0] - londeg)*60.0).toFixed(2);

  if (latmin < 10) { latmin = "0" + latmin; }
  else { latmin = "" + latmin; }
  if (lonmin < 10) { lonmin = "0" + lonmin; }
  else { lonmin = "" + lonmin; }

  coordStr = "" + latdeg + "&deg;" + latmin + "'&nbsp;N, " + londeg + "&deg;" + lonmin + "'&nbsp;E";
  return coordStr;
}

var ctrlScaleLine = new ol.control.ScaleLine({
  minWidth: 100,
  target: map,
  units: 'metric'
});

var ctrlAttribution = new ol.control.Attribution({
  target: map
});

var ctrlMousePosition = new ol.control.MousePosition({
  target: map,
  projection: 'EPSG:4326',
  coordinateFormat: formatCoordinateSimple,
  className: 'ol-mouse-position-cust'
});

var ctrlZoom = new ol.control.Zoom({
  duration: 0,
  target: map
});

var SwitchControl = function(opt_options) {
  var options = opt_options || {};

  var button = document.createElement('button');
  button.innerHTML = options.labels[options.currentmode];
  button.title = (options.title || "");
  this.currentmode = options.currentmode;
  
  var this_ = this;
  var handleButton = function() {
    options.currentmode += 1;
    if (options.currentmode >= options.labels.length) {
      options.currentmode = 0;
    }
    button.innerHTML = options.labels[options.currentmode];
    this_.currentmode = options.currentmode;
    (options.switchaction)(this_);
  };

  button.addEventListener('click', handleButton, false);

  var element = document.createElement('div');
  element.className = 'ol-unselectable ol-control ' + (options.classname || "");
  element.appendChild(button);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(SwitchControl, ol.control.Control);

var ActionControl = function(opt_options) {
  var options = opt_options || {};

  var button = document.createElement('button');
  button.innerHTML = options.label;
  button.title = (options.title || "");
  
  var this_ = this;
  var handleButton = function() {
    (options.action)(this_);
  };

  button.addEventListener('click', handleButton, false);

  var element = document.createElement('div');
  element.className = 'ol-unselectable ol-control ' + (options.classname || "");
  element.appendChild(button);

  ol.control.Control.call(this, {
    element: element,
    target: options.target
  });
}
ol.inherits(ActionControl, ol.control.Control);

var TextControl = function(opt_options) {
  var options = opt_options || {};

  var textbox = document.createElement('div');
  textbox.id = options.elementid;
  this.ctrlElement = textbox;
  textbox.innerHTML = options.html;
  textbox.className = 'ol-unselectable ol-control ' + (options.classname || "");

  ol.control.Control.call(this, {
    element: textbox,
    target: options.target
  });
}
ol.inherits(TextControl, ol.control.Control);

var download = function (filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

var downloadBinary = function(filename, content) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:application/octet-stream;chartset=binary,' + content);
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function featuresToJSON() {
  var geojsonf = new ol.format.GeoJSON();
  return geojsonf.writeFeatures(featureOverlay.getSource().getFeatures(), {
    dataProjection: 'EPSG:3067',
    featureProjection: 'EPSG:3067',
    decimals: 1
  });
}

var featureOverlay = new ol.layer.Vector({
  source: new ol.source.Vector({features: features}),
  style: new ol.style.Style({
    fill: new ol.style.Fill({
      color: 'rgba(255, 255, 255, 0.2)'
    }),
    stroke: new ol.style.Stroke({
      color: '#f63',
      width: 4
    }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({
	color: '#f63'
      })
    })
  })
});

function setupModifyInteraction() {
  // modifyInteraction is global
  modifyInteraction = new ol.interaction.Modify({
    features: features,
    // the SHIFT key must be pressed to delete vertices, so
    // that new vertices can be drawn at the same position
    // of existing vertices
    deleteCondition: function(event) {
      return ol.events.condition.shiftKeyOnly(event) &&
          ol.events.condition.singleClick(event);
    }
  });
};

function setupDrawInteraction() {
  // drawInteraction is global
  drawInteraction = new ol.interaction.Draw({
    features: features,
    type: /** @type {ol.geom.GeometryType} */ ("LineString"),
    freehandCondition: ol.events.condition.altShiftKeysOnly
  });
};

function setupDragBoxInteraction() {
  // dragBoxInteraction is global
  dragBoxInteraction = new ol.interaction.DragBox({
    condition: ol.events.condition.always,
    style: new ol.style.Style
    ({
      stroke: new ol.style.Stroke({color: [0, 0, 255, 1]})
    })
  });
  dragBoxInteraction.on('boxend', function() {
    selectedExtent = dragBoxInteraction.getGeometry().getExtent();
    downloadPDFMap();
  });
  document.getElementById('mapOptionsForm').style.display = 'block';
};

var ctrlTextBox = new TextControl({
  target: map,
  html: "<div>&nbsp;</div>",
  classname: "ol-textbox-info",
  elementid: "infobox"

});
ctrlTextBox.ctrlElement.innerHTML = "<div>Click the <b>?</b> button " +
  " to choose action: <b>M</b> – make/modify markings; <b>S</b> – select " +
  "markings; <b>D</b> – download map in PDF format</div>";

function clearInteractions() {
  map.removeInteraction(selectInteraction);
  map.removeInteraction(dragBoxInteraction);
  map.removeInteraction(drawInteraction);
  map.removeInteraction(modifyInteraction);
  document.getElementById('mapOptionsForm').style.display = 'none';
  ctrlDeleteFeature.element.style.display = 'none';
}

var modeControlOptions = {
  target: map,
  labels: ['?', 'M', 'S', 'D'],
  currentmode: 0,
  classname: 'ol-button-choosemode',
  title: "Choose mode: S = Select markings; M = Draw markings; D = Download PDF map",
  switchaction: function(c) { 
    if (c.currentmode == 0) {
      clearInteractions();
      ctrlTextBox.ctrlElement.innerHTML = "<div>Click the <b>?</b> button " +
        " to choose action: <b>M</b> – make/modify markings; <b>S</b> – select markings; <b>D</b> – download map in PDF format</div>";
    } else if (c.currentmode == 1) {
      clearInteractions();

      setupDrawInteraction()
      setupModifyInteraction()
      c.getMap().addInteraction(drawInteraction);
      c.getMap().addInteraction(modifyInteraction);
      ctrlTextBox.ctrlElement.innerHTML = "<div><b>Make markings:</b></div>" + 
        "<div>Click to create a line. Double-click to finish. Drag-and-drop " +
        "a point on the line to modify. <u>Shift+Click</u>: Remove a point " +
        "from the line. <u>Alt+Shift+Drag</u>: Draw freehand line.</div>";
    } else if (c.currentmode == 2) {
      clearInteractions();
      
      selectInteraction = new ol.interaction.Select();
      selectInteraction.on('select', selectEventHandler);
      c.getMap().addInteraction(selectInteraction);

      ctrlDeleteFeature.element.style.display = 'block';

      ctrlTextBox.ctrlElement.innerHTML = "<div><u>Click</u> a marking to measure " +
        "its length.</div>"
    } else if (c.currentmode == 3) {
      clearInteractions();
      setupDragBoxInteraction();
      c.getMap().addInteraction(dragBoxInteraction);
      ctrlTextBox.ctrlElement.innerHTML = "<div><u>Draw</u> a rectangle to save " +
        "map and markings as PDF.</div>";
    }
  }
};
var ctrlChooseMode = new SwitchControl(modeControlOptions);

var selectEventHandler = function(e) {
  if (e.selected.length > 0) {
    var geom = e.selected[0].getGeometry();
    var length_m = "N/A";
    var length_nm = "N/A";
    if (geom instanceof ol.geom.LineString) {
      currentFeatureSelection = e.selected[0];
      length = 0.0;
      var coordinates = geom.getCoordinates();
      var sourceProj = map.getView().getProjection();
      for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
        var c1 = ol.proj.transform(coordinates[i], sourceProj, 'EPSG:4326');
        var c2 = ol.proj.transform(coordinates[i + 1], sourceProj, 'EPSG:4326');
        length += wgs84Sphere.haversineDistance(c1, c2);
      }
      length_m = Math.round(length);
      length_nm = Math.round(1e-3 * length * KM2NM * 100.0)/100.0;
      ctrlTextBox.ctrlElement.innerHTML = "<div>Length of selected marking:</div>" + 
        "<div>" + length_m + " m</div><div>" + length_nm + " nm</div>";

//      alert("!");
//      if (ol.events.condition.shiftKeyOnly(e) && 
//          ol.events.condition.singleClick(e)) {
//        alert("!!");
//        featureOverlay.getSource().removeFeature(e.selected[0]);
//      }

//    e.selected[0].setId('deleteThisFeat');
//
//    var allfeats = featureOverlay.getSource().getFeatures();
//    if (allfeats != null && allfeats.length > 0) {
//      for (var i = 0; i < allfeats.length; i++) {
//        if (allfeats[i].getProperties().id == "deleteThisFeat") {
//          featureOverlay.getSource().removeFeature(allfeats[i])
//        }
//      }
//    }

    } else if (geom instanceof ol.geom.Point) {
      currentFeatureSelection = null;
      ctrlTextBox.ctrlElement.innerHTML = "<div>Point:</div><div>" + 
        formatCoordinate({
          inproj: map.getView().getProjection(), 
          outproj: 'EPSG:4326',
          coord: geom.getCoordinates()
        }) + "</div>";
    }
  } else {
    currentFeatureSelection = null;
    ctrlTextBox.ctrlElement.innerHTML = "<div>&nbsp;</div>";
  }
};

var ctrlDeleteFeature = new ActionControl({
  target: map,
  label: "x",
  classname: 'ol-button-deletefeature',
  title: "Delete selected marking",
  action: function(c) {
    if (currentFeatureSelection != null) {
      featureOverlay.getSource().removeFeature(currentFeatureSelection);
      currentFeatureSelection = null;
      ctrlTextBox.ctrlElement.innerHTML = "<div>Marking deleted</div>";
      selectInteraction.getFeatures().clear();
    }
  }
});
ctrlDeleteFeature.element.style.display = 'none';

var map = new ol.Map({
  //controls: ol.control.defaults().extend([
  //  new ol.control.ScaleLine()
  //]),
  layers: layers,
  target: 'map',
  view: new ol.View({
    projection: projection,
    center: [396403,6672892],
    extent: extent,
    resolutions: [40, 20, 10],
    zoom: 7,
    maxZoom: 9,
    minZoom: 7
  }),
  controls: [ ctrlScaleLine, ctrlAttribution, 
    ctrlMousePosition, ctrlZoom, ctrlChooseMode,
    ctrlTextBox, ctrlDeleteFeature ]
});

featureOverlay.setMap(map);
document.getElementById('exportFeaturesButton').addEventListener("click",
    function () { 
      download('markings.json', featuresToJSON());
    });

function downloadLink(content, name, type, linkid) {
  var a = document.getElementById(linkid);
  var file = new Blob([content], {type: type});
  a.href = URL.createObjectURL(file);
  a.download = name;
}

function downloadPDFMap() {
  var featureString = featuresToJSON();
  var papersize = document.getElementById('PDFPaperSelect').value;
  var scale = document.getElementById('PDFScaleSelect').value;
  var mapOptions = {
    //extent: map.getView().calculateExtent(map.getSize()),
    extent: selectedExtent,
    onePageOnly: false,
    scale: scale,
    paperSize: papersize
  };
  if (papersize == "full") {
    mapOptions["onePageOnly"] = true;
  }
  var options = {
    featureString: featureString,
    mapOptions: mapOptions
  };
  document.getElementById('generatingMapText').style.display = 'block';
  $.ajax({
    type: "POST",
    url: "http://meri.kaislaniemi.net:8081/q",
    data: JSON.stringify(options),
    contentType: 'application/json',
    dataType: 'binary',
    processData: false,
    crossDomain: true,
    async: true,
    error: function(data) {
      alert("Problem with map generation");
      document.getElementById('generatingMapText').style.display = 'none';
      document.getElementById('downloadMapLink').style.display = 'block';
    },
    success: function(data) {
      var filename;
      if (data.type == 'application/zip') {
        filename = "map.zip";
      } else if (data.type == 'application/pdf') {
        filename = "map.pdf";
      } else {
        filename = "unknown";
      }
      downloadLink(data, filename, data.type, "downloadMapLink");
      document.getElementById('generatingMapText').style.display = 'none';
      document.getElementById('downloadMapLink').style.display = 'block';
      alert("Map ready. Click 'Save Map' below.");
    }
  });
  return true;
}

document.getElementById('downloadMapLink').addEventListener("click",
    function() {
      this.style.display = 'none';
    }
);
