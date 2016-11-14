
var Grep = function(filenames, expression) {
    var tab = new Tab(expression, "Searching " + expression, "Searching...");
    tab.setManagedStyle();
    var id = Math.floor(Math.random() * 1000000000000000);
    var filenames = getActualFileNames(filenames);
    var regexp = new RegExp('(' + expression + ')', 'i');
    var foundInFiles = [];
    var lastFileFoundIdx = -1;

    this.cancel = cancel;
    this.isActiveTab = isActiveTab;

    init();

    function init() {
        log('Searching ' + filenames + ' for expression ' + expression);

        var eventSource = new EventSource('grep?files=' + filenames.join("%2B") + '&expression=' + expression + '&id=' + id);

        eventSource.addEventListener('message', function(event) {
            if (event.data == '---tailserver-command: close---') {
                eventSource.close();
            } else {
                appendToTab(event.data + '\n');
            }
        }, false);

        eventSource.addEventListener('error', function(event) {
            if (event.readyState == EventSource.CLOSED) {
                appendToTab(event.data + '\n');
            }
        }, false);
    }

    function getActualFileNames(filenames) {
        return filenames.map(getActualFileName);
    }

    function getActualFileName(filename) {
        var m = new RegExp("\{(date):(.*)\}").exec(filename);
        if (m && m[1] == 'date')
            filename = filename.replace(m[0], moment().format(m[2]));
        return filename;
    }

    function cancel() {
        $.ajax({
            url : '/cancelgrep?id=' + id,
            type : 'get',
            success : function(data) { }
        });
    }

    function isActiveTab() {
        return tab.isActive();
    }

    function appendToTab(lines) {
        if (lines.endsWith("\n")) {
            lines = lines.split('\n');
            lines.pop();
        } else {
            lines = lines.split('\n');
        }
        var divs = [];
        var numberedLineRegexp = /^([ 0-9]{7})(\t.*)$/;
        var filenameRegexp = /^(>>> .*)\t(.+)$/;

        lines.forEach(function(line) {
            var match = numberedLineRegexp.exec(line);
            if (match) {
                var lineNumber = match[1];
                var lineText = match[2];
                var lineDiv = $(
                    '<div class="pre-style search-match" ' +
                    '     fileidx="' + lastFileFoundIdx + '" ' +
                    '     lineidx="' + lineNumber.trim() + '">' +
                    '   <span class="search-match-line-idx">' + lineNumber + '</span>' +
                        replaceTags(lineText).replace(regexp, '<span class="highlight-a5">$1</span>') +
                    '</div>');
                lineDiv.click(searchMatchClick);
                divs.push(lineDiv);
            } else {
                var match = filenameRegexp.exec(line);
                if (match) {
                    line = match[1];
                    lastFileFoundIdx++;
                }
                var lineDiv = $('<div class="pre-style search-match">' + line + '</div>');
                divs.push(lineDiv);
                if (match)
                    foundInFiles.push({ filename: match[2], lineDiv: lineDiv, fileIdx: lastFileFoundIdx });
            }
        });

        tab.appendElements(divs);
    }

    var tagsToReplace = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    };

    function replaceTag(tag) {
        return tagsToReplace[tag] || tag;
    }

    function replaceTags(str) {
        return str.replace(/[&<>]/g, replaceTag);
    }

    function searchMatchClick() {
        var lineIdx = Number($(this).attr('lineidx'));
        var fileIdx = Number($(this).attr('fileidx'));
        $(this).addClass('search-line-clicked');
        getLines(foundInFiles[fileIdx], lineIdx, lineIdx - 25, lineIdx + 25);
    }

    function getLines(foundInFile, lineIdx, lineStart, lineEnd) {
        $.ajax({
            url : '/getlines?filename=' + foundInFile.filename + '&linestart=' + lineStart + '&lineend=' + lineEnd,
            type : 'get',
            success : function(data) {
                removePreviousSearchHighlight();
                addLinesToSearch(data, foundInFile, lineIdx);
            },
            error : function(data) {
                console.log('No data received for file ' + foundInFile.filename);
            }
        });
    }

    function removePreviousSearchHighlight() {
        $('div.search-line-clicked').removeClass('search-line-clicked');
        $('div.additional-search').addClass('additional-search-old');
        $('div.additional-search').removeClass('additional-search');
    }

    function addLinesToSearch(text, foundInFile, clickedLineIdx) {
        var lines = text.split('\n');
        if (text.substr(text.length - 1, 1) == '\n')
            lines.splice(lines.length - 1, 1);

        var index = 0;
        var scrollHeight = 0;
        var previousExistingLine = foundInFile.lineDiv;
        var existingLine = foundInFile.lineDiv.next();

        while (index < lines.length) {
            var lineIdx = existingLine.attr('lineidx');
            lineIdx = lineIdx? lineIdx : 999999999;
            var lineToInsertIndex = Number(lines[index].substr(0, 7).trim());
            if (lineToInsertIndex == lineIdx) {
                previousExistingLine = existingLine;
                existingLine = existingLine.next();
                index++;
            } else if  (lineToInsertIndex < lineIdx) {
                var lineToInsertDiv = $(
                    '<div class="pre-style search-match additional-search" ' +
                    '     fileidx="' + foundInFile.fileIdx + '" ' +
                    '     lineidx="' + lineToInsertIndex + '">' +
                    '   <span class="search-match-line-idx">' + lines[index].substr(0, 7) + '</span>' +
                        replaceTags(lines[index].substr(7)) +
                    '</div>');
                previousExistingLine.after(lineToInsertDiv);
                lineToInsertDiv.click(searchMatchClick);
                if (lineToInsertIndex < clickedLineIdx)
                    scrollHeight += lineToInsertDiv.height();
                previousExistingLine = lineToInsertDiv;
                index++;
            } else {
                previousExistingLine = existingLine;
                existingLine = existingLine.next();
            }
        }
        tab.html.content.scrollTop(tab.html.content.scrollTop() + scrollHeight);
    }

};

