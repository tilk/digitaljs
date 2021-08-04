"use strict";

import $ from 'jquery';
import _ from 'lodash';
import * as joint from 'jointjs';
import { Box, BoxView } from './base.mjs';
import * as help from '../help.mjs';
import { Vector3vl, Mem3vl } from '3vl';
import dagre from 'dagre';
import graphlib from 'graphlib';

export const FSM = Box.define('FSM', {
    /* default properties */
    bits: { in: 1, out: 1},
    polarity: { clock: true },
    init_state: 0,
    states: 1,
    trans_table: [],
    
    size: { width: 80, height: 3*16+8 },
    ports: {
        groups: {
            'in': {
                position: Box.prototype._getStackedPosition({ side: 'left' })
            },
            'out': {
                position: Box.prototype._getStackedPosition({ side: 'right' })
            }
        }
    }
}, {
    initialize() {
        const bits = this.get('bits');
        const polarity = this.get('polarity');
        
        const init_state = this.get('init_state');
        const states = this.get('states');
        const trans_table = this.get('trans_table');
        
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits.in, labelled: true },
            { id: 'clk', group: 'in', dir: 'in', bits: 1, polarity: polarity.clock, decor: Box.prototype.decorClock, labelled: true },
            { id: 'arst', group: 'in', dir: 'in', bits: 1, polarity: polarity.arst, labelled: true },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out, labelled: true }
        ];
        
        Box.prototype.initialize.apply(this, arguments);
        
        const current_state = this.get('current_state');
        
        this.fsmgraph = new joint.dia.Graph;
        const statenodes = [];
        for (let n = 0; n < states; n++) {
            const node = new joint.shapes.standard.Circle({stateNo: n, id: 'state' + n, isInit: n == init_state});
            node.attr('label/text', String(n));
            node.resize(100,50);
            if (n == init_state)
                node.attr('body/strokeWidth', 3)
            if (n == current_state)
                node.attr('body/class', 'current_state');
            node.addTo(this.fsmgraph);
            statenodes.push(node);
        }
        for (const [stateIn, trs] of this.transitions) {
            for (const tr of trs) {
                const trans = new joint.shapes.standard.Link({
                    id: tr.id, 
                    ctrlIn: tr.ctrlIn,
                    ctrlOut: tr.ctrlOut
                });
                trans.appendLabel({
                    attrs: {
                        text: {
                            text: trans.get('ctrlIn').toBin() + '/' + trans.get('ctrlOut').toBin()
                        }
                    }
                });
                trans.source({ id: 'state' + stateIn });
                trans.target({ id: 'state' + tr.stateOut });
                trans.addTo(this.fsmgraph);
            }
        }
        
        this.listenTo(this, 'change:current_state', (model, state) => {
            const pstate = model.previous('current_state');
            this.fsmgraph.getCell('state' + pstate).removeAttr('body/class');
            this.fsmgraph.getCell('state' + state).attr('body/class', 'current_state');
        });
        this.listenTo(this, 'change:next_trans', (model, id) => {
            const pid = model.previous('next_trans');
            if (pid) {
                const cell = this.fsmgraph.getCell(pid);
                cell.removeAttr('line/class');
                cell.removeAttr('line/targetMarker/class');
            }
            if (id) {
                this.fsmgraph.getCell(id).attr({
                    line: {
                        class: 'next_trans',
                        targetMarker: {
                            class: 'next_trans'
                        }
                    }
                });
            }
        });
    },
    prepare() {
        const bits = this.get('bits');
        this.transitions = new Map();
        var id = 0;
        for (const tr of this.get('trans_table')) {
            if (!this.transitions.has(tr.state_in))
                this.transitions.set(tr.state_in, []);
            this.transitions.get(tr.state_in).push({
                id: 'tr'+id,
                stateOut: tr.state_out,
                ctrlIn: Vector3vl.fromBin(tr.ctrl_in, bits.in),
                ctrlOut: Vector3vl.fromBin(tr.ctrl_out, bits.out)
            });
            id++;
        };
        var current_state = this.get('current_state');
        if (current_state === undefined) {
            current_state = this.get('init_state');
            this.set('current_state', current_state);
        }
        this.last_clk = 0;
    },
    operation(data) {
        const bits = this.get('bits');
        const polarity = this.get('polarity');
        const next_trans = () => {
            const links = this.transitions.get(this.get('current_state')) || [];
            for (const trans of links) {
                const ctrlIn = trans.ctrlIn;
                const xmask = ctrlIn.xmask();
                if (data.in.or(xmask).eq(ctrlIn.or(xmask)))
                    return trans;
            }
        };
        const next_output = () => {
            const links = this.transitions.get(this.get('current_state')) || [];
            const ixmask = data.in.xmask();
            const results = [];
            for (const trans of links) {
                const ctrlIn = trans.ctrlIn;
                const xmask = ctrlIn.xmask().or(ixmask);
                if (data.in.or(xmask).eq(ctrlIn.or(xmask)))
                    results.push(trans.ctrlOut);
            }
            const xes = Vector3vl.xes(bits.out);
            if (results.length == 0) return xes;
            while (results.length > 1) {
                const other = results.pop();
                const eqs = results[0].xnor(other).or(xes);
                results[0] = results[0].and(eqs).or(xes.and(eqs.xmask()));
            };
            return results[0];
        };
        const pol = what => polarity[what] ? 1 : -1;
        if (data.arst.get(0) == pol('arst')) {
            this.set('current_state', this.get('init_state'));
        } else {
            const last_clk = this.last_clk;
            if (data.clk.get(0) == pol('clock') && last_clk == -pol('clock')) {
                const trans = next_trans();
                this.set('current_state',
                    trans ? trans.stateOut : this.get('init_state'));
            }
        }
        this.last_clk = data.clk.get(0);
        const trans = next_trans();
        if (!trans) {
            this.set('next_trans', undefined);
        } else {
            this.set('next_trans', trans.id);
        }
        return { out: next_output() };
    },
    markup: Box.prototype.markup.concat(Box.prototype.markupZoom),
    _gateParams: Box.prototype._gateParams.concat(['bits', 'polarity', 'states', 'init_state', 'trans_table']),
    _unsupportedPropChanges: Box.prototype._unsupportedPropChanges.concat(['bits', 'polarity', 'states', 'init_state', 'trans_table']),
    _presentationParams: Box.prototype._presentationParams.concat(['current_state', 'next_trans'])
});

export const FSMView = BoxView.extend({
    _autoResizeBox: true,
    events: {
        "click foreignObject.tooltip": "stopprop",
        "mousedown foreignObject.tooltip": "stopprop",
        "click a.zoom": "_displayEditor"
    },
    _displayEditor(evt) {
        evt.stopPropagation();
        const div = $('<div>', {
            title: "FSM: " + this.model.get('label')
        }).appendTo('html > body');
        const pdiv = $('<div>').appendTo(div);
        const graph = this.model.fsmgraph;
        const paper = new joint.dia.Paper({
            el: pdiv,
            model: graph
        });
        // to visualize the cells
        graph.resetCells(graph.getCells());
        // lazy layout
        if (!graph.get('laid_out')) {
            joint.layout.DirectedGraph.layout(graph, {
                dagre: dagre,
                graphlib: graphlib
            });
            graph.set('laid_out', true);
        }
        // auto-resizing
        this.listenTo(graph, 'change:position', (elem) => {
            paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
        });
        paper.fitToContent({ padding: 30, allowNewOrigin: 'any' });
        this.paper.trigger('open:fsm', div, () => {
            paper.remove();
            div.remove();
        });
        return false;
    }
});

