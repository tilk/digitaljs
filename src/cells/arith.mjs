"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import bigInt from 'big-integer';
import * as help from '../help';
import { Vector3vl } from '3vl';

// base class for arithmetic operations displayed with a circle
export const Arith = Gate.define('Arith', {
    size: { width: 40, height: 40 },
    attrs: {
        body: { refR: 0.5, refCx: 0.5, refCy: 0.5 },
        oper: {
            refX: .5, refY: .5,
            textAnchor: 'middle', textVerticalAnchor: 'middle',
            fontSize: '12pt'
        }
    },
    ports: {
        groups: {
            'in': { position: { name: 'left', args: { dx: 10 } }, attrs: { wire: { x2: -35 }, port: { refX: -35 } }, z: -1 },
            'out': { position: { name: 'right', args: { dx: -10 } }, attrs: { wire: { x2: 35 }, port: { refX: 35 } }, z: -1 }
        }
    }
}, {
    markup: Gate.prototype.markup.concat([{
            tagName: 'circle',
            className: 'body',
            selector: 'body'
        }, {
            tagName: 'text',
            className: 'oper',
            selector: 'oper'
        }
    ]),
    _gateParams: Gate.prototype._gateParams.concat(['bits', 'signed']),
    _unsupportedPropChanges: Gate.prototype._unsupportedPropChanges.concat(['signed'])
});

// Unary arithmetic operations
export const Arith11 = Arith.define('Arith11', {
    /* default properties */
    bits: { in: 1, out: 1 },
    signed: false
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits.in },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_,bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
        const bits = this.get('bits');
        if (!data.in.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
        return {
            out: help.bigint2sig(this.arithop(help.sig2bigint(data.in, this.get('signed'))), bits.out)
        };
    }
});

// Binary arithmetic operations
export const Arith21 = Arith.define('Arith21', {
    /* default properties */
    bits: { in1: 1, in2: 1, out: 1 },
    signed: { in1: false, in2: false }
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in1', group: 'in', dir: 'in', bits: bits.in1 },
            { id: 'in2', group: 'in', dir: 'in', bits: bits.in2 },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (!data.in1.isFullyDefined || !data.in2.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
        return {
            out: help.bigint2sig(this.arithop(
                    help.sig2bigint(data.in1, sgn.in1 && sgn.in2),
                    help.sig2bigint(data.in2, sgn.in1 && sgn.in2)), bits.out)
        };
    }
});

// Bit shift operations
export const Shift = Arith.define('Shift', {
    /* default properties */
    bits: { in1: 1, in2: 1, out: 1 },
    signed: { in1: false, in2: false, out: false },
    fillx: false
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in1', group: 'in', dir: 'in', bits: bits.in1 },
            { id: 'in2', group: 'in', dir: 'in', bits: bits.in2 },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
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
    _gateParams: Arith.prototype._gateParams.concat(['fillx']),
    _unsupportedPropChanges: Arith.prototype._unsupportedPropChanges.concat(['fillx'])
});

// Comparison operations
export const Compare = Arith.define('Compare', {
    /* default properties */
    bits: { in1: 1, in2: 1 },
    signed: { in1: false, in2: false }
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in1', group: 'in', dir: 'in', bits: bits.in1 },
            { id: 'in2', group: 'in', dir: 'in', bits: bits.in2 },
            { id: 'out', group: 'out', dir: 'out', bits: 1 }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        if (!data.in1.isFullyDefined || !data.in2.isFullyDefined)
            return { out: Vector3vl.xes(1) };
        return {
            out: Vector3vl.fromBool(this.arithcomp(
                    help.sig2bigint(data.in1, sgn.in1 && sgn.in2),
                    help.sig2bigint(data.in2, sgn.in1 && sgn.in2)))
        };
    }
});

