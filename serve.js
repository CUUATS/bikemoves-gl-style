var clone = require('clone'),
  express = require('express'),
  tilelive = require('tilelive'),
  mbtiles = require('mbtiles').registerProtocols(tilelive);

/**
 * Serve vector tiles and Mapbox GL styles.
 *
 * Based on tileserver-gl by Klokan Technologies GmbH.
 * https://github.com/klokantech/tileserver-gl
 */

const DATA_DIR = '/var/data',
  GLYPHS_DIR = __dirname + '/glyphs',
  GLYPHS_OPTIONS = {
    maxAge: '10 days'
  },
  SPRITES_DIR = __dirname + '/sprites',
  SPRITES_OPTIONS = {
    maxAge: '1 day'
  },
  STYLES_DIR = __dirname + '/styles',
  STYLES_OPTIONS = {
    maxAge: '1 day'
  },
  TILE_PATTERN = '/tiles/:id/:z(\\d+)/:x(\\d+)/:y(\\d+).:format([\\w]+)',
  TILEJSON_PATTERN = '/tiles/:id.json',
  TILE_DOMAINS = [
    'a.tileserver.bikemoves.me',
    'b.tileserver.bikemoves.me',
    'c.tileserver.bikemoves.me',
    'd.tileserver.bikemoves.me'
  ],
  ONE_DAY = 'max-age=86400';

var app = express(),
  tilestores = {},
  metadata = {};

tilelive.list(DATA_DIR, function(err, uris) {
  if (err) throw 'Error reading tilestores: ' + err;
  Object.keys(uris).forEach(function(id) {
    var uri = uris[id];
    tilelive.info(uri, function(err, meta, store) {
      if (err) return console.log(
        'Error loading tilestore ' + uri + ' :' + err);

      tilestores[id] = store;
      metadata[id] = meta;

      console.log('Loaded tilestore ' + meta.basename);
    });
  });
});

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.use('/glyphs', express.static(GLYPHS_DIR, GLYPHS_OPTIONS));
app.use('/sprites', express.static(SPRITES_DIR, SPRITES_OPTIONS));
app.use('/styles', express.static(STYLES_DIR, STYLES_OPTIONS));
app.get(TILE_PATTERN, function(req, res, next) {
  var id = req.params.id,
    format = req.params.format,
    z = parseInt(req.params.z),
    x = parseInt(req.params.x),
    y = parseInt(req.params.y);

  if (!id || !tilestores.hasOwnProperty(id))
    return res.status(404).send('Invalid tileset');

  var meta = metadata[id],
    store = tilestores[id];

  if (format != meta.format) return res.status(404).send('Invalid format');

  if (z < meta.minzoom || z > meta.maxzoom || x < 0 || y < 0 ||
      x >= Math.pow(2, z) || y >= Math.pow(2, z))
    return res.status(404).send('Coordinates out of bounds');

  store.getTile(z, x, y, function(err, data, headers) {
    if (err) {
      var code = (/does not exist/.test(err.message)) ? 204 : 500;
      return res.status(code).send(err.message);
    }

    if (metadata.format === 'pbf') {
      headers['Content-Type'] = 'application/x-protobuf';
      headers['Content-Encoding'] = 'gzip';
      headers['Cache-Control'] = ONE_DAY;
    }
    delete headers['ETag'];
    res.set(headers);

    return (data === null) ?
      res.status(204).send('No tile data') : res.status(200).send(data);
  });
});

app.get(TILEJSON_PATTERN, function(req, res, next) {
  var id = req.params.id;

  if (!id || !metadata.hasOwnProperty(id))
    return res.status(404).send('Invalid tileset');

  var meta = clone(metadata[id]);
  meta.tiles = [];

  TILE_DOMAINS.forEach(function(domain) {
    meta.tiles.push('https://' + domain + '/tiles/' + meta.id +
      '/{z}/{x}/{y}.' + meta.format);
  });

  res.set('Cache-Control', ONE_DAY);
  return res.status(200).send(meta);
});

app.listen(8080, function () {
  console.log('Listening on port 8080');
});
