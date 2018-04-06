/**
 * @fileoverview DayGrid in weekly view
 * @author NHN Ent. FE Development Team <dl_javascript@nhnent.com>
 */
'use strict';

var util = require('tui-code-snippet');
var config = require('../../config'),
    datetime = require('../../common/datetime'),
    domutil = require('../../common/domutil'),
    TZDate = require('../../common/timezone').Date,
    View = require('../../view/view'),
    DayGridSchedule = require('./dayGridSchedule'),
    baseTmpl = require('../template/week/dayGrid.hbs'),
    reqAnimFrame = require('../../common/reqAnimFrame');
var mmax = Math.max,
    mmin = Math.min;

/**
 * @constructor
 * @extends {Weekday}
 * @param {string} name - view name
 * @param {object} options - options for DayGridSchedule view
 * @param {number} [options.heightPercent] - height percent of view
 * @param {number} [options.containerButtonGutter=8] - free space at bottom to
 *  make create easy.
 * @param {number} [options.scheduleHeight=18] - height of each schedule block.
 * @param {number} [options.scheduleGutter=2] - gutter height of each schedule block.
 * @param {HTMLDIVElement} container - DOM element to use container for this
 *  view.
 */
function DayGrid(name, options, container) {
    container = domutil.appendHTMLElement(
        'div',
        container,
        config.classname('daygrid-layout')
    );
    View.call(this, container);

    name = name || 'daygrid';

    this.options = util.extend({
        viewName: name,
        daynames: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        renderStartDate: '',
        renderEndDate: '',
        containerBottomGutter: 18,
        scheduleHeight: 18,
        scheduleGutter: 2,
        scheduleContainerTop: 1,
        getViewModelFunc: function(viewModel) {
            return viewModel.schedulesInDateRange[name];
        },
        setViewModelFunc: function(viewModel, matrices) {
            viewModel.schedulesInDateRange[name] = matrices;
        }
    }, options);

    this.handler = {};
    this.vPanel = null;

    this.setState({
        collapsed: true
    });
}

util.inherit(DayGrid, View);

/**
 * @override
 * @param {object} viewModel - schedules view models
 */
DayGrid.prototype.getBaseViewModel = function(viewModel) {
    var opt = this.options,
        daynames = opt.daynames,
        range = viewModel.range,
        grids = viewModel.grids,
        matrices = opt.getViewModelFunc(viewModel),
        exceedDate = {},
        panel = getPanel(opt.panels, opt.viewName),
        panelHeight = this.getViewBound().height,
        collapsed = this.state.collapsed,
        heightForcedSet = this.vPanel ? this.vPanel.getHeightForcedSet() : false;

    var baseViewModel, visibleScheduleCount;

    if (panel.showExpandableButton) {
        if (!heightForcedSet) {
            if (collapsed) {
                panelHeight = mmax(panelHeight, panel.maxHeight);
            } else {
                panelHeight = mmin(panelHeight, panel.maxExpandableHeight);
            }
        }

        visibleScheduleCount = Math.floor(panelHeight / (opt.scheduleHeight + opt.scheduleGutter));
        if (collapsed) {
            exceedDate = this.parent.controller.getExceedDate(visibleScheduleCount,
                matrices,
                viewModel.range
            );
            matrices = this.parent.controller.excludeExceedSchedules(matrices, visibleScheduleCount);
            opt.setViewModelFunc(viewModel, matrices);
        }
    }

    baseViewModel = {
        viewName: opt.viewName,
        range: range,
        grids: grids,
        days: util.map(viewModel.range, function(d, index) {
            var day = d.getDay();
            var ymd = datetime.format(d, 'YYYYMMDD');

            return {
                day: day,
                dayName: daynames[day],
                isToday: datetime.isSameDate(d, new TZDate()),
                date: d.getDate(),
                renderDate: datetime.format(d, 'YYYY-MM-DD'),
                hiddenSchedules: exceedDate[ymd] || 0,
                width: grids[index] ? grids[index].width : 0,
                left: grids[index] ? grids[index].left : 0
            };
        }),
        exceedDate: exceedDate,
        showExpandableButton: panel.showExpandableButton,
        collapsed: collapsed,
        collapseBtnIndex: this.state.clickedExpandBtnIndex
    };

    return baseViewModel;
};

/**
 * @override
 * @param {object} viewModel - schedules view models
 */
DayGrid.prototype.render = function(viewModel) {
    var opt = this.options,
        container = this.container,
        baseViewModel = this.getBaseViewModel(viewModel),
        scheduleContainerTop = this.options.scheduleContainerTop;
    var dayGridSchedule;

    container.innerHTML = baseTmpl(baseViewModel);

    this.children.clear();

    dayGridSchedule = new DayGridSchedule(
        opt,
        domutil.find(config.classname('.container'), container)
    );
    this.addChild(dayGridSchedule);

    dayGridSchedule.on('afterRender', function(weekdayViewModel) {
        baseViewModel.height = weekdayViewModel.minHeight + scheduleContainerTop;
    });

    this.children.each(function(childView) {
        childView.render(viewModel);
    }, this);

    this.fire('afterRender', baseViewModel);
};

DayGrid.prototype._beforeDestroy = function() {
};

DayGrid.prototype.addHandler = function(type, handler, vPanel) {
    var opt = this.options;

    this.handler[type] = handler;
    this.vPanel = vPanel;

    if (type === 'click') {
        handler.on('expand', function() {
            var panel = getPanel(opt.panels, opt.viewName);
            vPanel.setMaxHeight(panel.maxExpandableHeight);
            vPanel.setHeightForcedSet(false);
            vPanel.setHeight(null, panel.maxExpandableHeight);

            this.setState({collapsed: false});
            reqAnimFrame.requestAnimFrame(function() {
                this.parent.render();
            }, this);
        }, this);
        handler.on('collapse', function() {
            var panel = getPanel(opt.panels, opt.viewName);
            vPanel.setMaxHeight(panel.maxHeight);
            vPanel.setHeightForcedSet(false);
            vPanel.setHeight(null, panel.minHeight);

            this.setState({collapsed: true});
            reqAnimFrame.requestAnimFrame(function() {
                this.parent.render();
            }, this);
        }, this);
    }
};

/**
 * get a panel infomation
 * @param {Array.<object[]>} panels - panel infomations
 * @param {string} name - panel name
 * @returns {object} panel information
 */
function getPanel(panels, name) {
    var found;

    util.forEach(panels, function(panel) {
        if (panel.name === name) {
            found = panel;
        }
    });

    return found;
}

module.exports = DayGrid;