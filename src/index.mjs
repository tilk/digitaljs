"use strict";

import 'babel-polyfill';
import dagre from 'dagre';
import graphlib from 'graphlib';
import * as joint from 'jointjs';
import _ from 'lodash';
import $ from 'jquery';
import Backbone from 'backbone';
import { Vector3vl } from '3vl';
import 'jquery-ui/ui/widgets/dialog.js';
import 'jquery-ui/themes/base/all.css';
import * as cells from './cells.mjs';
import * as engines from './engines.mjs';
import * as tools from './tools.mjs';
import * as transform from './transform.mjs';
import { HeadlessCircuit, getCellType } from './circuit.mjs';
import { BrowserSynchEngine } from './engines/browsersynch.mjs';
import { MonitorView, Monitor } from './monitor.mjs';
import { IOPanelView } from './iopanel.mjs';
import { elk_layout } from './elkjs.mjs';
import './style.css';

// polyfill ResizeObserver for e.g. Firefox ESR 68.8
// this line and the node-module might be removed as soon as ResizeObserver is widely supported
// see https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver#Browser_compatibility
import ResizeObserver from 'resize-observer-polyfill';

export { HeadlessCircuit, getCellType, cells, tools, engines, transform, MonitorView, Monitor, IOPanelView };

export const paperOptions = {
    async: true,
    sorting: joint.dia.Paper.sorting.APPROX, //needed for async paper, see https://github.com/clientIO/joint/issues/1320
    width: 100, height: 100, gridSize: 5,
    magnetThreshold: 'onleave',
    snapLinks: true,
    linkPinning: false,
    markAvailable: true,
    defaultLink: new cells.Wire,
    defaultConnectionPoint: { name: 'anchor' },
    defaultRouter: {
        name: 'metro',
        args: {
            startDirections: ['right'],
            endDirections: ['left'],
            maximumLoops: 200,
            step: 2.5
        }
    },
    defaultConnector: {
        name: 'rounded',
        args: { radius: 10 }
    },
    cellViewNamespace: cells,
    validateConnection(vs, ms, vt, mt, e, vl) {
        if (e === 'target') {
            if (!mt) return false;
            const pt = vt.model.getPort(vt.findAttribute('port', mt));
            if (typeof pt !== 'object' || pt.dir !== 'in' || pt.bits !== vl.model.get('bits'))
                return false;
            const link = this.model.getConnectedLinks(vt.model).find((l) =>
                l.id !== vl.model.id &&
                l.get('target').id === vt.model.id &&
                l.get('target').port === vt.findAttribute('port', mt)
            );
            return !link;
        } else if (e === 'source') {
            if (!ms) return false;
            const ps = vs.model.getPort(vs.findAttribute('port', ms));
            if (typeof ps !== 'object' || ps.dir !== 'out' || ps.bits !== vl.model.get('bits'))
                return false;
            return true;
        }
    }
};

export class Circuit extends HeadlessCircuit {
    constructor(data, { windowCallback = Circuit.prototype._defaultWindowCallback, layoutEngine = "elkjs", ...options } = {}) {
        if (!options.engine) options.engine = BrowserSynchEngine;
        super(data, options);
        this._layoutEngine = layoutEngine
        this._windowCallback = windowCallback;
        this.listenTo(this._engine, 'changeRunning', () => {
            this.trigger('changeRunning');
        });
    }
    _defaultWindowCallback(type, div, closingCallback) {
        const maxWidth = () => $(window).width() * 0.9;
        const maxHeight = () => $(window).height() * 0.9;
        function fixSize() {
            if (div.width() > maxWidth())
                div.dialog("option", "width", maxWidth());
            if (div.height() > maxHeight())
                div.dialog("option", "height", maxHeight());
        }
        const observer = new ResizeObserver(fixSize);
        observer.observe(div.get(0));
        const shutdownCallback = () => { div.dialog('close'); };
        this.listenToOnce(this, 'shutdown', shutdownCallback);
        const dialog = div.dialog({
            width: 'auto',
            height: 'auto',
            maxWidth: $(window).width() * 0.9,
            maxHeight: $(window).height() * 0.9,
            resizable: type !== "Memory",
            close: () => {
                this.stopListening(this, 'shutdown', shutdownCallback);
                closingCallback();
                observer.disconnect();
            }
        });
    }
    displayOn(elem) {
        return this._makePaper(elem, this._graph);
    }
    _makePaper(elem, graph) {
        this._engine.observeGraph(graph);
        const opts = _.merge({ el: elem, model: graph }, paperOptions);
        const paper = new joint.dia.Paper(opts);
        paper.$el.addClass('djs');
        paper.freeze();
        // required for the paper to visualize the graph (jointjs bug?)
        graph.resetCells(graph.getCells());
        // lazy graph layout
        if (!graph.get('laid_out')) {
            if (this._layoutEngine == "dagre") {
                joint.layout.DirectedGraph.layout(graph, {
                    nodeSep: 20,
                    edgeSep: 0,
                    rankSep: 110,
                    rankDir: "LR",
                    setPosition: (element, position) => {
                        element.setLayoutPosition({
                            x: position.x - position.width/2,
                            y: position.y - position.height/2,
                            width: position.width,
                            height: position.height
                        });
                    },
                    exportElement: (element) => {
                        return element.getLayoutSize();
                    },
                    dagre: dagre,
                    graphlib: graphlib
                });
            } else if (this._layoutEngine == "elkjs") {
                elk_layout(graph);
            }
            graph.set('laid_out', true);
        }
        paper.listenTo(this, 'display:add', () => {
            // a very inefficient way to refresh numbase dropdowns
            // TODO: a better method
            paper.freeze();
            graph.resetCells(graph.getCells());
            paper.unfreeze();
        });
        this.listenTo(paper, 'render:done', () => {
            paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
        });
        paper.unfreeze();
        // subcircuit display
        this.listenTo(paper, 'open:subcircuit', (model) => {
            const div = $('<div>', { 
                title: model.get('disp_celltype') + ' ' + model.get('label')
            }).appendTo('html > body');
            const pdiv = $('<div>').appendTo(div);
            const graph = model.get('graph');
            const paper = this._makePaper(pdiv, graph);
            paper.once('render:done', () => {
                this._windowCallback('Subcircuit', div, () => {
                    this._engine.unobserveGraph(graph);
                    paper.remove();
                    div.remove();
                });
            });
        });
        this.listenTo(paper, 'open:memorycontent', (div, closeCallback) => {
            this._windowCallback('Memory', div, closeCallback);
        });
        this.listenTo(paper, 'open:fsm', (div, closeCallback) => {
            this._windowCallback('FSM', div, closeCallback);
        });
        paper.fixed = function(fixed) {
            this.setInteractivity(!fixed);
            this.$el.toggleClass('fixed', fixed);
        };
        this.trigger('new:paper', paper);
        return paper;
    }
};

