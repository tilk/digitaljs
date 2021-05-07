"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
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
            out: Vector3vl.fromNumber(this.arithop(data.in.toBigInt(this.get('signed'))), bits.out)
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
            out: Vector3vl.fromNumber(this.arithop(
                    data.in1.toBigInt(sgn.in1 && sgn.in2),
                    data.in2.toBigInt(sgn.in1 && sgn.in2)), bits.out)
        };
    }
});

function shiftHelp(in1, am, bits_in, bits_out, sgn_in, sgn_out, fillx) {
    const signbit = in1.get(in1.bits-1);
    const ext = Vector3vl.make(Math.max(0, bits_out - bits_in),
        fillx ? 0 : sgn_in ? signbit : -1);
    const my_in = in1.concat(ext);
    const out = am < 0
        ? Vector3vl.make(-am, fillx ? 0 : -1).concat(my_in)
        : my_in.slice(am).concat(Vector3vl.make(am, fillx ? 0 : sgn_out ? my_in.get(my_in.bits-1) : -1));
    return out.slice(0, bits_out);
}

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
        const am = data.in2.toNumber(sgn.in2) * this.shiftdir;
        return { out: shiftHelp(data.in1, am, bits.in1, bits.out, sgn.in1, sgn.out, fillx) };
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
                    data.in1.toBigInt(sgn.in1 && sgn.in2),
                    data.in2.toBigInt(sgn.in1 && sgn.in2)))
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
    arithop: i => -i
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
    arithop: (i, j) => i + j
});
export const AdditionView = GateView;

// Subtraction
export const Subtraction = Arith21.define('Subtraction', {
    attrs: {
        oper: { text: '-' }
    }
}, {
    arithop: (i, j) => i - j
});
export const SubtractionView = GateView;

// Multiplication
export const Multiplication = Arith21.define('Multiplication', {
    attrs: {
        oper: { text: '×' }
    }
}, {
    arithop: (i, j) => i * j
});
export const MultiplicationView = GateView;

// Division
export const Division = Arith21.define('Division', {
    attrs: {
        oper: { text: '÷' }
    }
}, {
    arithop: (i, j) => j == 0n ? i : i / j // as in IEEE Verilog
});
export const DivisionView = GateView;

// Modulo
export const Modulo = Arith21.define('Modulo', {
    attrs: {
        oper: { text: '%' }
    }
}, {
    arithop: (i, j) => j == 0n ? i : i % j // as in IEEE Verilog
});
export const ModuloView = GateView;

// Power
export const Power = Arith21.define('Power', {
    attrs: {
        oper: { text: '**' }
    }
}, {
    arithop: (i, j) => j >= 0n ? i ** j : i == 1n ? 1n : i == -1n ? (j % 2n ? -1n : 1n) : 0n
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
    arithcomp: (i, j) => i < j
});
export const LtView = GateView;

// Less or equal operator
export const Le = Compare.define('Le', {
    attrs: {
        oper: { text: '≤' }
    }
}, {
    arithcomp: (i, j) => i <= j
});
export const LeView = GateView;

// Greater than operator
export const Gt = Compare.define('Gt', {
    attrs: {
        oper: { text: '>' }
    }
}, {
    arithcomp: (i, j) => i > j
});
export const GtView = GateView;

// Less than operator
export const Ge = Compare.define('Ge', {
    attrs: {
        oper: { text: '≥' }
    }
}, {
    arithcomp: (i, j) => i >= j
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

// Arithmetic operations fused with constants
export const ArithConst = Arith.define('ArithConst', {
    size: { width: 60, height: 60 },
    /* default properties */
    bits: { in: 1, out: 1 },
    signed: false,
    leftOp: false,
    constant: 0
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits.in },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);

        this.attr("oper/text", 
            this.get('leftOp') ? this.get('constant') + this.operSymbol
                               : this.operSymbol + this.get('constant'))
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const constant = this.get('constant');
        if (!data.in.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
        if (this.get('leftOp'))
            return {
                out: Vector3vl.fromNumber(this.arithop(
                    BigInt(constant),
                    data.in.toBigInt(sgn.in)), bits.out)
            }
        else
            return {
                out: Vector3vl.fromNumber(this.arithop(
                    data.in.toBigInt(sgn.in), BigInt(constant)), bits.out)
            };
    },
    _gateParams: Arith.prototype._gateParams.concat(['leftOp', 'constant'])
});

// Bit shift operations fused with constants
export const ShiftConst = Arith.define('ShiftConst', {
    size: { width: 60, height: 60 },
    /* default properties */
    bits: { in: 1, out: 1 },
    signed: { in: false, out: false },
    leftOp: false,
    constant: 0
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits.in },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);

        this.attr("oper/text", 
            this.get('leftOp') ? this.get('constant') + this.operSymbol
                               : this.operSymbol + this.get('constant'))
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const fillx = this.get('fillx');
        const constant = this.get('constant');
        if (this.get('leftOp')) {
            if (!data.in.isFullyDefined)
                return { out: Vector3vl.xes(bits.out) };
            const am = data.in.toNumber(sgn.in);
            const sig = Vector3vl.fromNumber(constant);
            return { 
                out: shiftHelp(sig, am * this.shiftdir, sig.bits, bits.out, constant < 0, sgn.out, fillx) 
            };
        } else
            return { 
                out: shiftHelp(data.in, constant * this.shiftdir, bits.in, bits.out, sgn.in, sgn.out, fillx) 
            };
    },
    _gateParams: Arith.prototype._gateParams.concat(['leftOp', 'constant'])
});

