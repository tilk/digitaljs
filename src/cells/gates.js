"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '../help.js';

// Single-input gate model
joint.shapes.digital.Gate.define('digital.Gate11', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 75, height: 50 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<image class="body"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
});

// Two-input gate model
joint.shapes.digital.Gate.define('digital.Gate21', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 75, height: 50 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<image class="body"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
});

// Reducing gate model
joint.shapes.digital.Gate.define('digital.GateReduce', {
    size: { width: 60, height: 40 },
    attrs: {
        '.body': { width: 75, height: 50 }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<image class="body"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
});

// Repeater (buffer) gate model
joint.shapes.digital.Gate11.define('digital.Repeater', {
    attrs: { image: { 'xlink:href': require('../gate-repeater.svg') }}
}, {
    operation: function(data) {
        return { out: data.in };
    }
});

// Not gate model
joint.shapes.digital.Gate11.define('digital.Not', {
    attrs: { image: { 'xlink:href': require('../gate-not.svg') }}
}, {
    operation: function(data) {
        return { out: data.in.map((x) => -x) };
    }
});
joint.shapes.digital.NotView = joint.shapes.digital.GateView;

// Or gate model
joint.shapes.digital.Gate21.define('digital.Or', {
    attrs: { image: { 'xlink:href': require('../gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => Math.max(x, y)) };
    }
});
joint.shapes.digital.OrView = joint.shapes.digital.GateView;

// And gate model
joint.shapes.digital.Gate21.define('digital.And', {
    attrs: { image: { 'xlink:href': require('../gate-and.svg') }}

}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => Math.min(x, y)) };
    }
});
joint.shapes.digital.AndView = joint.shapes.digital.GateView;

// Nor gate model
joint.shapes.digital.Gate21.define('digital.Nor', {
    attrs: { image: { 'xlink:href': require('../gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -Math.max(x, y)) };
    }
});
joint.shapes.digital.NorView = joint.shapes.digital.GateView;

// Nand gate model
joint.shapes.digital.Gate21.define('digital.Nand', {
    attrs: { image: { 'xlink:href': require('../gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -Math.min(data.in1, data.in2)) };
    }
});
joint.shapes.digital.NandView = joint.shapes.digital.GateView;

// Xor gate model
joint.shapes.digital.Gate21.define('digital.Xor', {
    attrs: { image: { 'xlink:href': require('../gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => -x * y) };
    }
});
joint.shapes.digital.XorView = joint.shapes.digital.GateView;

// Xnor gate model
joint.shapes.digital.Gate21.define('digital.Xnor', {
    attrs: { image: { 'xlink:href': require('../gate-xnor.svg') }}
}, {
    operation: function(data) {
        return { out: _.zipWith(data.in1, data.in2, (x, y) => x * y) };
    }
});
joint.shapes.digital.XnorView = joint.shapes.digital.GateView;

// Reducing Or gate model
joint.shapes.digital.GateReduce.define('digital.OrReduce', {
    attrs: { image: { 'xlink:href': require('../gate-or.svg') }}
}, {
    operation: function(data) {
        return { out: [Math.max(...data.in)] };
    }
});

// Reducing Nor gate model
joint.shapes.digital.GateReduce.define('digital.NorReduce', {
    attrs: { image: { 'xlink:href': require('../gate-nor.svg') }}
}, {
    operation: function(data) {
        return { out: [-Math.max(...data.in)] };
    }
});

// Reducing And gate model
joint.shapes.digital.GateReduce.define('digital.AndReduce', {
    attrs: { image: { 'xlink:href': require('../gate-and.svg') }}
}, {
    operation: function(data) {
        return { out: [Math.min(...data.in)] };
    }
});

// Reducing Nand gate model
joint.shapes.digital.GateReduce.define('digital.NandReduce', {
    attrs: { image: { 'xlink:href': require('../gate-nand.svg') }}
}, {
    operation: function(data) {
        return { out: [-Math.min(...data.in)] };
    }
});

// Reducing Xor gate model
joint.shapes.digital.GateReduce.define('digital.XorReduce', {
    attrs: { image: { 'xlink:href': require('../gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: [data.in.reduce((a, b) => -a * b)] };
    }
});

// Reducing Xor gate model
joint.shapes.digital.GateReduce.define('digital.XnorReduce', {
    attrs: { image: { 'xlink:href': require('../gate-xor.svg') }}
}, {
    operation: function(data) {
        return { out: [data.in.reduce((a, b) => a * b)] };
    }
});

