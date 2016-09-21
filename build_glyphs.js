const fontmachine = require('fontmachine'),
  fs = require('fs-extra'),
  util = require('util');

console.log('Reading fonts...');
var fonts = {};
fs.readdir('glyphs/_ttf', function(err, files) {
  var fontCount = 0,
    fontTotal = 0;
  files.forEach(function(fileName) {
    if (fileName.endsWith('.ttf')) fontTotal += 1;
  });
  files.forEach(function(fileName) {
    if (!fileName.endsWith('.ttf')) return;
    fs.readFile('glyphs/_ttf/' + fileName, function(err, fontBuffer) {
      fontmachine.makeGlyphs({
        font: fontBuffer,
        filetype: '.ttf'
      }, function(err, font) {
        if (err) throw err;
        console.log(' - ' + font.name);
        fonts[font.name] = font.stack;
        fontCount += 1;
        if (fontCount == fontTotal) parseStyles();
      });
    });
  });
});

function parseStyles() {
  console.log('Parsing styles...');
  var stacks = [];
  fs.readdir('styles/', function(err, files) {
    if (err) throw err;
    files.forEach(function(fileName) {
      console.log(' - ' + fileName);
      fs.readFile('styles/' + fileName, function(err, styleString) {
        if (err) throw err;
        var style = JSON.parse(styleString);
        style.layers.forEach(function(layer) {
          if (!layer.layout) return;
          var stack = layer.layout['text-font'];
          if (!stack) return;
          var stackName = stack.join(','),
            stackDir = 'glyphs/' + stackName;
          if (stacks.indexOf(stackName) !== -1) return;
          stacks.push(stackName);
          fs.mkdir(stackDir, function(err) {
            if (err && err.code != 'EEXIST') throw err;
            fs.emptyDir(stackDir, function(err) {
              if (err) throw err;
              writePBFs(stack, stackName, stackDir);
            });
          });
        });
      });
    });
  });
}

function writePBFs(stack, stackName, stackDir) {
  console.log('Saving glyphs for ' + stackName + '...');
  var pbfNames = [];
  stack.forEach(function(fontName) {
    if (!(fontName in fonts)) throw 'Missing font: ' + fontName;
    var pbfs = fonts[fontName];
    pbfs.forEach(function(pbf) {
      if (pbfNames.indexOf(pbf.name) !== -1) return;
      pbfNames.push(pbf.name);
      var pbfPath = stackDir + '/' + pbf.name;
      fs.writeFile(pbfPath, pbf.data, function(err) {
        if (err) throw err;
      });
    });
  });
}
