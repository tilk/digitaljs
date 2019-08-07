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
    constructor(data) {
        super(data);
        this._interval_ms = 10;
        this._interval = null;
    }
    start() {
        this._interval = setInterval(() => {
            this.updateGates();
        }, this._interval_ms);
    }
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }
    get interval() {
        return this._interval_ms;
    }
    set interval(ms) {
        console.assert(ms > 0);
        this._interval_ms = ms;
    }
    get running() {
        return Boolean(this._interval);
    }
    shutdown() {
        super.shutdown();
        this.stop();
    }
    displayOn(elem) {
        return this.makePaper(elem, this._graph);
    }
    makePaper(elem, graph, opts) {
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
        paper.unfreeze({
            progress(done, processed, total) {
                if (done) {
                    paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
                    if (opts.onDone) opts.onDone();
                }
            }
        });
        // subcircuit display
        this.listenTo(paper, 'cell:pointerdblclick', function(view, evt) {
            if (!(view.model instanceof cells.Subcircuit)) return;
            const div = $('<div>', { 
                title: view.model.get('celltype') + ' ' + view.model.get('label') 
            }).appendTo('html > body');
            const pdiv = $('<div>').appendTo(div);
            const graph = view.model.get('graph');
            var didResize = false;
            const paper = this.makePaper(pdiv, graph, {
                onDone() {
                    if (didResize) return;
                    didResize = true;
                    const maxWidth = $(window).width() * 0.9;
                    const maxHeight = $(window).height() * 0.9;
                    div.dialog({ width: Math.min(maxWidth, pdiv.outerWidth() + 60), height: Math.min(maxHeight, pdiv.outerHeight() + 60) });
                    div.on('dialogclose', function(evt) {
                        paper.remove();
                        div.remove();
                    });
                }
            });
        });
        this.trigger('new:paper', paper);
        return paper;
    }
};