// Equality operations
export const EqCompare = Compare.define('EqCompare', {}, {
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const in1 = bits.in1 >= bits.in2 ? data.in1 : 
            data.in1.concat(Vector3vl.make(bits.in2 - bits.in1, sgn.in1 && sgn.in2 ? data.in1.msb : -1));
        const in2 = bits.in2 >= bits.in1 ? data.in2 : 
            data.in2.concat(Vector3vl.make(bits.in1 - bits.in2, sgn.in1 && sgn.in2 ? data.in2.msb : -1));
        return {
            out: this.bincomp(in1, in2)
        };
    }
});

// Negation
export const Negation = Arith11.define('Negation', {
    attrs: {
        oper: { text: '-' }
    }
}, {
    arithop: i => bigInt.zero.minus(i)
});
export const NegationView = GateView;

// Unary plus
export const UnaryPlus = Arith11.define('UnaryPlus', {
    attrs: {
        oper: { text: '+' }
    }
}, {
    arithop: i => i
});
export const UnaryPlusView = GateView;

// Addition
export const Addition = Arith21.define('Addition', {
    attrs: {
        oper: { text: '+' }
    }
}, {
    arithop: (i, j) => i.plus(j)
});
export const AdditionView = GateView;

// Subtraction
export const Subtraction = Arith21.define('Subtraction', {
    attrs: {
        oper: { text: '-' }
    }
}, {
    arithop: (i, j) => i.minus(j)
});
export const SubtractionView = GateView;

// Multiplication
export const Multiplication = Arith21.define('Multiplication', {
    attrs: {
        oper: { text: '×' }
    }
}, {
    arithop: (i, j) => i.multiply(j)
});
export const MultiplicationView = GateView;

// Division
export const Division = Arith21.define('Division', {
    attrs: {
        oper: { text: '÷' }
    }
}, {
    arithop: (i, j) => j.isZero() ? i : i.divide(j) // as in IEEE Verilog
});
export const DivisionView = GateView;

// Modulo
export const Modulo = Arith21.define('Modulo', {
    attrs: {
        oper: { text: '%' }
    }
}, {
    arithop: (i, j) => j.isZero() ? i : i.mod(j) // as in IEEE Verilog
});
export const ModuloView = GateView;

// Power
export const Power = Arith21.define('Power', {
    attrs: {
        oper: { text: '**' }
    }
}, {
    arithop: (i, j) => i.pow(j)
});
export const PowerView = GateView;

// Shift left operator
export const ShiftLeft = Shift.define('ShiftLeft', {
    attrs: {
        oper: { text: '≪' }
    }
}, {
    shiftdir: -1
});
export const ShiftLeftView = GateView;

// Shift right operator
export const ShiftRight = Shift.define('ShiftRight', {
    attrs: {
        oper: { text: '≫' }
    }
}, {
    shiftdir: 1
});
export const ShiftRightView = GateView;

// Less than operator
export const Lt = Compare.define('Lt', {
    attrs: {
        oper: { text: '<' }
    }
}, {
    arithcomp: (i, j) => i.lt(j)
});
export const LtView = GateView;

// Less or equal operator
export const Le = Compare.define('Le', {
    attrs: {
        oper: { text: '≤' }
    }
}, {
    arithcomp: (i, j) => i.leq(j)
});
export const LeView = GateView;

// Greater than operator
export const Gt = Compare.define('Gt', {
    attrs: {
        oper: { text: '>' }
    }
}, {
    arithcomp: (i, j) => i.gt(j)
});
export const GtView = GateView;

// Less than operator
export const Ge = Compare.define('Ge', {
    attrs: {
        oper: { text: '≥' }
    }
}, {
    arithcomp: (i, j) => i.geq(j)
});
export const GeView = GateView;

// Equality operator
export const Eq = EqCompare.define('Eq', {
    attrs: {
        oper: { text: '=' }
    }
}, {
    bincomp: (i, j) => i.xnor(j).reduceAnd()
});
export const EqView = GateView;

// Nonequality operator
export const Ne = EqCompare.define('Ne', {
    attrs: {
        oper: { text: '≠' }
    }
}, {
    bincomp: (i, j) => i.xor(j).reduceOr()
});
export const NeView = GateView;

