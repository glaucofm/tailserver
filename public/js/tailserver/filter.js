
var Filterer = function(onChangeCallback) {
    var inputText = $('#input-filter');
    var dropDownMenuFilters = $('#dd-filter');
    var filters = [];
    this.applyFilters = applyFilters;

    if (!localStorage.getItem("filters"))
        saveFilters();

    render();

    function render() {
        loadFilters();

        inputText.keypress(function (event) {
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if (keycode == '13') {
                addFilter();
            }
        });

        dropDownMenuFilters.mouseenter(showFiltersMenu);
        dropDownMenuFilters.mouseleave(hideFiltersMenu);
        inputText.mouseenter(showFiltersMenu);
        inputText.mouseleave(hideFiltersMenu);
    }

    function addFilter() {
        var filter = new Filter(inputText.val(), Filter.prototype.types.require, true, { onChange: onChange, onRemove: removeFilter });
        filters.push(filter);
        dropDownMenuFilters.append(filter.getMainElement());
        inputText.val('');
        dropDownMenuFilters.show();
        dropDownMenuFilters.attr('timeout', setTimeout(function() {
            dropDownMenuFilters.hide();
        }, 2000));
        onChange();
    }

    function removeFilter(filter) {
        filters.splice(filters.indexOf(filter), 1);
        onChange();
    }

    function showFiltersMenu() {
        dropDownMenuFilters.show();
        if (dropDownMenuFilters.attr('timeout')) {
            clearTimeout(dropDownMenuFilters.attr('timeout'));
            dropDownMenuFilters.removeAttr('timeout');
        }
    }

    function hideFiltersMenu() {
        dropDownMenuFilters.attr('timeout', setTimeout(function() {
            dropDownMenuFilters.hide();
        }, 500));
    }

    function onChange() {
        saveFilters();
        if (onChangeCallback)
            onChangeCallback();
    }

    function saveFilters() {
        var filtersToSave = [];
        filters.forEach(function(filter) {
            filtersToSave.push({ expression: filter.getExpression(), type: filter.getType(), isActive: filter.getActive() });
        });
        localStorage.setItem("filters", JSON.stringify(filtersToSave));
    }

    function loadFilters() {
        filters = [];
        var loadedFilters = jQuery.parseJSON(localStorage.getItem("filters"));
        if (loadedFilters) {
            loadedFilters.forEach(function(filter) {
                var filter = new Filter(filter.expression, filter.type, filter.isActive, { onChange: onChange, onRemove: removeFilter });
                dropDownMenuFilters.append(filter.getMainElement());
                filters.push(filter);
            });
        }
    }

    function applyFilters(line) {
        var styles = [];
        filters.forEach(function(filter) {
            if (filter.getActive())
                if (filter.getType() == Filter.prototype.types.require && !filter.getRegexp().test(line))
                    styles.push(filter.getStyle());
                else if (filter.getType() == Filter.prototype.types.exclude && filter.getRegexp().test(line))
                    styles.push(filter.getStyle());
        });
        return styles.join(' ');
    }
};

var Filter = function(expression, type, isActive, callbacks) {
    var regexp = new RegExp(expression, 'i');
    var style = "FILTER_" + Math.floor(Math.random() * 1000000000000000);
    var mainElement, styleElement, spanExpression, buttonActive, buttonType, buttonRemove;
    var filter = this;

    this.getStyle       = function() { return style };
    this.getMainElement = function() { return mainElement };
    this.getExpression  = function() { return expression };
    this.getType        = function() { return type };
    this.getActive      = function() { return isActive };
    this.getRegexp      = function() { return regexp };

    render();

    function render() {
        mainElement = $('<li style="padding: 2px 10px; min-width: 100px"></li>');
        spanExpression = $('<span>' + expression + '</span>&nbsp;');
        buttonRemove = $('<button type="button" class="btn btn-li-remove" title="Remove"></button>');
        buttonActive = $('<input type="checkbox" class="menu-checkbox right"title="Enabled/Disabled"/>');
        buttonType = $('<input type="checkbox" class="menu-checkbox right toggle" title="Blue: require; yellow: exclude"/>');

        mainElement.append(spanExpression);
        mainElement.append(buttonRemove);
        mainElement.append(buttonActive);
        mainElement.append(buttonType);

        buttonActive.prop('checked', isActive);
        buttonType.prop('checked', type == Filter.prototype.types.require);

        if (!isActive) {
            spanExpression.addClass('text-disabled');
        } else {
            addStyleElement();
        }

        buttonActive.change(toggleActive);
        buttonType.change(toggleType);
        buttonRemove.click(destroy);
    }

    function toggleActive() {
        isActive = buttonActive.prop('checked');
        if (!isActive) {
            styleElement.remove();
            spanExpression.addClass('text-disabled');
        } else  {
            addStyleElement();
            spanExpression.removeClass('text-disabled');
        }
        callbacks.onChange();
    }

    function toggleType() {
        if (buttonType.prop('checked'))
            type = Filter.prototype.types.require;
        else
            type = Filter.prototype.types.exclude;
        callbacks.onChange();
    }

    function destroy() {
        mainElement.remove();
        styleElement.remove();
        callbacks.onRemove(filter);
    }

    function addStyleElement() {
        $('head').append('<style type="text/css" filterid="' + style + '">div.' + style + ' { display: none }</style>');
        styleElement = $('style[filterid=' + style + ']');
    }

};

Filter.prototype.types = { require: "REQUIRE", exclude: "EXCLUDE" };