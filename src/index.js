"use strict";

import 'babel-polyfill';
import dagre from 'dagre';
import graphlib from 'graphlib';
import * as joint from 'jointjs';
import _ from 'lodash';
import $ from 'jquery';
import Backbone from 'backbone';
import { Vector3vl } from '3vl';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/themes/base/all.css';
import * as cells from './cells.js';
import { HeadlessCircuit, getCellType } from './circuit.js';
import { MonitorView, Monitor } from './monitor.js';
import './style.css';

export { HeadlessCircuit, getCellType, MonitorView, Monitor };

export class Circuit extends HeadlessCircuit {
    constructor(data, windowCallback) {
        super(data);
        this._windowCallback = windowCallback || this._defaultWindowCallback;
        this._interval_ms = 10;
        this._interval = null;
        this._idle = null;
    }
    start() {
        this._interval = setInterval(() => {
            this.updateGates();
        }, this._interval_ms);
        this.trigger('changeRunning');
    }
    startFast() {
        this._idle = requestIdleCallback((dd) => {
            while (dd.timeRemaining() > 0 && this.hasPendingEvents && this._idle !== null)
                this.updateGatesNext();
            if (this._idle !== null) {
                if (!this.hasPendingEvents) {
                    this._idle = null;
                    this.trigger('changeRunning');
                } else this.startFast();
            }
        }, {timeout: 20});
        this.trigger('changeRunning');
    }
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        if (this._idle) {
            cancelIdleCallback(this._idle);
            this._idle = null;
        }
        this.trigger('changeRunning');
    }
    get interval() {
        return this._interval_ms;
    }
    set interval(ms) {
        console.assert(ms > 0);
        this._interval_ms = ms;
    }
    get running() {
        return this._interval !== null || this._idle !== null;
    }
    shutdown() {
        super.shutdown();
        this.stop();
    }
    _defaultWindowCallback(type, div, closingCallback) {
        div.dialog({
            width: 'auto',
            height: 'auto',
            maxWidth: $(window).width() * 0.9,
            maxHeight: $(window).height() * 0.9,
            resizable: type === "Subcircuit",
            close: closingCallback
        });
    }
    displayOn(elem) {
        return this.makePaper(elem, this._graph);
    }
    makePaper(elem, graph, opts) {
        const circuit = this;
        opts = opts || {};
        const paper = new joint.dia.Paper({
            async: true,
            el: elem,
            model: graph,
            width: 100, height: 100, gridSize: 5,
            snapLinks: true,
            linkPinning: false,
            defaultLink: new cells.Wire,
            cellViewNamespace: cells,
            validateConnection: function(vs, ms, vt, mt, e, vl) {
                if (e === 'target') {
                    if (!mt) return false;
                    const pt = vt.model.ports[mt.getAttribute('port')];
                    if (typeof pt !== 'object' || pt.dir !== 'in' || pt.bits !== vl.model.get('bits'))
                        return false;
                    const link = this.model.getConnectedLinks(vt.model).find((l) =>
                        l.id !== vl.model.id &&
                        l.get('target').id === vt.model.id &&
                        l.get('target').port === mt.getAttribute('port')
                    );
                    return !link;
                } else if (e === 'source') { 
                    const ps = vs.model.ports[ms.getAttribute('port')];
                    if (typeof ps !== 'object' || ps.dir !== 'out' || ps.bits !== vl.model.get('bits'))
                        return false;
                    return true;
                }
            }
        });
        paper.$el.addClass('djs');
        paper.freeze();
        // required for the paper to visualize the graph (jointjs bug?)
        graph.resetCells(graph.getCells());
        // lazy graph layout
        if (!graph.get('laid_out')) {
            joint.layout.DirectedGraph.layout(graph, {
                nodeSep: 20,
                edgeSep: 0,
                rankSep: 110,
                rankDir: "LR",
                dagre: dagre,
                graphlib: graphlib
            });
            graph.set('laid_out', true);
        }
        this.listenTo(paper, 'render:done', function() {
            paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
        });
        paper.unfreeze();
        // subcircuit display
        this.listenTo(paper, 'open:subcircuit', function(model) {
            const div = $('<div>', { 
                title: model.get('celltype') + ' ' + model.get('label')
            }).appendTo('html > body');
            const pdiv = $('<div>').appendTo(div);
            const graph = model.get('graph');
            const paper = this.makePaper(pdiv, graph);
            paper.once('render:done', function() {
                circuit._windowCallback('Subcircuit', div, () => {
                    paper.remove();
                    div.remove();
                });
            });
        });
        this.listenTo(paper, 'open:memorycontent', function(div, closeCallback) {
            circuit._windowCallback('Memory', div, closeCallback);
        });
        paper.fixed = function(fixed) {
            this.setInteractivity(!fixed);
            this.$el.toggleClass('fixed', fixed);
        };
        this.trigger('new:paper', paper);
        return paper;
    }
};

