"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.js';
import { Vector3vl } from '3vl';

// Unary arithmetic operations
export const Arith11 = Gate.define('Arith11', {
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
        Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const bits = this.get('bits');
        if (!data.in.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
        return {
            out: help.bigint2sig(this.arithop(help.sig2bigint(data.in, this.get('signed'))), bits.out)
        };
    },
    gateParams: Gate.prototype.gateParams.concat(['bits', 'signed'])
});

// Binary arithmetic operations
export const Arith21 = Gate.define('Arith21', {
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
        Gate.prototype.constructor.apply(this, arguments);
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
    },
    gateParams: Gate.prototype.gateParams.concat(['bits', 'signed'])
});

// Bit shift operations
export const Shift = Gate.define('Shift', {
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
        Gate.prototype.constructor.apply(this, arguments);
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
    },
    gateParams: Gate.prototype.gateParams.concat(['bits', 'signed', 'fillx'])
});

// Comparison operations
export const Compare = Gate.define('Compare', {
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
        Gate.prototype.constructor.apply(this, arguments);
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
    },
    gateParams: Gate.prototype.gateParams.concat(['bits', 'signed'])
});

// Negation
export const Negation = Arith11.define('Negation', {
    attrs: {
        'text.oper': { text: '-' }
    }
}, {
    arithop: i => bigInt.zero.minus(i)
});
export const NegationView = GateView;

// Unary plus
export const UnaryPlus = Arith11.define('UnaryPlus', {
    attrs: {
        'text.oper': { text: '+' }
    }
}, {
    arithop: i => i
});
export const UnaryPlusView = GateView;

// Addition
export const Addition = Arith21.define('Addition', {
    attrs: {
        'text.oper': { text: '+' }
    }
}, {
    arithop: (i, j) => i.plus(j)
});
export const AdditionView = GateView;

// Subtraction
export const Subtraction = Arith21.define('Subtraction', {
    attrs: {
        'text.oper': { text: '-' }
    }
}, {
    arithop: (i, j) => i.minus(j)
});
export const SubtractionView = GateView;

// Multiplication
export const Multiplication = Arith21.define('Multiplication', {
    attrs: {
        'text.oper': { text: '×' }
    }
}, {
    arithop: (i, j) => i.multiply(j)
});
export const MultiplicationView = GateView;

// Division
export const Division = Arith21.define('Division', {
    attrs: {
        'text.oper': { text: '÷' }
    }
}, {
    arithop: (i, j) => j.isZero() ? i : i.divide(j) // as in IEEE Verilog
});
export const DivisionView = GateView;

// Modulo
export const Modulo = Arith21.define('Modulo', {
    attrs: {
        'text.oper': { text: '%' }
    }
}, {
    arithop: (i, j) => j.isZero() ? i : i.mod(j) // as in IEEE Verilog
});
export const ModuloView = GateView;

// Power
export const Power = Arith21.define('Power', {
    attrs: {
        'text.oper': { text: '**' }
    }
}, {
    arithop: (i, j) => i.pow(j)
});
export const PowerView = GateView;

// Shift left operator
export const ShiftLeft = Shift.define('ShiftLeft', {
    attrs: {
        'text.oper': { text: '≪' }
    }
}, {
    shiftdir: -1
});
export const ShiftLeftView = GateView;

// Shift right operator
export const ShiftRight = Shift.define('ShiftRight', {
    attrs: {
        'text.oper': { text: '≫' }
    }
}, {
    shiftdir: 1
});
export const ShiftRightView = GateView;

// Less than operator
export const Lt = Compare.define('Lt', {
    attrs: {
        'text.oper': { text: '<' }
    }
}, {
    arithcomp: (i, j) => i.lt(j)
});
export const LtView = GateView;

// Less or equal operator
export const Le = Compare.define('Le', {
    attrs: {
        'text.oper': { text: '≤' }
    }
}, {
    arithcomp: (i, j) => i.leq(j)
});
export const LeView = GateView;

// Greater than operator
export const Gt = Compare.define('Gt', {
    attrs: {
        'text.oper': { text: '>' }
    }
}, {
    arithcomp: (i, j) => i.gt(j)
});
export const GtView = GateView;

// Less than operator
export const Ge = Compare.define('Ge', {
    attrs: {
        'text.oper': { text: '≥' }
    }
}, {
    arithcomp: (i, j) => i.geq(j)
});
export const GeView = GateView;

// Equality operator
export const Eq = Compare.define('Eq', {
    attrs: {
        'text.oper': { text: '=' }
    }
}, {
    arithcomp: (i, j) => i.eq(j)
});
export const EqView = GateView;

// Nonequality operator
export const Ne = Compare.define('Ne', {
    attrs: {
        'text.oper': { text: '≠' }
    }
}, {
    arithcomp: (i, j) => i.neq(j)
});
export const NeView = GateView;

