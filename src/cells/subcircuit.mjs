"use strict";

import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import { IO, Input, Output } from './io';
import bigInt from 'big-integer';
import * as help from '../help.mjs';

// Subcircuit model -- embeds a circuit graph in an element
export const Subcircuit = Box.define('Subcircuit', {
    /* default properties */
    propagation: 0,
    
    attrs: {
        'text.type': {
            refX: .5, refY: -10,
            textAnchor: 'middle', textVerticalAnchor: 'middle'
        }
    }
}, {
    initialize: function() {
        Box.prototype.initialize.apply(this, arguments);
        
        this.bindAttrToProp('text.type/text', 'celltype');
        
        const graph = this.get('graph');
        console.assert(graph instanceof joint.dia.Graph);
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
        const iomap = {}, inputSignals = {}, outputSignals = {};
        for (const [num, io] of inputs.entries()) {
            this.addPort({ id: io.get('net'), group: 'in', dir: 'in', bits: io.get('bits') }, { labelled: true });
            inputSignals[io.get('net')] = io.get('outputSignals').out;
        }
        for (const [num, io] of outputs.entries()) {
            this.addPort({ id: io.get('net'), group: 'out', dir: 'out', bits: io.get('bits') }, { labelled: true });
            outputSignals[io.get('net')] = io.get('inputSignals').in;
        }
        for (const io of IOs) {
            iomap[io.get('net')] = io.get('id');
        }
        this.set('size', size);
        this.set('circuitIOmap', iomap);
        this.set('inputSignals', inputSignals);
        this.set('outputSignals', outputSignals);
    },
    //add offset of 10pt to account for the top label at layout time
    getLayoutSize: function() {
        const size = this.size();
        size.height += 10;
        return size;
    },
    setLayoutPosition: function(position) {
        this.set('position', {
            x: position.x - position.width / 2,
            y: position.y - position.height / 2 + 10
        });
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'text',
            className: 'type'
        }
    ], Box.prototype.markupZoom),
    gateParams: Box.prototype.gateParams.concat(['celltype']),
    unsupportedPropChanges: Box.prototype.unsupportedPropChanges.concat(['celltype'])
});

export const SubcircuitView = BoxView.extend({
    autoResizeBox: true,
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

