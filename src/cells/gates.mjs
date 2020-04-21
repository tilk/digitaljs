"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

// Single-input gate model
export const Gate11 = Gate.define('Gate11', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 60, height: 40 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<image class="body"/>',
            '<text class="label"/>',
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    gateParams: Gate.prototype.gateParams.concat(['bits'])
});

// Two-input gate model
export const Gate21 = Gate.define('Gate21', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 60, height: 40 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits }),
            '<image class="body"/>',
            '<text class="label"/>',
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    gateParams: Gate.prototype.gateParams.concat(['bits'])
});

// Reducing gate model
export const GateReduce = Gate.define('GateReduce', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 60, height: 40 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<image class="body"/>',
            '<text class="label"/>',
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
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

