"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';
import { Vector3vl } from '3vl';

// Unary arithmetic operations
joint.shapes.digital.Gate.define('digital.Arith11', {
    size: { width: 40, height: 40 },
    attrs: {
        'circle.body': { r: 20, cx: 20, cy: 20 },
        'text.oper': {
            fill: 'black',
            'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in: 1, out: 1 };
        if (!args.signed) args.signed = false;
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits.in }),
            '<circle class="body"/>',
            '<text class="label"/>',
            '<text class="oper"/>',
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        if (!data.in.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
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
            'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1, out: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<circle class="body"/>',
            '<text class="label"/>',
            '<text class="oper"/>',
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (!data.in1.isFullyDefined || !data.in2.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
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
            'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1, out: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false, out: false };
        if (!args.fillx) args.fillx = false;
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits.out }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<circle class="body"/>',
            '<text class="label"/>',
            '<text class="oper"/>',
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const fillx = this.get('fillx');
        if (!data.in2.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
        const am = help.sig2bigint(data.in2, sgn.in2) * this.shiftdir;
        const signbit = data.in1.get(data.in1.bits-1);
        const ext = Vector3vl.make(Math.max(0, bits.out - bits.in1),
            fillx ? 0 : sgn.in1 ? signbit : -1);
        const my_in = data.in1.concat(ext);
        const out = am < 0
            ? Vector3vl.make(-am, fillx ? 0 : -1).concat(my_in)
            : my_in.slice(am).concat(Vector3vl.make(am, fillx ? 0 : sgn.out ? my_in.get(my_in.bits-1) : -1));
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
            'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = { in1: 1, in2: 1 };
        if (!args.signed) args.signed = { in1: false, in2: false };
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            this.addWire(args, 'left', 0.3, { id: 'in1', dir: 'in', bits: args.bits.in1 }),
            this.addWire(args, 'left', 0.7, { id: 'in2', dir: 'in', bits: args.bits.in2 }),
            '<circle class="body"/>',
            '<text class="label"/>',
            '<text class="oper"/>',
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (!data.in1.isFullyDefined || !data.in2.isFullyDefined)
            return { out: Vector3vl.xes(1) };
        return {
            out: Vector3vl.fromBool(this.arithcomp(
                    help.sig2bigint(data.in1, sgn.in1),
                    help.sig2bigint(data.in2, sgn.in2)))
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
    arithop: (i, j) => j.isZero() ? i : i.divide(j) // as in IEEE Verilog
});

// Modulo
joint.shapes.digital.Arith21.define('digital.Modulo', {
    attrs: {
        'text.oper': { text: '%' }
    }
}, {
    arithop: (i, j) => j.isZero() ? i : i.mod(j) // as in IEEE Verilog
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

