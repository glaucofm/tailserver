/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/express.d.ts" />
"use strict";
exports.__esModule = true;
var express = require("express");
var router = express.Router();
var fs = require("fs");
var tail = require("../features/tail");
var grep = require("../features/grep");
var files = require("../features/files");
router.get('/', function (req, res, next) {
    fs.readFile('views/index.html', function (error, data) {
        if (error) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.write(error.toString());
        }
        else {
            res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': data.length });
            res.write(data.toString());
        }
        res.end();
    });
});
router.get('/tail', function (req, res, next) {
    tail.tailFile(req.query.filename, parseInt(req.query.position), parseInt(req.query.maxload), function (error, data) {
        if (error) {
            res.end("ERROR: " + error);
        }
        else if (data) {
            res.end(data);
        }
    });
});
router.get('/grep', function (req, res, next) {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked"
    });
    grep.searchFiles(req.query.files, req.query.expression, req.query.id, function (event) {
        if (event.type == grep.GrepEventType.FILE) {
            if (!res.finished) {
                var filename = (event.fileStat.host ? event.fileStat.host + ":" : "") + event.fileStat.filename;
                res.write("data: >>> " + filename + " modified at " + event.fileStat.mtime + "\t" + filename + "\n\n");
            }
        }
        else if (event.type == grep.GrepEventType.MATCH) {
            if (!res.finished) {
                var lineIndexStr = "       ".substring(0, 7 - (event.lineIndex + "").length) + event.lineIndex;
                res.write("data: " + lineIndexStr + "\t" + event.line + "\n\n");
            }
        }
    }, function (error, status) {
        if (!res.finished) {
            res.write("data: >>> " + (error && error.indexOf("cancelled") == -1 ? error : status) + ".\n\n");
            res.write("data: ---tailserver-command: close---\n\n");
            res.end();
        }
    });
});
router.get('/cancelgrep', function (req, res, next) {
    grep.stop(req.query.id);
});
router.get('/getlines', function (req, res, next) {
    grep.getLines(req.query.filename, parseInt(req.query.linestart), parseInt(req.query.lineend), function (error, lines) {
        if (error) {
            res.end("ERROR: " + error);
        }
        else {
            res.end(lines);
        }
    });
});
router.get('/listFiles', function (req, res, next) {
    files.getFilesStatsByBasename(req.query.filename, function (error, fileStats) {
        if (error) {
            res.end("ERROR: " + error);
        }
        else if (fileStats) {
            var filesInfo = [];
            for (var _i = 0, fileStats_1 = fileStats; _i < fileStats_1.length; _i++) {
                var fileStat = fileStats_1[_i];
                filesInfo.push({
                    name: (fileStat.host ? fileStat.host + ':' : '') + fileStat.filename,
                    modifiedDate: fileStat.mtime,
                    size: fileStat.size
                });
            }
            res.end(JSON.stringify(filesInfo));
        }
    });
});
router.get('/downloadFile', function (req, res, next) {
    files.getFileContents(req.query.filename, function (error, readStream) {
        if (error) {
            res.end("ERROR: " + error);
        }
        else {
            res.writeHead(200, {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": 'attachment; filename="' + req.query.filename.replace(/\.gz$/, "") + '"'
            });
            readStream.pipe(res);
        }
    });
});
module.exports = router;
//# sourceMappingURL=index.js.map