// Comparison operations fused with constants
export const CompareConst = Arith.define('CompareConst', {
    size: { width: 60, height: 60 },
    /* default properties */
    bits: { in: 1 },
    signed: false,
    leftOp: false,
    constant: 0
}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits.in },
            { id: 'out', group: 'out', dir: 'out', bits: 1 }
        ];
        
        Arith.prototype.initialize.apply(this, arguments);

        this.attr("oper/text", 
            this.get('leftOp') ? this.get('constant') + this.operSymbol
                               : this.operSymbol + this.get('constant'))
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits(bits);
        });
    },
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const constant = this.get('constant');
        if (!data.in.isFullyDefined)
            return { out: Vector3vl.xes(bits.out) };
        if (this.get('leftOp'))
            return {
                out: Vector3vl.fromBool(this.arithcomp(
                    BigInt(constant),
                    data.in.toBigInt(sgn.in)))
            }
        else
            return {
                out: Vector3vl.fromBool(this.arithcomp(
                    data.in.toBigInt(sgn.in), 
                    BigInt(constant)))
            };
    },
    _gateParams: Arith.prototype._gateParams.concat(['leftOp', 'constant'])
});

// Equality operations fused with constants
export const EqCompareConst = CompareConst.define('EqCompare', {}, {
    operation(data) {
        const bits = this.get('bits');
        const sgn = this.get('signed');
        const constant = this.get('constant');
        if (this.get('leftOp'))
            return {
                out: this.bincomp(Vector3vl.fromNumber(constant, bits.in), data.in)
            };
        else
            return {
                out: this.bincomp(data.in, Vector3vl.fromNumber(constant, bits.in))
            };
    }
});

// Addition with constant
export const AdditionConst = ArithConst.define('AdditionConst', {}, {
    operSymbol: '+',
    arithop: (i, j) => i + j
});
export const AdditionConstView = GateView;

// Subtraction with constant
export const SubtractionConst = ArithConst.define('SubtractionConst', {}, {
    operSymbol: '-',
    arithop: (i, j) => i - j
});
export const SubtractionConstView = GateView;

// Multiplication with constant
export const MultiplicationConst = ArithConst.define('MultiplicationConst', {}, {
    operSymbol: '×',
    arithop: (i, j) => i * j
});
export const MultiplicationConstView = GateView;

// Division with constant
export const DivisionConst = ArithConst.define('DivisionConst', {}, {
    operSymbol: '÷',
    arithop: (i, j) => j == 0n ? i : i / j // as in IEEE Verilog
});
export const DivisionConstView = GateView;

// Modulo with constant
export const ModuloConst = ArithConst.define('ModuloConst', {}, {
    operSymbol: '%',
    arithop: (i, j) => j == 0n ? i : i % j // as in IEEE Verilog
});
export const ModuloConstView = GateView;

// Power with constant
export const PowerConst = ArithConst.define('PowerConst', {}, {
    operSymbol: '**',
    arithop: (i, j) => j >= 0n ? i ** j : i == 1n ? 1n : i == -1n ? (j % 2n ? -1n : 1n) : 0n
});
export const PowerConstView = GateView;

// Shift left operator
export const ShiftLeftConst = ShiftConst.define('ShiftLeftConst', {}, {
    operSymbol: '≪',
    shiftdir: -1
});
export const ShiftLeftConstView = GateView;

// Shift right operator
export const ShiftRightConst = ShiftConst.define('ShiftRightConst', {}, {
    operSymbol: '≫',
    shiftdir: 1
});
export const ShiftRightConstView = GateView;

// Less than operator
export const LtConst = CompareConst.define('LtConst', {}, {
    operSymbol: '<',
    arithcomp: (i, j) => i < j
});
export const LtConstView = GateView;

// Less than operator
export const LeConst = CompareConst.define('LeConst', {}, {
    operSymbol: '≤',
    arithcomp: (i, j) => i <= j
});
export const LeConstView = GateView;

// Less than operator
export const GtConst = CompareConst.define('GtConst', {}, {
    operSymbol: '>',
    arithcomp: (i, j) => i > j
});
export const GtConstView = GateView;

// Less than operator
export const GeConst = CompareConst.define('GeConst', {}, {
    operSymbol: '≥',
    arithcomp: (i, j) => i >= j
});
export const GeConstView = GateView;

// Equality operator
export const EqConst = EqCompareConst.define('EqConst', {}, {
    operSymbol: '=',
    bincomp: (i, j) => i.xnor(j).reduceAnd()
});
export const EqConstView = GateView;

// Nonequality operator
export const NeConst = EqCompareConst.define('NeConst', {}, {
    operSymbol: '≠',
    bincomp: (i, j) => i.xor(j).reduceOr()
});
export const NeConstView = GateView;

