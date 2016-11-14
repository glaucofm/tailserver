
var HighLighter = function(onChangeCallback) {

    var styles = [
        'highlight-a1', 'highlight-a2', 'highlight-a3', 'highlight-a4',
        'highlight-a5', 'highlight-a6', 'highlight-a7', 'highlight-a8',
        'highlight-b1', 'highlight-b2', 'highlight-b3',
        'highlight-c1', 'highlight-c2', 'highlight-c3' ];

    var inputText = $('#input-highlight');
    var dropDownMenuHighlights = $('#dd-highlight');
    var dropDownMenuStyles = $('#dd-highlight-styles');
    var spanSelectedStyle = $('#span-highlight-styles');
    var highLights = [];

    this.applyHighLights = applyHighLights;

    if (!localStorage.getItem("highlight"))
        saveCurrentStyle(styles[0]);
    if (!localStorage.getItem("highlights"))
        saveHighLights();

    render();

    function saveCurrentStyle(style) {
        localStorage.setItem("highlight", style);
    }

    function loadCurrentStyle() {
        return localStorage.getItem("highlight");
    }

    function render() {
        styles.forEach(function(style) {
            var span = $('<span highlightid="' + style + '">Highlight</span>');
            var li = $('<li id="li-highlight-style" style="padding: 2px 10px;" class="' + style + '"></li>');
            li.append(span);
            dropDownMenuStyles.append(li);
            span.click(selectStyle);
        });
        spanSelectedStyle.addClass(loadCurrentStyle());
        spanSelectedStyle.attr('highlightid', loadCurrentStyle());
        createEvents();
        loadHighLights();
    }

    function createEvents() {
        inputText.keypress(function() {
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if (keycode == '13') {
                addHighlight(spanSelectedStyle.attr('highlightid'), inputText.val());
                inputText.val('');
            }
        });
        inputText.mouseenter(showHighLightsMenu);
        inputText.mouseleave(hideHighLightsMenu);
        dropDownMenuHighlights.mouseenter(showHighLightsMenu);
        dropDownMenuHighlights.mouseleave(hideHighLightsMenu);
        dropDownMenuStyles.mouseenter(showStylesMenu);
        dropDownMenuStyles.mouseleave(hideStylesMenu);
        spanSelectedStyle.mouseenter(showStylesMenu);
        spanSelectedStyle.mouseleave(hideStylesMenu);
    }

    function selectStyle() {
        var oldStyle = spanSelectedStyle.attr('highlightid');
        var newStyle = $(this).attr('highlightid');
        spanSelectedStyle.removeClass(oldStyle);
        spanSelectedStyle.addClass(newStyle);
        spanSelectedStyle.attr('highlightid', newStyle);
        saveCurrentStyle(newStyle);
    }

    function addHighlight(style, expression) {
        var highLight = new HighLight(style, expression, true, { onChange: onChange , onRemove: removeHighLight });
        highLights.push(highLight);
        dropDownMenuHighlights.append(highLight.getElement());
        dropDownMenuHighlights.show();
        dropDownMenuHighlights.attr('timeout', setTimeout(function() {
            dropDownMenuHighlights.hide();
        }, 2000));
        onChange();
    }

    function removeHighLight(highLight) {
        highLights.splice(highLights.indexOf(highLight), 1);
        onChange();
    }

    function showHighLightsMenu() {
        dropDownMenuHighlights.show();
        if (dropDownMenuHighlights.attr('timeout')) {
            clearTimeout(dropDownMenuHighlights.attr('timeout'));
            dropDownMenuHighlights.removeAttr('timeout');
        }
    }

    function hideHighLightsMenu() {
        dropDownMenuHighlights.attr('timeout', setTimeout(function() {
            dropDownMenuHighlights.hide();
        }, 500));
    }

    function showStylesMenu() {
        dropDownMenuStyles.show();
        if (dropDownMenuStyles.attr('timeout')) {
            clearTimeout(dropDownMenuStyles.attr('timeout'));
            dropDownMenuStyles.removeAttr('timeout');
        }
    }

    function hideStylesMenu() {
        dropDownMenuStyles.attr('timeout', setTimeout(function() {
            dropDownMenuStyles.hide();
        }, 500));
    }

    function applyHighLights(line) {
        styles = [];
        highLights.forEach(function(highLight) {
            if (highLight.regexp.test(line))
                styles.push(highLight.getStyle());
        });
        return styles.join(' ');
    }

    function onChange() {
        saveHighLights();
        if (onChangeCallback)
            onChangeCallback();
    }

    function saveHighLights() {
        var highLightsToSave = [];
        highLights.forEach(function(highLight) {
            highLightsToSave.push({ expression: highLight.getExpression(), style: highLight.getStyle(), active: highLight.isActive() });
        });
        localStorage.setItem("highlights", JSON.stringify(highLightsToSave));
    }

    function loadHighLights() {
        highLights = [];
        var loadedHighLights = jQuery.parseJSON(localStorage.getItem("highlights"));
        if (loadedHighLights) {
            loadedHighLights.forEach(function(highLight) {
                var highLight = new HighLight(highLight.style, highLight.expression, highLight.active, { onChange: onChange , onRemove: removeHighLight });
                dropDownMenuHighlights.append(highLight.getElement());
                highLights.push(highLight);
            });
        }
    }
};

var HighLight = function(style, expression, active, callbacks) {
    this.regexp = new RegExp(expression, 'i');
    var mainLi;
    var spanExpression;
    var highLight = this;

    render();

    this.getElement = function()    { return mainLi };
    this.getStyle = function()      { return style };
    this.getExpression = function() { return expression };
    this.isActive = function()      { return active };

    function render() {
        mainLi = $('<li highlightid="' + style + '" style="padding: 2px 10px; min-width: 100px"></li>');
        spanExpression = $('<span highlightid="' + style + '" class="' + style + '" style="min-width: 20em">' + expression + '</span>&nbsp;');
        var buttonRemove = $('<button highlightid="' + style + '" type="button" class="btn btn-li-remove" title="Remove"></button>');
        var buttonActive = $('<input highlightid="' + style + '" type="checkbox" class="menu-checkbox right" title="Enabled/Disabled"/>');
        mainLi.append(spanExpression);
        mainLi.append(buttonRemove);
        mainLi.append(buttonActive);
        buttonActive.prop('checked', active);
        buttonActive.change(toggleActive);
        buttonRemove.click(destroy);
    }

    function toggleActive() {
        active = $(this).prop('checked');
        if (!active)
            spanExpression.addClass('text-disabled');
        else
            spanExpression.removeClass('text-disabled');
        callbacks.onChange();
    }

    function destroy() {
        mainLi.remove();
        callbacks.onRemove(highLight);
    }
};
