const fontmachine = require('fontmachine'),
  fs = require('fs-extra'),
  util = require('util'),
  zlib = require('zlib');

console.log('Converting fonts...');
fs.readdir('glyphs/_ttf', function(err, files) {
  files.forEach(function(fileName) {
    if (!fileName.endsWith('.ttf')) return;
    fs.readFile('glyphs/_ttf/' + fileName, function(err, fontBuffer) {
      fontmachine.makeGlyphs({
        font: fontBuffer,
        filetype: '.ttf'
      }, function(err, font) {
        if (err) throw err;
        console.log(' - ' + font.name);
        var fontDir = 'glyphs/' + font.name;
        fs.mkdir(fontDir, function(err) {
          if (err && err.code != 'EEXIST') throw err;
          fs.emptyDir(fontDir, function(err) {
            if (err) throw err;
            font.stack.forEach(function(pbf) {
              var pbfPath = fontDir + '/' + pbf.name;
              zlib.gunzip(pbf.data, function(err, res) {
                if (err) throw err;
                fs.writeFile(pbfPath, res, function(err) {
                  if (err) throw err;
                });
              });
            });
          });
        });
      });
    });
  });
});
