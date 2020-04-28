"use strict";

import $ from 'jquery';
import _ from 'lodash';
import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl, Mem3vl } from '3vl';
import dagre from 'dagre';
import graphlib from 'graphlib';

export const FSM = Box.define('FSM', {
    size: { width: 80, height: 3*16+8 },
    attrs: {
        '.tooltip': {
            'ref-x': 0, 'ref-y': -30,
            width: 80, height: 30
        },
    }
}, {
    initialize: function() {
        this.listenTo(this, 'change:size', (model, size) => {
            this.attr('.tooltip/width', size.width)
        });
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
        Box.prototype.initialize.apply(this, arguments);
    },
    constructor: function(args) {
        if (!args.init_state) args.init_state = 0;
        if (!('current_state' in args)) args.current_state = args.init_state;
        args.next_trans = undefined;
        const markup = [];
        const lblmarkup = [];
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', 16+12, { id: 'clk', dir: 'in', bits: 1, polarity: args.polarity.clock, clock: true }));
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', 2*16+12, { id: 'arst', dir: 'in', bits: 1, polarity: args.polarity.arst }));
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', 12, { id: 'in', dir: 'in', bits: args.bits.in }));
        markup.push(this.addLabelledWire(args, lblmarkup, 'right', 12, { id: 'out', dir: 'out', bits: args.bits.out }));
        markup.push('<rect class="body"/><text class="label"/>');
        markup.push(lblmarkup.join(''));
        markup.push(['<foreignObject class="tooltip">',
            '<body xmlns="http://www.w3.org/1999/xhtml">',
            '<a class="zoom">🔍</a>',
            '</body></foreignObject>'].join(''));
        this.markup = markup.join('');
        this.fsmgraph = new joint.dia.Graph;
        const statenodes = [];
        for (let n = 0; n < args.states; n++) {
            const node = new joint.shapes.standard.Circle({stateNo: n, id: 'state' + n, isInit: n == args.init_state});
            node.attr('label/text', String(n));
            node.resize(100,50);
            node.addTo(this.fsmgraph);
            statenodes.push(node);
        }
        for (const tr of args.trans_table) {
            const trans = new joint.shapes.standard.Link({
                ctrlIn: Vector3vl.fromBin(tr.ctrl_in, args.bits.in),
                ctrlOut: Vector3vl.fromBin(tr.ctrl_out, args.bits.out)
            });
            trans.appendLabel({
                attrs: {
                    text: {
                        text: trans.get('ctrlIn').toBin() + '/' + trans.get('ctrlOut').toBin()
                    }
                }
            });
            trans.source({ id: 'state' + tr.state_in });
            trans.target({ id: 'state' + tr.state_out });
            trans.addTo(this.fsmgraph);
        }
        Box.prototype.constructor.apply(this, arguments);
        this.last_clk = 0;
    },
    operation: function(data) {
        const bits = this.get('bits');
        const polarity = this.get('polarity');
        const next_trans = () => {
            const node = this.fsmgraph.getCell('state' + this.get('current_state'));
            const links = this.fsmgraph.getConnectedLinks(node, { outbound: true });
            for (const trans of links) {
                const ctrlIn = trans.get('ctrlIn');
                const xmask = ctrlIn.xmask();
                if (data.in.or(xmask).eq(ctrlIn.or(xmask)))
                    return trans;
            }
        };
        const pol = what => polarity[what] ? 1 : -1;
        if (data.arst.get(0) == pol('arst')) {
            this.set('current_state', this.get('init_state'));
        } else {
            const last_clk = this.last_clk;
            this.last_clk = data.clk.get(0);
            if (data.clk.get(0) == pol('clock') && last_clk == -pol('clock')) {
                const trans = next_trans();
                this.set('current_state',
                    trans ? trans.getTargetElement().get('stateNo') : this.get('init_state'));
            }
        }
        const trans = next_trans();
        if (!trans) {
            this.set('next_trans', undefined);
            return { out: Vector3vl.xes(bits.out) };
        } else {
            this.set('next_trans', trans.id);
            return { out: trans.get('ctrlOut') };
        }
    },
    gateParams: Box.prototype.gateParams.concat(['bits', 'polarity', 'wirename', 'states', 'init_state', 'trans_table'])
});

export const FSMView = BoxView.extend({
    events: {
        "click foreignObject.tooltip": "stopprop",
        "mousedown foreignObject.tooltip": "stopprop",
        "click a.zoom": "displayEditor"
    },
    displayEditor(evt) {
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

