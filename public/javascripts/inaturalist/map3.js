(function(){
/**
 * iNaturalist map object
 * Copyright (c) iNaturalist, 2007-2008
 * 
 * @created: 2008-01-01
 * @updated: 2008-04-12
 * @author: n8agrin
 * @author: kueda
 */

// requires GoogleMap classes
if (!google && !google.maps)
 throw "The Google Maps libraries must be loaded to use the iNaturalist Map extensions.";

// extend parts of the Google Marker class
google.maps.Marker.prototype.observation_id = null;

// A map consists of the map itself, plus methods on how to add Observations
// javascript objects to the map and handle the updating of those objects
// when an Observation is moved or editted.

// storage for marker objects indexed by their corresponding
// observation_id's
google.maps.Map.prototype.observations = {};
google.maps.Map.prototype.places = {};
    
// used when creating observations from the map
// TODO: make this more like a stack to help with handling multiple
// unsaved markers
google.maps.Map.prototype.lastUnsavedMarker = null;


google.maps.Map.prototype.createMarker = function(lat, lng, options) {
  options = options || {}
  options.position = new google.maps.LatLng(lat, lng)
  return new google.maps.Marker(options);
};
  
// remove a single marker
google.maps.Map.prototype.removeMarker = function(marker) {
  // gracefully clear the listeners out of memory
  google.maps.event.clearInstanceListeners(marker);
  
  // remove the marker from the map
  this.removeOverlay(marker);
};
  
google.maps.Map.prototype.addNewCenteredMarker = function(options) {
  return this.addNewUnsavedMarker(this.getCenter().lat(),
                                  this.getCenter().lng(),
                                  options);
};
  
google.maps.Map.prototype.addNewUnsavedMarker = function(lat, lng, options) {
  this.removeLastUnsavedMarker();
  this.lastUnsavedMarker = this.createMarker(lat, lng, options);
  this.lastUnsavedMarker.setMap(this);
  return this.lastUnsavedMarker;
};
  
// Call this to remove the marker object from the lastUnsavedMarker value in the
// iNaturalist.Map object.  This is usually used when canceling input into
// a form, or when the lastUnsavedMarker object needs to be cleared out.
google.maps.Map.prototype.removeLastUnsavedMarker = function() {
  if (this.lastUnsavedMarker) {
    this.removeMarker(this.lastUnsavedMarker);
    this.lastUnsavedMarker = null;
    return true;
  }
  return false;
};
  
// addObservation adds the observation to the map and tacks a marker
// obejct onto the Observation object.  This assumes the observation has
// already been saved.  Use addUnsavedMarker above if you need to add
// a single marker to the map in an unsaved state.
google.maps.Map.prototype.addObservation = function(observation, options) {
  options = options || {}
  
  // Can't add an obs w/o coordinates
  if (!observation.latitude || !observation.longitude) return false;

  if (!options.icon) {
    options.icon = iNaturalist.Map.createObservationIcon({observation: observation});
  }
  
  var marker = this.createMarker(observation.latitude, observation.longitude, options);
  
  // store the marker for later use, or for easy removing
  this.observations[observation.id] = marker;
  
  // build a generic marker infowwindow
  if (typeof(options.clickable) == 'undefined' || options.clickable != false) {
    marker.message = this.buildObservationInfoWindow(observation);
    
    // add a click handler to the marker so that one can keep track of it.
    google.maps.event.addListener(marker, 'click', this.openInfoWindow)
  };
  
  var bounds = this.getObservationBounds();
  bounds.extend(new google.maps.LatLng(observation.latitude, observation.longitude));
  this.setObservationBounds(bounds);
  
  // add the marker to the map
  marker.setMap(this);
  observation.marker = marker;
  
  if (options.showAccuracy && observation.positional_accuracy && observation.positional_accuracy > 0) {
    var color = observation.iconic_taxon ? iNaturalist.Map.ICONIC_TAXON_COLORS[observation.iconic_taxon.name] : '#333333'
    var circle = new google.maps.Circle({
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: color,
      fillOpacity: 0.35,
      map: this,
      center: marker.getPosition(),
      radius: observation.positional_accuracy
    })
  }
  
  // return the observation for futher use
  return observation;
};
  
google.maps.Map.prototype.removeObservation = function(observation) {
  this.removeMarker(this.observations[observation.id]);
  delete this.observations[observation.id];
};
  
google.maps.Map.prototype.addObservations = function(observations, options) {
  var map = this;
  $.each(observations, function() {
    var success = map.addObservation(this, options);
  });
};
  
// remove many observations from a list of observations
google.maps.Map.prototype.removeObservations = function(observations) {
  var map = this;
  if (typeof(observations) == "undefined") {
    $.each(map.observations, function(k,v) {
      map.removeMarker(v);
      delete map.observations[k];
      delete map.observationBounds;
    });
  } else {
    $.each(observations, function() {
      map.removeObservation(this);
    });
  }
};

google.maps.Map.prototype.getObservationBounds = function() {
  if (typeof(this.observationBounds) == 'undefined') {
    this.observationBounds = new google.maps.LatLngBounds();
  };
  return this.observationBounds;
};

google.maps.Map.prototype.setObservationBounds = function(bounds) {
  this.observationBounds = bounds;
};

google.maps.Map.prototype.zoomToObservations = function() {
  this.fitBounds(this.getObservationBounds())
};

google.maps.Map.prototype.addPlace = function(place, options) {
  if (typeof(options) == 'undefined') { var options = {} };
  
  if (typeof(options.icon) == 'undefined') {
    options.icon = iNaturalist.Map.createPlaceIcon();
  };
  var marker = this.createMarker(place.latitude, place.longitude, options);
  
  this.places[place.id] = marker;
  
  // If this is the first, set the bounds to the extent of the place.
  var placesLength = 0;
  for(var key in this.places) placesLength += 1;

  if (placesLength == 1 && place.swlat != null && place.swlat != '') {
    var bounds = new google.maps.LatLngBounds(new google.maps.LatLng(place.swlat, place.swlng), 
      new google.maps.LatLng(place.nelat, place.nelng));
  }
  // Otherwise just extend the bounds
  else {
    var bounds = this.getPlaceBounds();
    bounds.extend(new google.maps.LatLng(place.latitude, place.longitude));
  }
  this.setPlaceBounds(bounds);
  
  // add the marker to the map
  marker.setMap(this);
  place.marker = marker;
  
  // return the place for futher use
  return place;
}
// 
// google.maps.Map.prototype.addPlaces = function(places, options) {
//   var map = this;
//   $.each(places, function() {
//     var success = map.addPlace(this, options);
//   });
// }
google.maps.Map.prototype.removePlace = function(place) {
  this.removeMarker(this.places[place.id]);
  delete this.places[place.id];
}
google.maps.Map.prototype.removePlaces = function(places) {
  var map = this;
  if (typeof(places) == 'undefined') {
    $.each(map.places, function() {
      map.removeMarker(this);
      delete this;
    });
  } else {
    $.each(places, function() {
      map.removePlace(this);
    });
  }
  this.placeBounds = new google.maps.LatLngBounds();
}
google.maps.Map.prototype.zoomToPlaces = function() {
  var bounds = this.getPlaceBounds();
  this.setZoom(this.getBoundsZoomLevel(bounds));
  this.setCenter(bounds.getCenter());
}
google.maps.Map.prototype.getPlaceBounds = function() {
  if (typeof(this.placeBounds) == 'undefined') {
    this.placeBounds = new google.maps.LatLngBounds();
  };
  return this.placeBounds;
}
google.maps.Map.prototype.setPlaceBounds = function(bounds) {
  this.placeBounds = bounds;
}
  
google.maps.Map.prototype.openInfoWindow = function(e) {
  iNaturalist.Map.infowWindow = iNaturalist.Map.infowWindow || new google.maps.InfoWindow()
  iNaturalist.Map.infowWindow.setContent(this.message)
  iNaturalist.Map.infowWindow.open(this.map, this)
};
  
google.maps.Map.prototype.buildObservationInfoWindow = function(observation) {  
  // First see if we can find an observation component for this observation
  var existing = document.getElementById('observation-'+observation.id);
  if (typeof(existing) != 'undefined' && existing != null) {
    var infowinobs = $(existing).clone().get(0);
    $(infowinobs).find('.details').show();
    var wrapper = $(
      '<div class="mini infowindow observations"></div>').append(infowinobs);
    return $(wrapper).get(0);
  };
  
  var wrapper = $('<div class="observation"></div>');
  if (typeof(observation.image_url) != 'undefined' && observation.image_url != null) {
    wrapper.append(
      $('<img width="75" height="75"></img>').attr('src', observation.image_url).addClass('left')
    );
  } else if (typeof(observation.photos) != 'undefined' && observation.photos.length > 0) {
    wrapper.append(
      $('<img width="75" height="75"></img>').attr('src', observation.photos[0].square_url).addClass('left')
    );
  };
  
  wrapper.append(
    $('<div class="readable attribute"></div>').append(
      $('<a href="/observations/'+observation.id+'"></a>').append(
        observation.species_guess
      ),
      ', by ',
      $('<a href="/people/'+observation.user.login+'"></a>').append(
        observation.user.login
      )
    )
  );
  
  if (typeof(observation.short_description) != 'undefined' && observation.short_description != null) {
    wrapper.append($('<div class="description"></div>').append(observation.short_description));
  } else {
    wrapper.append($('<div class="description"></div>').append(observation.description));
  }
  
  wrapper = $('<div class="observations mini infowindow"></div>').append(wrapper);
  
  return wrapper.get(0);
};

// All obs layer functions.  The mouseover effect was adapted from 
// http://www.usnaviguide.com/ws-2008-02/demotilecookies.htm
google.maps.Map.prototype.showAllObsOverlay = function() {
  if (typeof(this._allObsOverlay) == 'undefined') {
    var myCopyright = new google.maps.CopyrightCollection();
      var allObsLyr = new ObservationsTileLayer(myCopyright, 0, 18, {
      isPNG: true,
      tileUrlTemplate: this._observationsTileServer + '/{Z}/{X}/{Y}.png'
    });
    this._allObsOverlay = new google.maps.TileLayerOverlay(allObsLyr);
    
    // Create an invisible map marker to move over raster pts
    var baseIcon = new google.maps.MarkerImage();
    baseIcon.size = new google.maps.Size(20,20);
    baseIcon.anchor = new google.maps.Point(10,10);
    // baseIcon.shadow = null;
    // baseIcon.image = null;
    this._allObsMarker = new google.maps.Marker(new google.maps.LatLng(35,-90), {icon:baseIcon});
    this._allObsMarker.hide();
    google.maps.event.addListener(this._allObsMarker, 'click', function() {
      var observation = this._observation;
      var maxContentDiv = $('<div class="observations mini maxinfowindow"></div>').append(
        $('<div class="loading status">Loading...</div>')
      ).get(0);
      this.openInfoWindowHtml(
        map.buildObservationInfoWindow(observation),
        {maxContent: maxContentDiv, maxTitle: 'More about this observation'}
      );
      var infoWindow = map.getInfoWindow();
      google.maps.event.addListener(infoWindow, "maximizeclick", function() {
        google.maps.DownloadUrl("/observations/"+observation.id+"?partial=observation", function(data) {
          maxContentDiv.innerHTML = data;
          $(maxContentDiv).find('.details').show();
          if (typeof($.jqm) != 'undefined') {
            $('#modal_image_box').jqmAddTrigger('.maxinfowindow a.modal_image_link');
          }
        });
      });
    });
    map.addOverlay(this._allObsMarker) ;
  };
  
  map.addOverlay(this._allObsOverlay);
  
  // Listen to all mouse mvmnts over the map to see if they pass near obs
  this._mouseMoveListenerHandle = google.maps.event.addListener(map, 'mousemove', 
    this._mouseMoveListener);
}

google.maps.Map.prototype.hideAllObsOverlay = function() {
  if (typeof(this._allObsOverlay) != 'undefined') {
    this.removeOverlay(this._allObsOverlay);
    google.maps.event.removeListener(this._mouseMoveListenerHandle);
  };
}

google.maps.Map.prototype._mouseMoveListener = function(mouseLatLng) {
  var zoom = this.getZoom();
  var mousePx = G_NORMAL_MAP.getProjection().fromLatLngToPixel(mouseLatLng, zoom);
  var tileKey = iNaturalist.Map.obsTilePointsURL(Math.floor(mousePx.x / 256), 
    Math.floor(mousePx.y / 256), zoom);
  
  if (typeof(window.tilePoints[tileKey]) == 'undefined' || window.tilePoints[tileKey].length == 0) return;
  var observations = window.tilePoints[tileKey];
  
  for (var i = observations.length - 1; i >= 0; i--) {
    var obsPx = G_NORMAL_MAP.getProjection().fromLatLngToPixel(
      new google.maps.LatLng(observations[i].latitude, observations[i].longitude), zoom);
    var distance = Math.sqrt(
      Math.pow((mousePx.x - obsPx.x), 2) +
      Math.pow((mousePx.y - obsPx.y), 2)
    );
    
    if (distance < 10) { // if within 10px...
      this._allObsMarker.setLatLng(
        new google.maps.LatLng(observations[i].latitude, observations[i].longitude));
      this._allObsMarker._observation = observations[i];
      this._allObsMarker.show();
      return;
    }
    this._allObsMarker._observation = null;
    this._allObsMarker.hide();
  };
}


if (typeof iNaturalist === 'undefined') this.iNaturalist = {};

if (typeof iNaturalist.Map === 'undefined') this.iNaturalist.Map = {};

// static functions
iNaturalist.Map.createMap = function(options) {
  options = $.extend({}, {
    div: 'map',
    center: new google.maps.LatLng(options.lat || 0, options.lng || 0),
    zoom: 1,
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    controls: 'big',
    observationsTileServer: 'http://localhost:8000'
  }, options);
  
  var map;
  
  if (typeof options.div == 'string') {
    map = new google.maps.Map(document.getElementById(options.div), options);
  }
  else {
    map = new google.maps.Map(options.div, options);
  }
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(new iNaturalist.FullScreenControl(map));
  map._observationsTileServer = options.observationsTileServer;
  
  return map;
};

// The following code should be abstracted out a bit more
iNaturalist.Map.createPlaceIcon = function(options) {
  if (typeof(options) == 'undefined') { var options = {} };
  var iconPath = "/images/mapMarkers/mm_34_stemless_";
  if (typeof(options.color) == 'undefined') {
    iconPath += "DeepPink";
  }
  else {
    iconPath += options.color;
  }
  if (typeof(options.character) != 'undefined') {
    iconPath += ('_' + options.character);
  }
  iconPath += '.png';
  var place = new google.maps.Icon();
  place.image = iconPath;
  place.iconSize = new google.maps.Size(20,20);
  place.iconAnchor = new google.maps.Point(10,10);
  place.infoWindowAnchor = new google.maps.Point(10,0);
  return place;
};

iNaturalist.Map.createObservationIcon = function(options) {
  if (typeof(options) == 'undefined') { var options = {} };
  
  // Choose the right settings for the observation's iconic taxon
  if (options.observation) {
    if (options.observation.iconic_taxon) {
      return iNaturalist.Map.ICONIC_TAXON_ICONS[options.observation.iconic_taxon.name];
    } else {
      return iNaturalist.Map.ICONS['unknown34'];
    };
  };
  
  var iconPath = "/images/mapMarkers/mm_34_";
  if (typeof(options.color) == 'undefined') {
    iconPath += "HotPink";
  }
  else {
    iconPath += options.color;
  }
  if (typeof(options.character) != 'undefined') {
    iconPath += ('_' + options.character);
  }
  iconPath += '.png';
  return iconPath
  // var icon = new google.maps.Icon(G_DEFAULT_ICON);
  // observation.image = iconPath;
  // return observation;
};

// Create a custom TileLayer class that will lookup observations json for 
// each tile
ObservationsTileLayer = function(copyrights, minResolution, maxResolution, options) {
  if (typeof(options) != 'undefined' && typeof(options.tileUrlTemplate) != 'undefined') {
    this.tileUrlTemplate = options.tileUrlTemplate;
  }
  return true;
};
ObservationsTileLayer.prototype = new google.maps.OverlayView();
ObservationsTileLayer.prototype.getTileUrl = function(tilePoint, zoom) {
  var jsonURL = iNaturalist.Map.obsTilePointsURL(tilePoint.x, tilePoint.y, zoom);
  if (typeof(window.tilePoints) == 'undefined') window.tilePoints = {};
  
  // if we already have data for this tile, skip the AJAX
  if (typeof(window.tilePoints[jsonURL]) == 'undefined') {
    $.getJSON(jsonURL, function(data, textStatus) {
      window.tilePoints[jsonURL] = data;
    });
  };
  
  // Return the actual tile URL
  var tileUrl = this.tileUrlTemplate || 'http://localhost:8000/{Z}/{X}/{Y}.png';
  tileUrl = tileUrl.replace('{Z}', zoom).replace('{X}', tilePoint.x).replace('{Y}', tilePoint.y);
  return tileUrl;
}

iNaturalist.Map.obsTilePointsURL = function(x, y, zoom) {
  return '/observations/tile_points/' + zoom + '/' + x + '/' + y + '.json';
}

iNaturalist.FullScreenControl = function(map) {
  var controlDiv = document.createElement('DIV')
  controlDiv.style.padding = '5px';
  var controlUI = $('<div>Full screen</div>').addClass('gmapv3control')
  controlDiv.appendChild(controlUI.get(0))
  
  controlUI.toggle(function() {
    $(this).html('Exit Full screen')
    $(map.getDiv()).addClass('fullscreen')
    google.maps.event.trigger(map, 'resize')
  }, function() {
    $(this).html('Full screen')
    $(map.getDiv()).removeClass('fullscreen')
    google.maps.event.trigger(map, 'resize')
  })
  return controlDiv;
}

// Static constants
iNaturalist.Map.ICONS = {
  DodgerBlue34: new google.maps.MarkerImage("/images/mapMarkers/mm_34_DodgerBlue.png"),
  DeepPink34: new google.maps.MarkerImage("/images/mapMarkers/mm_34_DeepPink.png"),
  iNatGreen34: new google.maps.MarkerImage("/images/mapMarkers/mm_34_iNatGreen.png"),
  OrangeRed34: new google.maps.MarkerImage("/images/mapMarkers/mm_34_OrangeRed.png"),
  DarkMagenta34: new google.maps.MarkerImage("/images/mapMarkers/mm_34_DarkMagenta.png"),
  unknown34: new google.maps.MarkerImage("/images/mapMarkers/mm_34_unknown.png")
};

iNaturalist.Map.ICONIC_TAXON_ICONS = {
  Protozoa: iNaturalist.Map.ICONS.DarkMagenta34,
  Animalia: iNaturalist.Map.ICONS.DodgerBlue34,
  Plantae: iNaturalist.Map.ICONS.iNatGreen34,
  Fungi: iNaturalist.Map.ICONS.DeepPink34,
  Amphibia: iNaturalist.Map.ICONS.DodgerBlue34,
  Reptilia: iNaturalist.Map.ICONS.DodgerBlue34,
  Aves: iNaturalist.Map.ICONS.DodgerBlue34,
  Mammalia: iNaturalist.Map.ICONS.DodgerBlue34,
  Actinopterygii: iNaturalist.Map.ICONS.DodgerBlue34,
  Mollusca: iNaturalist.Map.ICONS.OrangeRed34,
  Insecta: iNaturalist.Map.ICONS.OrangeRed34,
  Arachnida: iNaturalist.Map.ICONS.OrangeRed34
};

iNaturalist.Map.ICONIC_TAXON_COLORS = {
  Protozoa: '#8B008B', // 'DarkMagenta',
  Animalia: '#1E90FF', //'DodgerBlue',
  Plantae: '#73AC13',
  Fungi: '#FF1493', // 'DeepPink',
  Amphibia: '#1E90FF',
  Reptilia: '#1E90FF',
  Aves: '#1E90FF',
  Mammalia: '#1E90FF',
  Actinopterygii: '#1E90FF',
  Mollusca: '#FF4500', //'OrangeRed',
  Insecta: '#FF4500',
  Arachnida: '#FF4500'
}

})();
