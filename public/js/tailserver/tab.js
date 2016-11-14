
var Tab = function(title, longTitle, text, onCloseCallback) {
    var id = Math.floor(Math.random() * 1000000000000000);
    var html = {};
    var autoScroll = true;
    var lastScrollPos = 0;
    var temporaryContent = [];
    var isClearing = false;
    var closeButton;
    var managedStyle = false;
    var tab = this;

    Tab.prototype.tabs.push(this);

    this.appendText = appendText;
    this.appendElements = appendElements;
    this.close = close;
    this.resize = resize;
    this.repositionCloseButton = repositionCloseButton;
    this.reapplyStyles = reapplyStyles;
    this.setManagedStyle = setManagedStyle;
    this.isActive = isActive;

    render(this);
    appendText(text, true);

    setInterval(clearOldContent, 5000);

    function render() {
        var tabTitleId = 'a-tab-file-' + id;
        var tabContentId = 'div-tab-content-file-' + id;

        html.a = $('<a id="' + tabTitleId +  '" href="#' + tabContentId + '" data-toggle="tab">' + title + '</a>');
        html.title = $('<li id="li-title-' + id + '" tabid="' + id + '"></li>');
        html.title.append(html.a);
        html.content = $('<div class="tab-pane file-content-div" id="' + tabContentId + '"></div>');

        $('#ul-tabs').append(html.title);
        $('#div-tabs-content').append(html.content);

        renderCloseButton();

        html.title.tooltip({
            placement: 'top',
            trigger: 'hover',
            title: longTitle
        });

        $('#div-file-content-area').show();
        html.a.tab('show');

        resize();
        addScrollEvent();
    }

    function renderCloseButton() {
        closeButton = $('<div id="div-btn-close-' + id + '" class="tab-close-btn"></div>');
        $('#div-close-buttons').append(closeButton);

        setTimeout(function() {
            closeButton.offset({ top: html.title[0].offsetTop, left: html.title[0].offsetWidth + html.title[0].offsetLeft - 17 });
        }, 100);

        html.title.hover(function() {
            closeButton.css({ opacity: 0.2 });
        }, function() {
            closeButton.css({ opacity: 0.0 });
        });

        closeButton.mouseenter(function() { $(this).css({ opacity: 0.2 }); });
        closeButton.mouseleave(function() { $(this).css({ opacity: 0.0 }); });
        closeButton.click(function () { close(); });
    }

    function addScrollEvent() {
        html.content.scroll(function() {
            var currentScrollTop = $(this).scrollTop();
            if (autoScroll && currentScrollTop < lastScrollPos) {
                autoScroll = false;
            } else if (!autoScroll) {
                if (currentScrollTop > html.content[0].scrollHeight - html.content.height() - 20)
                    autoScroll = true;
            }
            lastScrollPos = currentScrollTop;
        });
    }

    function resize() {
        var height = $(document).height() - html.content.offset().top - 20;
        html.content.css({ height: height + 'px' });
    }

    function close() {
        Tab.prototype.tabs.splice(Tab.prototype.tabs.indexOf(tab), 1);
        html.title.tooltip('destroy');
        closeButton.hide();
        html.title.css('background-color', '#FCC');
        html.content.css('background-color', '#CCC');
        if (onCloseCallback)
            onCloseCallback();
        setTimeout(function() {
            html.title.remove();
            html.content.remove();
            closeButton.remove();
            Tab.prototype.tabs.forEach(function(tab) {
                tab.repositionCloseButton();
            });
        }, 200);
    }

    function repositionCloseButton() {
        html.a.tab('show');
        setTimeout(function() {
            closeButton.offset({
                top: html.title[0].offsetTop,
                left: html.title[0].offsetWidth + html.title[0].offsetLeft - 17
            });
        }, 100);
    }

    function appendText(text, isTemporary) {
        if (!isTemporary) {
            var textItems = applyStyles(text);
        } else {
            var textItems = [{ text: text, classes: '' }];
        }

        var elements = [];
        textItems.forEach(function (textItem) {
            var div = $('<div class="pre-style file-content ' + textItem.classes + '" size="' + textItem.text.length + '"></div>');
            div.text(textItem.text);
            elements.push(div);
        });
        appendElements(elements, isTemporary)
    }

    function appendElements(elements, isTemporary) {
        elements.forEach(function (element) {
            html.content.append(element);
            if (isTemporary)
                temporaryContent.push(element);
        });

        if (!isTemporary && temporaryContent.length > 0) {
            temporaryContent.forEach(function(div) {
                div.remove();
            });
            temporaryContent = [];
        }

        if (html.content[0].scrollWidth > 0)
            $('.file-content').css("width", html.content[0].scrollWidth);
        if (autoScroll)
            html.content.scrollTop(html.content[0].scrollHeight);
    }

    function applyStyles(text) {
        if (!Tab.prototype.lineStylers)
            return [{ text: text, classes: '' }];

        var textPieces = [];
        var curText = "";
        var lastStyles = null;
        var lines = text.split('\n');

        if (text.substr(text.length - 1, 1) == '\n')
            lines.splice(lines.length - 1, 1);

        lines.forEach(function(line) {
            var applicableStyles = "";
            Tab.prototype.lineStylers.forEach(function(styler) {
                applicableStyles += styler(line);
            });

            if (lastStyles && applicableStyles == lastStyles) {
                curText += line + '\n';
            } else {
                if (curText != '')
                    textPieces.push({ text: curText, classes: lastStyles });
                curText = line + '\n';
                lastStyles = applicableStyles;
            }
        });

        if (curText.length > 0)
            textPieces.push({ text: curText, classes: lastStyles });

        return textPieces;
    }

    function clearOldContent() {
        if (isClearing)
            return;
        isClearing = true;
        var size = 0;
        $('> div', html.content).each(function() {
            size += parseInt($(this).attr('size'));
        });
        if (size > Tab.prototype.maxContentSize * 1.1) {
            $('> div', html.content).each(function() {
                size -= parseInt($(this).attr('size'));
                $(this).remove();
                if (size < Tab.prototype.maxContentSize)
                    return false;
            });
        }
        isClearing = false;
    }

    function reapplyStyles() {
        if (managedStyle)
            return;
        var data = html.content.children('div').text();
        html.content.empty();
        appendText(data);
    }

    function setManagedStyle() {
        managedStyle = true;
    }

    function isActive() {
        return html.content.hasClass("active");
    }

};

Tab.prototype.tabs = [];
Tab.prototype.lineStylers = [];
Tab.prototype.maxContentSize = 5 * 1000 * 1000;

Tab.prototype.registerStyler = function(styler) {
    Tab.prototype.lineStylers.push(styler);
};

Tab.prototype.reapplyStylesAllTabs = function() {
    var tabs = Tab.prototype.tabs;
    tabs.forEach(function(tab) {
        tab.reapplyStyles();
    });
};

