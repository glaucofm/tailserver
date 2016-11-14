/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/express.d.ts" />

import * as express from "express";
import * as core from "express-serve-static-core";
let router: core.Router = express.Router();
import fs = require('fs');

import * as tail from '../features/tail';
import * as grep from '../features/grep';
import * as files from '../features/files';

router.get('/', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    fs.readFile('views/index.html', function (error: NodeJS.ErrnoException, data: Buffer) {
        if (error) {
            res.writeHead(500, {'Content-Type': 'text/html' });
            res.write(error.toString());
        } else {
            res.writeHead(200, {'Content-Type': 'text/html', 'Content-Length': data.length});
            res.write(data.toString());
        }
        res.end();
    });
});

router.get('/tail', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    tail.tailFile(req.query.filename, parseInt(req.query.position), parseInt(req.query.maxload), function(error?:string, data?:string) {
        if (error) {
            res.end("ERROR: " + error)
        } else if (data) {
            res.end(data);
        }
    });
});

router.get('/grep', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    res.writeHead(200, {
        "Content-Type":"text/event-stream",
        "Cache-Control":"no-cache",
        "Connection":"keep-alive",
        "Transfer-Encoding": "chunked"
    });

    grep.searchFiles(req.query.files, req.query.expression, req.query.id, function(event: grep.GrepEvent) {
        if (event.type == grep.GrepEventType.FILE) {
            if (!res.finished) {
                let filename:string = (event.fileStat.host? event.fileStat.host + ":" : "") + event.fileStat.filename;
                res.write("data: >>> " + filename + " modified at " + event.fileStat.mtime + "\t" + filename + "\n\n");
            }
        } else if (event.type == grep.GrepEventType.MATCH) {
            if (!res.finished) {
                let lineIndexStr = "       ".substring(0, 7 - (event.lineIndex + "").length) + event.lineIndex;
                res.write("data: " + lineIndexStr + "\t" + event.line + "\n\n");
            }
        }

    }, function(error: string, status?: string) {
        if (!res.finished) {
            res.write("data: >>> " + (error && error.indexOf("cancelled") == -1 ? error : status) + ".\n\n");
            res.write("data: ---tailserver-command: close---\n\n");
            res.end();
        }
    })
});

router.get('/cancelgrep', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    grep.stop(req.query.id);
});

router.get('/getlines', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    grep.getLines(req.query.filename, parseInt(req.query.linestart), parseInt(req.query.lineend), function(error?: string, lines?: string) {
        if (error) {
            res.end("ERROR: " + error)
        } else {
            res.end(lines);
        }
    });
});

router.get('/listFiles', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    files.getFilesStatsByBasename(req.query.filename, function(error: string, fileStats?: files.FileStat[]) {
        if (error) {
            res.end("ERROR: " + error)
        } else if (fileStats) {
            var filesInfo = [];
            for (var fileStat of fileStats) {
                filesInfo.push({
                    name: (fileStat.host? fileStat.host + ':' : '') + fileStat.filename,
                    modifiedDate: fileStat.mtime,
                    size: fileStat.size
                });
            }
            res.end(JSON.stringify(filesInfo));
        }
    });
});

router.get('/downloadFile', function (req: core.Request, res: core.Response, next: core.NextFunction) {
    files.getFileContents(req.query.filename, function(error: string, readStream?: NodeJS.ReadableStream) {
        if (error) {
            res.end("ERROR: " + error)
        } else {
            res.writeHead(200, {
                "Content-Type":"application/octet-stream",
                "Content-Disposition": 'attachment; filename="' + req.query.filename.replace(/\.gz$/, "") + '"',
            });
            readStream.pipe(res);
        }
    });
});

module.exports = router;
