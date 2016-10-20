const async = require('async'),
  composite = require('glyph-pbf-composite'),
  fontnik = require('fontnik'),
  fs = require('fs-extra');

/**
 * Write PBFs for (combined) font stacks used in the styles.
 * The resulting PBFs are ready to serve using Apache, nginx, etc.
 *
 * Based on fontmachine by Mapbox.
 * https://github.com/mapbox/fontmachine
 */

var fonts = {},
  stacks = [];

function readFont(fileName, callback) {
  if (!fileName.endsWith('.ttf')) return callback();
  fs.readFile('glyphs/_ttf/' + fileName, function(err, fontBuffer) {
    if (err) return callback(err);
    fontnik.load(fontBuffer, function(err, faces) {
      if (err) return callback(err);
      if (faces.length > 1)
        return done('Mulit-face fonts are not supported.');
      var metadata = faces[0],
        name = metadata.style_name ?
          [metadata.family_name, metadata.style_name].join(' ') :
          metadata.family_name;
      fonts[name] = fontBuffer;
      return callback();
    });
  });
}

function readFonts(callback) {
  fs.readdir('glyphs/_ttf', function(err, files) {
    if (err) return callback(err);
    async.each(files, readFont, callback);
  });
}

function readStyle(fileName, callback) {
  fs.readFile('styles/' + fileName, function(err, styleBuffer) {
    if (err) return callback(err);
    var styleJSON = JSON.parse(styleBuffer);
    styleJSON.layers.forEach(function(layer) {
      if (layer.layout && layer.layout['text-font']) {
        var stackName = layer.layout['text-font'].join(',');
        if (stacks.indexOf(stackName) === -1) stacks.push(stackName);
      }
    });
    return callback();
  });
}

function readStyles(callback) {
  fs.readdir('styles', function(err, files) {
    if (err) return callback(err);
    async.each(files, readStyle, callback);
  });
}

function writeRange(stackName, start, end, callback) {
  var tasks = stackName.split(',').map(function(fontName) {
    return function(done) {
      fontnik.range({
        font: fonts[fontName],
        start: start,
        end: end
      }, done);
    };
  });
  async.parallel(tasks, function(err, results) {
    if (err) return callback(err);
    var name = [start, '-', end, '.pbf'].join(''),
      data = composite.combine(results);
    fs.writeFile('glyphs/' + stackName + '/' + name, data, callback);
  });
}

function writeStack(stackName, callback) {
  fs.mkdir('glyphs/' + stackName, function(err) {
    if (err && err.code !== 'EEXIST') return callback(err);
    for (var i = 0; i < 65536; (i = i + 256)) {
      writeRange(stackName, i, Math.min(i + 255, 65535));
    }
  });
}

async.parallel([readFonts, readStyles], function(err) {
  if (err) throw err;
  async.each(stacks, writeStack, function(err) {
    if (err) throw err;
  });
});
