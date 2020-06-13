"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

// base class for gates displayed using an external svg image
export const GateSVG = Gate.define('GateSVG', {
    /* default properties */
    bits: 1,
    
    size: { width: 60, height: 40 },
    attrs: {
        'image.body': { refWidth: 1, refHeight: 1 }
    },
    ports: {
        groups: {
            'in': { position: { name: 'left', args: { dx: 20 } }, attrs: { 'line.wire': { x2: -40 }, port: { refX: -40 } }, z: -1 },
            'out': { position: { name: 'right', args: { dx: -20 } }, attrs: { 'line.wire': { x2: 40 }, port: { refX: 40 } }, z: -1 }
        }
    }
}, {
    markup: Gate.prototype.markup.concat([{
            tagName: 'image',
            className: 'body'
        }
    ]),
    gateParams: Gate.prototype.gateParams.concat(['bits'])
});

// Single-input gate model
export const Gate11 = GateSVG.define('Gate11', {}, {
    initialize: function() {
        GateSVG.prototype.initialize.apply(this, arguments);
        
        const bits = this.prop('bits');
        
        this.addPorts([
            { id: 'in', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: bits }
        ]);
        
        this.on('change:bits', (_, bits) => {
            this.setPortBits('in', bits);
            this.setPortBits('out', bits);
        });
    }
});

// Two-input gate model
export const Gate21 = GateSVG.define('Gate21', {}, {
    initialize: function() {
        GateSVG.prototype.initialize.apply(this, arguments);
        
        const bits = this.prop('bits');
        this.addPorts([
            { id: 'in1', group: 'in', dir: 'in', bits: bits },
            { id: 'in2', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: bits }
        ]);
        
        this.on('change:bits', (_, bits) => {
            this.setPortBits('in1', bits);
            this.setPortBits('in2', bits);
            this.setPortBits('out', bits);
        });
    }
});

// Reducing gate model
export const GateReduce = GateSVG.define('GateReduce', {}, {
    initialize: function() {
        GateSVG.prototype.initialize.apply(this, arguments);
        const bits = this.prop('bits');
        
        this.addPorts([
            { id: 'in', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: 1 }
        ]);
        
        this.on('change:bits', (_, bits) => {
            this.setPortBits('in', bits);
        });
    }
});

// Repeater (buffer) gate model
export const Repeater = Gate11.define('Repeater', {
    attrs: { image: { 'xlink:href': require('./gate-repeater.svg') }}
}, {
    operation: function(data) {
        return { out: data.in };
    }
});
export const RepeaterView = GateView;

// Not gate model
export const Not = Gate11.define('Not', {
    attrs: { image: { 'xlink:href': require('./gate-not.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.not() };
    }
});
export const NotView = GateView;

// Or gate model
export const Or = Gate21.define('Or', {
    attrs: { image: { 'xlink:href': require('./gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: data.in1.or(data.in2) };
    }
});
export const OrView = GateView;

// And gate model
export const And = Gate21.define('And', {
    attrs: { image: { 'xlink:href': require('./gate-and.svg') }}

}, {
    operation: function(data) {
        return { out: data.in1.and(data.in2) };
    }
});
export const AndView = GateView;

// Nor gate model
export const Nor = Gate21.define('Nor', {
    attrs: { image: { 'xlink:href': require('./gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: data.in1.nor(data.in2) };
    }
});
export const NorView = GateView;

// Nand gate model
export const Nand = Gate21.define('Nand', {
    attrs: { image: { 'xlink:href': require('./gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: data.in1.nand(data.in2) };
    }
});
export const NandView = GateView;

// Xor gate model
export const Xor = Gate21.define('Xor', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: data.in1.xor(data.in2) };
    }
});
export const XorView = GateView;

// Xnor gate model
export const Xnor = Gate21.define('Xnor', {
    attrs: { image: { 'xlink:href': require('./gate-xnor.svg') }}
}, {
    operation: function(data) {
        return { out: data.in1.xnor(data.in2) };
    }
});
export const XnorView = GateView;

// Reducing Or gate model
export const OrReduce = GateReduce.define('OrReduce', {
    attrs: { image: { 'xlink:href': require('./gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.reduceOr() };
    }
});
export const OrReduceView = GateView;

// Reducing Nor gate model
export const NorReduce = GateReduce.define('NorReduce', {
    attrs: { image: { 'xlink:href': require('./gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.reduceNor() };
    }
});
export const NorReduceView = GateView;

// Reducing And gate model
export const AndReduce = GateReduce.define('AndReduce', {
    attrs: { image: { 'xlink:href': require('./gate-and.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.reduceAnd() };
    }
});
export const AndReduceView = GateView;

// Reducing Nand gate model
export const NandReduce = GateReduce.define('NandReduce', {
    attrs: { image: { 'xlink:href': require('./gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.reduceNand() };
    }
});
export const NandReduceView = GateView;

// Reducing Xor gate model
export const XorReduce = GateReduce.define('XorReduce', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.reduceXor() };
    }
});
export const XorReduceView = GateView;

// Reducing Xnor gate model
export const XnorReduce = GateReduce.define('XnorReduce', {
    attrs: { image: { 'xlink:href': require('./gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.reduceXnor() };
    }
});
export const XnorReduceView = GateView;

