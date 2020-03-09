"use strict";

import * as joint from 'jointjs';
import { Gate, Box, BoxView } from './base';
import { IO, Input, Output } from './io';
import bigInt from 'big-integer';
import * as help from '../help.js';

// Subcircuit model -- embeds a circuit graph in an element
export const Subcircuit = Box.define('Subcircuit', {
    propagation: 0,
    attrs: {
        'path.wire' : { 'ref-y': .5, stroke: 'black' },
        'text.type': {
            text: '', 'ref-x': 0.5, 'ref-y': -10,
            'dominant-baseline': 'ideographic',
            'text-anchor': 'middle',
            fill: 'black'
        },
        '.tooltip': {
            'ref-x': 0, 'ref-y': -30,
            width: 80, height: 30
        },
    }
}, {
    initialize: function() {
        this.listenTo(this, 'change:size', (model, size) => this.attr('.tooltip/width', size.width));
        Box.prototype.initialize.apply(this, arguments);
    },
    constructor: function(args) {
        console.assert(args.graph instanceof joint.dia.Graph);
        const graph = args.graph;
        graph.set('subcircuit', this);
        const IOs = graph.getCells()
            .filter((cell) => cell instanceof IO);
        const inputs = IOs.filter((cell) => cell instanceof Input);
        const outputs = IOs.filter((cell) => cell instanceof Output);
        function sortfun(x, y) {
            if (x.has('order') || y.has('order'))
                return x.get('order') - y.get('order');
            return x.get('net').localeCompare(y.get('net'));
        }
        inputs.sort(sortfun);
        outputs.sort(sortfun);
        const vcount = Math.max(inputs.length, outputs.length);
        const size = { width: 80, height: vcount*16+8 };
        const markup = [];
        const lblmarkup = [];
        const iomap = {};
        _.set(args, ['attrs', 'text.type', 'text'], args.celltype);
        args.inputSignals = args.inputSignals || {};
        args.outputSignals = args.outputSignals || {};
        for (const [num, io] of inputs.entries()) {
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', num*16+12, { id: io.get('net'), dir: 'in', bits: io.get('bits') }));
            args.inputSignals[io.get('net')] = io.get('outputSignals').out;
        }
        for (const [num, io] of outputs.entries()) {
            markup.push(this.addLabelledWire(args, lblmarkup, 'right', num*16+12, { id: io.get('net'), dir: 'out', bits: io.get('bits') }));
            args.outputSignals[io.get('net')] = io.get('inputSignals').in;
        }
        markup.push('<rect class="body"/><text class="label"/><text class="type"/>');
        markup.push(lblmarkup.join(''));
        for (const io of IOs) {
            iomap[io.get('net')] = io.get('id');
        }
        markup.push('<foreignObject class="tooltip">');
        markup.push('<body xmlns="http://www.w3.org/1999/xhtml">');
        markup.push('<a class="zoom" href="">🔍</a>')
        markup.push('</body></foreignObject>');
        this.markup = markup.join('');
        args.size = size;
        args.attrs['rect.body'] = size;
        args.circuitIOmap = iomap;
        Gate.prototype.constructor.apply(this, arguments);
    },
    gateParams: Box.prototype.gateParams.concat(['celltype'])
});

export const SubcircuitView = BoxView.extend({
    events: {
        "click foreignObject.tooltip": "stopprop",
        "mousedown foreignObject.tooltip": "stopprop",
        "click a.zoom": "zoomInCircuit"
    },
    zoomInCircuit: function(evt) {
        evt.stopPropagation();
        this.paper.trigger('open:subcircuit', this.model);
        return false;
    }
});

