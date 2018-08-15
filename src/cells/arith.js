"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Unary arithmetic operations
joint.shapes.digital.Gate.define('digital.Arith11', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20, cx: 20, cy: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in: 1, out: 1 };
        if (!args.signed) args.signed = false;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits.in }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        if (data.in.some(x => x == 0))
            return { out: Array(bits.out).fill(0) };
        return {
            out: help.bigint2sig(this.arithop(help.sig2bigint(data.in, this.get('signed'))), bits.out)
        };
    }
});

// Binary arithmetic operations
joint.shapes.digital.Gate.define('digital.Arith21', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20, cx: 20, cy: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1, out: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (data.in1.some(x => x == 0) || data.in2.some(x => x == 0))
            return { out: Array(bits.out).fill(0) };
        return {
            out: help.bigint2sig(this.arithop(
                    help.sig2bigint(data.in1, sgn.in1),
                    help.sig2bigint(data.in2, sgn.in2)), bits.out)
        };
    }
});

// Bit shift operations
joint.shapes.digital.Gate.define('digital.Shift', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20, cx: 20, cy: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1, out: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        if (!args.fillx) args.fillx = false;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const fillx = this.get('fillx');
        if (data.in2.some(x => x == 0))
            return { out: Array(bits.out).fill(0) };
        const am = help.sig2bigint(data.in2, sgn.in2) * this.shiftdir;
        const signbit = data.in1.slice(-1)[0];
        const ext = Array(Math.max(0, bits.out - bits.in1))
            .fill(fillx ? 0 : sgn.in1 ? data.in1.slice(-1)[0] : -1);
        const my_in = data.in1.concat(ext);
        const out = am < 0
            ? Array(-am).fill(fillx ? 0 : -1).concat(my_in)
            : my_in.slice(am).concat(Array(am).fill(fillx ? 0 : sgn.out ? my_in.slice(-1)[0] : -1));
        return { out: out.slice(0, bits.out) };
    }
});

// Comparison operations
joint.shapes.digital.Gate.define('digital.Compare', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20, cx: 20, cy: 20 },
        'text.oper': {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<g class="scalable">',
            '<circle class="body"/>',
            '</g>',
            '<text class="label"/>',
            '<text class="oper"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (data.in1.some(x => x == 0) || data.in2.some(x => x == 0))
            return { out: [0] };
        return {
            out: [this.arithcomp(
                    help.sig2bigint(data.in1, sgn.in1),
                    help.sig2bigint(data.in2, sgn.in2)) ? 1 : -1]
        };
    }
});

// Negation
joint.shapes.digital.Arith11.define('digital.Negation', {
    attrs: {
        'text.oper': { text: '-' }
    }
}, {
    arithop: i => bigInt.zero.minus(i)
});

// Unary plus
joint.shapes.digital.Arith11.define('digital.UnaryPlus', {
    attrs: {
        'text.oper': { text: '+' }
    }
}, {
    arithop: i => i
});

// Addition
joint.shapes.digital.Arith21.define('digital.Addition', {
    attrs: {
        'text.oper': { text: '+' }
    }
}, {
    arithop: (i, j) => i.plus(j)
});

// Subtraction
joint.shapes.digital.Arith21.define('digital.Subtraction', {
    attrs: {
        'text.oper': { text: '-' }
    }
}, {
    arithop: (i, j) => i.minus(j)
});

// Multiplication
joint.shapes.digital.Arith21.define('digital.Multiplication', {
    attrs: {
        'text.oper': { text: '×' }
    }
}, {
    arithop: (i, j) => i.multiply(j)
});

// Division
joint.shapes.digital.Arith21.define('digital.Division', {
    attrs: {
        'text.oper': { text: '÷' }
    }
}, {
    arithop: (i, j) => i.divide(j)
});

// Modulo
joint.shapes.digital.Arith21.define('digital.Modulo', {
    attrs: {
        'text.oper': { text: '%' }
    }
}, {
    arithop: (i, j) => i.mod(j)
});

// Power
joint.shapes.digital.Arith21.define('digital.Power', {
    attrs: {
        'text.oper': { text: '**' }
    }
}, {
    arithop: (i, j) => i.pow(j)
});

// Shift left operator
joint.shapes.digital.Shift.define('digital.ShiftLeft', {
    attrs: {
        'text.oper': { text: '≪' }
    }
}, {
    shiftdir: -1
});

// Shift right operator
joint.shapes.digital.Shift.define('digital.ShiftRight', {
    attrs: {
        'text.oper': { text: '≫' }
    }
}, {
    shiftdir: 1
});

// Less than operator
joint.shapes.digital.Compare.define('digital.Lt', {
    attrs: {
        'text.oper': { text: '<' }
    }
}, {
    arithcomp: (i, j) => i.lt(j)
});

// Less or equal operator
joint.shapes.digital.Compare.define('digital.Le', {
    attrs: {
        'text.oper': { text: '≤' }
    }
}, {
    arithcomp: (i, j) => i.leq(j)
});

// Greater than operator
joint.shapes.digital.Compare.define('digital.Gt', {
    attrs: {
        'text.oper': { text: '>' }
    }
}, {
    arithcomp: (i, j) => i.gt(j)
});

// Less than operator
joint.shapes.digital.Compare.define('digital.Ge', {
    attrs: {
        'text.oper': { text: '≥' }
    }
}, {
    arithcomp: (i, j) => i.geq(j)
});

// Equality operator
joint.shapes.digital.Compare.define('digital.Eq', {
    attrs: {
        'text.oper': { text: '=' }
    }
}, {
    arithcomp: (i, j) => i.eq(j)
});

// Nonequality operator
joint.shapes.digital.Compare.define('digital.Ne', {
    attrs: {
        'text.oper': { text: '≠' }
    }
}, {
    arithcomp: (i, j) => i.neq(j)
});

