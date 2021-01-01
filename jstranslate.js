const fs = require('fs');
const babel = require("@babel/core");

var fileCache = {};

module.exports = function(basepath) {
    return function(req, res, next) {
        const match = req.path.match(/(\/[A-Za-z0-9_-]+)\.js$/);
        if (!match) {
            next();
            return;
        }
        const fileSpecs = [
            [basepath + match[1] + ".jsx", ["@babel/preset-react", "@babel/preset-env"]],
            [basepath + match[1] + ".js", ["@babel/preset-env"]],
        ];
        var spec = null;
        var lastModified = null;
        fileSpecs.some(function(candidate) {
            try {
                var stat = fs.statSync(candidate[0]);
                spec = candidate;
                lastModified = stat.mtime.getTime();
                return true;
            } catch(err) {
                return false;
            }
        });
        if (!spec) {
            next();
            return;
        }
        const cacheKey = spec[0] + "?" + lastModified;
        if (fileCache[cacheKey]) {
            res.setHeader('content-type', 'text/javascript');
            res.send(fileCache[cacheKey]);
            return;
        }

        fs.promises.readFile(spec[0])
        .then(function(data) {
            return babel.transformAsync(data, {
                filename: spec[0],
                presets: spec[1],
                minified: true,
                comments: false,
                compact: true,
            });
        }).then(function(result) {
            res.setHeader('content-type', 'text/javascript');
            res.send(result.code);
            fileCache[cacheKey] = result.code;
        }).catch(function(err) {
            console.log(err);
            next();
        });
    };
}
