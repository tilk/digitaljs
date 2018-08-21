"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Subcircuit model -- embeds a circuit graph in an element
joint.shapes.digital.Box.define('digital.Subcircuit', {
    propagation: 0,
    attrs: {
        'path.wire' : { ref: '.body', 'ref-y': .5, stroke: 'black' },
        'text.type': {
            text: '', ref: '.body', 'ref-x': 0.5, 'ref-y': -2, 'x-alignment': 'middle',
            'y-alignment': 'bottom', fill: 'black'
        },
    }
}, {
    constructor: function(args) {
        console.assert(args.graph instanceof joint.dia.Graph);
        const graph = args.graph;
        graph.set('subcircuit', this);
        const IOs = graph.getCells()
            .filter((cell) => cell instanceof joint.shapes.digital.IO);
        const inputs = IOs.filter((cell) => cell instanceof joint.shapes.digital.Input);
        const outputs = IOs.filter((cell) => cell instanceof joint.shapes.digital.Output);
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
        markup.push('<g class="rotatable">');
        const iomap = {};
        _.set(args, ['attrs', '.body'], size);
        _.set(args, ['attrs', 'text.type', 'text'], args.celltype);
        for (const [num, io] of inputs.entries()) {
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', num*16+12, { id: io.get('net'), dir: 'in', bits: io.get('bits') }));
        }
        for (const [num, io] of outputs.entries()) {
            markup.push(this.addLabelledWire(args, lblmarkup, 'right', num*16+12, { id: io.get('net'), dir: 'out', bits: io.get('bits') }));
        }
        markup.push('<g class="scalable"><rect class="body"/></g><text class="label"/><text class="type"/>');
        markup.push(lblmarkup.join(''));
        for (const io of IOs) {
            iomap[io.get('net')] = io.get('id');
        }
        markup.push('</g>');
        this.markup = markup.join('');
        args.size = size;
        args.circuitIOmap = iomap;
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});
joint.shapes.digital.SubcircuitView = joint.shapes.digital.BoxView;

