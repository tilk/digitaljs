"use strict";

import 'babel-polyfill';
import joint from 'jointjs';
import _ from 'lodash';
import Backbone from 'backbone';
import { Vector3vl } from '3vl';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/themes/base/all.css';
import '@app/cells.js';
import { HeadlessCircuit, getCellType } from '@app/circuit.js';
import { MonitorView, Monitor } from '@app/monitor.js';
import '@app/style.css';

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
    makePaper(elem, graph) {
        const paper = new joint.dia.Paper({
            el: elem,
            model: graph,
            width: 1000, height: 600, gridSize: 5,
            snapLinks: true,
            linkPinning: false,
            defaultLink: new joint.shapes.digital.Wire,
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
        // required for the paper to visualize the graph (jointjs bug?)
        graph.resetCells(graph.getCells());
        // lazy graph layout
        if (!graph.get('laid_out')) {
            joint.layout.DirectedGraph.layout(graph, {
                nodeSep: 20,
                edgeSep: 0,
                rankSep: 110,
                rankDir: "LR"
            });
            graph.set('laid_out', true);
        }
        paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
        // subcircuit display
        this.listenTo(paper, 'cell:pointerdblclick', function(view, evt) {
            if (!(view.model instanceof joint.shapes.digital.Subcircuit)) return;
            const div = $('<div>', { 
                title: view.model.get('celltype') + ' ' + view.model.get('label') 
            });
            const pdiv = $('<div>');
            div.append(pdiv);
            $('body').append(div);
            const graph = view.model.get('graph');
            const paper = this.makePaper(pdiv, graph);
            const maxWidth = $(window).width() * 0.9;
            const maxHeight = $(window).height() * 0.9;
            div.dialog({ width: Math.min(maxWidth, pdiv.outerWidth() + 60), height: Math.min(maxHeight, pdiv.outerHeight() + 60) });
            div.on('dialogclose', function(evt) {
                paper.remove();
                div.remove();
            });
        });
        this.trigger('new:paper', paper);
        return paper;
    }
};

