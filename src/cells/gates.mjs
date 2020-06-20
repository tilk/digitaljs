"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

const and_path = "M19 4v32h16c9 0 16-7 16-16S44 4 35 4H20z";
const or_path = "M14.3 4l1.6 2s4.5 5.6 4.5 14-4.5 14-4.5 14l-1.6 2H28c3.8 0 16.6-.5 25-16h0A28 28 0 0028 4H16.8z";
const buf_path = "M18 2v36l2-1 32-17h0L20 3z";
const xor_arc_path = "M6.8 2.8L10 6.7S14.2 12 14.2 20 10 33.3 10 33.3l-3.2 3.9H10l1.7-2.4s4.8-6 4.8-14.8c0-8.9-4.8-14.8-4.8-14.8l-1.7-2.4z";
    
const xor_arc_path_markup = {
    tagName: 'path',
    attributes: {
        fill: "#000",
        d: xor_arc_path
    }
};

const neg_markup = {
    tagName: 'circle',
    className: 'body',
    attributes: {
        cx: 56,
        cy: 20,
        r: 4
    }
};

// base class for gates
export const GateSVG = Gate.define('GateSVG', {
    /* default properties */
    bits: 1,

    size: { width: 60, height: 40 },
    ports: {
        groups: {
            'in': { position: { name: 'left', args: { dx: 20 } }, attrs: { 'line.wire': { x2: -40 }, port: { refX: -40 } }, z: -1 },
            'out': { position: { name: 'right', args: { dx: -20 } }, attrs: { 'line.wire': { x2: 40 }, port: { refX: 40 } }, z: -1 }
        }
    }
}, {
    markup: Gate.prototype.markup.concat([{
            tagName: 'path',
            className: 'body gate'
        }
    ]),
    gateParams: Gate.prototype.gateParams.concat(['bits'])
});

// Single-input gate model
export const Gate11 = GateSVG.define('Gate11', {}, {
    initialize: function() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: bits }
        ];
        
        GateSVG.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this.setPortsBits({ in: bits, out: bits });
        });
    }
});

// Two-input gate model
export const Gate21 = GateSVG.define('Gate21', {}, {
    initialize: function() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in1', group: 'in', dir: 'in', bits: bits },
            { id: 'in2', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: bits }
        ];
        
        GateSVG.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this.setPortsBits({ in1: bits, in2: bits, out: bits });
        });
    }
});

// Reducing gate model
export const GateReduce = GateSVG.define('GateReduce', {}, {
    initialize: function() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: 1 }
        ];
        
        GateSVG.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this.setPortsBits({ in: bits });
        });
    }
});

// Repeater (buffer) gate model
export const Repeater = Gate11.define('Repeater', {
    attrs: { 'path.gate': { d: buf_path }}
}, {
    operation: function(data) {
        return { out: data.in };
    }
});
export const RepeaterView = GateView;

// Not gate model
export const Not = Gate11.define('Not', {
    attrs: { 'path.gate': { d: buf_path }}
}, {
    operation: function(data) {
        return { out: data.in.not() };
    },
    markup: Gate11.prototype.markup.concat([neg_markup])
});
export const NotView = GateView;

// Or gate model
export const Or = Gate21.define('Or', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in1.or(data.in2) };
    }
});
export const OrView = GateView;

// And gate model
export const And = Gate21.define('And', {
    attrs: { 'path.gate': { d: and_path }}
}, {
    operation: function(data) {
        return { out: data.in1.and(data.in2) };
    }
});
export const AndView = GateView;

// Nor gate model
export const Nor = Gate21.define('Nor', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in1.nor(data.in2) };
    },
    markup: Gate21.prototype.markup.concat([neg_markup])
});
export const NorView = GateView;

// Nand gate model
export const Nand = Gate21.define('Nand', {
    attrs: { 'path.gate': { d: and_path }}
}, {
    operation: function(data) {
        return { out: data.in1.nand(data.in2) };
    },
    markup: Gate21.prototype.markup.concat([neg_markup])
});
export const NandView = GateView;

// Xor gate model
export const Xor = Gate21.define('Xor', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in1.xor(data.in2) };
    },
    markup: Gate21.prototype.markup.concat([xor_arc_path_markup])
});
export const XorView = GateView;

// Xnor gate model
export const Xnor = Gate21.define('Xnor', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in1.xnor(data.in2) };
    },
    markup: Gate21.prototype.markup.concat([xor_arc_path_markup, neg_markup])
});
export const XnorView = GateView;

// Reducing Or gate model
export const OrReduce = GateReduce.define('OrReduce', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in.reduceOr() };
    }
});
export const OrReduceView = GateView;

// Reducing Nor gate model
export const NorReduce = GateReduce.define('NorReduce', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in.reduceNor() };
    },
    markup: GateReduce.prototype.markup.concat([neg_markup])
});
export const NorReduceView = GateView;

// Reducing And gate model
export const AndReduce = GateReduce.define('AndReduce', {
    attrs: { 'path.gate': { d: and_path }}
}, {
    operation: function(data) {
        return { out: data.in.reduceAnd() };
    }
});
export const AndReduceView = GateView;

// Reducing Nand gate model
export const NandReduce = GateReduce.define('NandReduce', {
    attrs: { 'path.gate': { d: and_path }}
}, {
    operation: function(data) {
        return { out: data.in.reduceNand() };
    },
    markup: GateReduce.prototype.markup.concat([neg_markup])
});
export const NandReduceView = GateView;

// Reducing Xor gate model
export const XorReduce = GateReduce.define('XorReduce', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in.reduceXor() };
    },
    markup: GateReduce.prototype.markup.concat([xor_arc_path_markup])
});
export const XorReduceView = GateView;

// Reducing Xnor gate model
export const XnorReduce = GateReduce.define('XnorReduce', {
    attrs: { 'path.gate': { d: or_path }}
}, {
    operation: function(data) {
        return { out: data.in.reduceXnor() };
    },
    markup: GateReduce.prototype.markup.concat([xor_arc_path_markup, neg_markup])
});
export const XnorReduceView = GateView;

