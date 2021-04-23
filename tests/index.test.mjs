"use strict";

import 'core-js';
import 'regenerator-runtime/runtime';
import { HeadlessCircuit, getCellType } from '../src/circuit.mjs';
import { Vector3vl } from '3vl';

console.assert = (stmt, msg) => { if (!stmt) throw new Error(msg); };

class SingleCellTestFixture {
    constructor(celldata) {
        this.inlist = [];
        this.outlist = [];
        const celltype = getCellType(celldata.celltype);
        const cell = new celltype(JSON.parse(JSON.stringify(celldata)));
        const circ = {
            "devices": {
                "dut": celldata
            },
            "connectors": []
        };
        for (const [name, sig] of Object.entries(cell.get("inputSignals"))) {
            this.inlist.push({name: name, bits: sig.bits});
            circ.devices[name] = {
                celltype: "$input",
                bits: sig.bits
            };
            circ.connectors.push({
                from: {
                    id: name,
                    port: "out"
                },
                to: {
                    id: "dut",
                    port: name
                }
            });
        }
        for (const [name, sig] of Object.entries(cell.get("outputSignals"))) {
            this.outlist.push({name: name, bits: sig.bits});
            circ.devices[name] = {
                celltype: "$output",
                bits: sig.bits
            };
            circ.connectors.push({
                from: {
                    id: "dut",
                    port: name
                },
                to: {
                    id: name,
                    port: "in"
                }
            });
        }
        this.circuit = new HeadlessCircuit(circ);
    }
    circuitOutputs() {
        let ret = {};
        for (const k in this.outlist) {
            ret[this.outlist[k].name] = this.circuit.getOutput(this.outlist[k].name);
        }
        return ret;
    }
    test(testname, f) {
        test(testname, () => { f(this.circuit) });
    }
    testFunRandomized(fun, opts = {}) {
        const me = this;
        const randtrit = x => Math.floor(3 * Math.random() - 1);
        const randbit  = x => 2 * Math.floor(2 * Math.random()) - 1;
        const rand = opts.no_random_x ? randbit : randtrit;
        function randtest() {
            const ret = {};
            for (const x of me.inlist) {
                if (x.name == opts.clock) continue;
                if (opts.fixed && opts.fixed[x.name]) ret[x.name] = opts.fixed[x.name];
                else ret[x.name] = Vector3vl.fromArray(Array(x.bits).fill(0).map(rand));
            }
            return ret;
        }
        function* gen(tries) {
            for (const k of Array(tries).keys()) {
                yield randtest();
            }
        }
        test("randomized logic table check", () => {
            for (const ins of gen(100)) {
                this.expect(ins, fun, opts);
            }
        });
        return this;
    }
    testFunComplete(fun, opts = {}) {
        const me = this;
        const set = opts.no_random_x ? [-1, 1] : [-1, 0, 1];
        function bitgen(n) {
            const bits = [];
            function* rec() {
                if (bits.length == n) yield bits;
                else {
                    for (const bit of set) {
                        bits.push(bit);
                        yield* rec();
                        bits.pop();
                    }
                }
            }
            return rec();
        }
        function gen() {
            const ins = {};
            function* rec(level) {
                if (level == me.inlist.length) yield ins;
                else if (me.inlist[level].name == opts.clock) {
                    yield* rec(level+1);
                } else if (opts.fixed && opts.fixed[me.inlist[level].name]) {
                    ins[me.inlist[level].name] = opts.fixed[me.inlist[level].name];
                    yield* rec(level+1);
                } else {
                    for (const bits of bitgen(me.inlist[level].bits)) {
                        ins[me.inlist[level].name] = Vector3vl.fromArray(bits);
                        yield* rec(level+1);
                    }
                }
            }
            return rec(0);
        }
        test("complete logic table check", () => {
            for (const ins of gen()) {
                this.expect(ins, fun, opts);
            }
        });
        return this;
    }
    testFun(fun, opts = {}) {
        const totbits = this.inlist.reduce((a, b) => a + b.bits, 0);
        if (totbits <= 6) return this.testFunComplete(fun, opts);
        else return this.testFunRandomized(fun, opts);
    }
    expect(ins, outs, opts) {
        if (opts.clock) this.expectSeq(ins, outs, opts);
        return this.expectComb(ins, outs, opts);
    }
    expectSeq(ins, fun, opts = {}) {
        let message = Object.entries(ins).map(([a, x]) => a + ':' + x.toBin()).join(' ');;
        try {
            const outs = fun(ins, this.circuitOutputs());
            message += ' ' + Object.entries(outs).map(([a, x]) => a + ':' + x.toBin()).join(' ');;
            for (const [name, value] of Object.entries(ins)) {
                this.circuit.setInput(name, value);
            }
            this.clockPulse(opts.clock, opts.clock_polarity, opts.timeout);
            for (const k in this.outlist) {
                expect(this.circuit.getOutput(this.outlist[k].name).toBin())
                    .toEqual(outs[this.outlist[k].name].toBin());
            }
        } catch (e) {
            e.message = message + '\n' + e.message;
            throw e;
        }
    }
    expectComb(ins, fun, opts = {}) {
        let message = Object.entries(ins).map(([a, x]) => a + ':' + x.toBin()).join(' ');;
        try {
            const outs = fun(ins, this.circuitOutputs());
            message += ' ' + Object.entries(outs).map(([a, x]) => a + ':' + x.toBin()).join(' ');
            for (const [name, value] of Object.entries(ins)) {
                this.circuit.setInput(name, value);
            }
            this.waitUntilStable(opts.timeout);
            for (const k in this.outlist) {
                expect(this.circuit.getOutput(this.outlist[k].name).toBin())
                    .toEqual(outs[this.outlist[k].name].toBin());
            }
        } catch (e) {
            e.message = message + '\n' + e.message;
            throw e;
        }
    }
    waitUntilStable(timeout) {
        timeout = timeout || 2;
        for (let x = 0; x < timeout && this.circuit.hasPendingEvents; x++)
            this.circuit.updateGates();
        expect(this.circuit.hasPendingEvents).toBeFalsy();
    }
    clockPulse(clk, polarity, timeout) {
        this.waitUntilStable(timeout);
        this.circuit.setInput(clk, Vector3vl.fromBool(!polarity));
        this.waitUntilStable(timeout);
        this.circuit.setInput(clk, Vector3vl.fromBool(polarity));
        this.waitUntilStable(timeout);        
    }
};

const testBits = [1, 2, 3, 4, 16, 32, 48, 64];
const numTestBits = [1, 2, 3, 8, 32, 48];
const smallTestBits = [1, 48];

describe.each([
["$and",  s => ({ out: s.in1.and(s.in2) })],
["$or",   s => ({ out: s.in1.or(s.in2) })],
["$xor",  s => ({ out: s.in1.xor(s.in2) })],
["$nand", s => ({ out: s.in1.nand(s.in2) })],
["$nor",  s => ({ out: s.in1.nor(s.in2) })],
["$xnor", s => ({ out: s.in1.xnor(s.in2) })]])('%s', (name, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: bits})
            .testFun(fun);
    });
});

describe.each([
["$not",      s => ({ out: s.in.not() })],
["$repeater", s => ({ out: s.in })]])('%s', (name, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: bits})
            .testFun(fun);
    });
});

describe.each([
["$reduce_and",  s => ({ out: s.in.reduceAnd() })],
["$reduce_or",   s => ({ out: s.in.reduceOr() })],
["$reduce_xor",  s => ({ out: s.in.reduceXor() })],
["$reduce_nand", s => ({ out: s.in.reduceNand() })],
["$reduce_nor",  s => ({ out: s.in.reduceNor() })],
["$reduce_xnor", s => ({ out: s.in.reduceXnor() })]])('%s', (name, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: bits})
            .testFun(fun);
    });
});

describe.each([
["$busgroup", 1, s => ({ out: s.in0 })],
["$busgroup", 2, s => ({ out: Vector3vl.concat(s.in0, s.in1) })],
["$busungroup", 1, s => ({ out0: s.in })],
["$busungroup", 2, s => ({ out0: s.in.slice(0, Math.ceil(s.in.bits / 2)), out1: s.in.slice(Math.ceil(s.in.bits / 2)) })],
])('%s %i-port', (name, ins, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, groups: Array(ins).fill(Math.ceil(bits / ins))})
            .testFun(fun);
    });
});

const muxfun = ins => s => ({ out: s.sel.isFullyDefined ? ins(s)[parseInt(s.sel.toBin(), 2)] : Vector3vl.xes(s.in0.bits) });
const pmuxfun = ins => s => ({ out: s.sel.isFullyDefined && s.sel.toBin().split('').filter(x => x == '1').length <= 1 ? ins(s)[s.sel.toBin().split('').reverse().join('').indexOf('1') + 1] : Vector3vl.xes(s.in0.bits)});

describe.each([
["$mux", 1, muxfun(s => [s.in0, s.in1])],
["$mux", 2, muxfun(s => [s.in0, s.in1, s.in2, s.in3])],
["$pmux", 1, pmuxfun(s => [s.in0, s.in1, s.in2])],
["$pmux", 2, pmuxfun(s => [s.in0, s.in1, s.in2, s.in3, s.in4])],
])('%s %i-select', (name, ins, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: {in: bits, sel: ins}})
            .testFun(fun);
    });
});

const parseIntSign = (x, sgn) => parseInt(x, 2) - (sgn && x[0] == '1' ? (2 ** x.length) : 0);

const intToStringSign = (x, bits) => !isFinite(x) ? Array(bits).fill('x').join('') : x >= 0 ? (Array(bits).fill('0').join('') + x.toString(2)).slice(-bits) : (2 ** 50 + x).toString(2).slice(-bits);

const comparefun = f => (sgn1, sgn2) => s => ({ out: s.in1.isFullyDefined && s.in2.isFullyDefined ? Vector3vl.fromBool(f(parseIntSign(s.in1.toBin(), sgn1 && sgn2), parseIntSign(s.in2.toBin(), sgn1 && sgn2))) : Vector3vl.x });

const arithfun = f => (sgn1, sgn2, bits) => s => ({ out: s.in1.isFullyDefined && s.in2.isFullyDefined ? Vector3vl.fromBin(intToStringSign(f(parseIntSign(s.in1.toBin(), sgn1 && sgn2), parseIntSign(s.in2.toBin(), sgn1 && sgn2)), bits)) : Vector3vl.xes(bits) });

const arithfun1 = f => (sgn, bits) => s => ({ out: s.in.isFullyDefined ? Vector3vl.fromBin(intToStringSign(f(parseIntSign(s.in.toBin(), sgn)), bits)) : Vector3vl.xes(bits) });

const shiftfun = f => (sgn1, sgn2, bits) => s => ({ out: s.in2.isFullyDefined ? Vector3vl.fromBin(f(s.in1.toBin(), parseIntSign(s.in2.toBin(), sgn2), sgn1, bits)) : Vector3vl.xes(bits) });

describe.each([
["$eq", comparefun((a, b) => a == b)],
["$ne", comparefun((a, b) => a != b)],
["$lt", comparefun((a, b) => a < b)],
["$le", comparefun((a, b) => a <= b)],
["$gt", comparefun((a, b) => a > b)],
["$ge", comparefun((a, b) => a >= b)],
])('%s', (name, fun) => {
    describe.each([
    [false, false],
    [true,  false],
    [false, true],
    [true,  true],
    ])('%s %s', (sgn1, sgn2) => {
        describe.each(numTestBits)('%i bits', (bits) => {
            new SingleCellTestFixture({celltype: name, bits: { in1: bits, in2: bits }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2), { no_random_x : true });
        });
        describe.each([[3, 8], [8, 3]])('%i bits to %i bits', (bits1, bits2) => {
            new SingleCellTestFixture({celltype: name, bits: { in1: bits1, in2: bits2 }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2), { no_random_x : true });
        });
    });
});

const truncate = x => x > 0 ? Math.floor(x) : Math.ceil(x);

describe.each([
["$add", arithfun((a, b) => a + b)],
["$sub", arithfun((a, b) => a - b)],
["$mul", arithfun((a, b) => a * b)],
["$div", arithfun((a, b) => b == 0 ? a : truncate(a / b))],
["$mod", arithfun((a, b) => b == 0 ? a : Math.sign(a) * (Math.abs(a) % Math.abs(b)))],
["$pow", arithfun((a, b) => a == 1 ? 1 : a == -1 ? (b % 2 ? -1 : 1) : b < 0 ? 0 : a ** b)],
])('%s', (name, fun) => {
    describe.each([
    [false, false],
    [true,  false],
    [false, true],
    [true,  true],
    ])('%s %s', (sgn1, sgn2) => {
        describe.each(numTestBits)('%i bits', (bits) => {
            if (name == '$mul' && bits >= 24) return; // tests use JS numbers
            if (name == '$pow' && bits >= 4) return; // power grows crazy fast
            new SingleCellTestFixture({celltype: name, bits: { in1: bits, in2: bits, out: bits }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2, bits), { no_random_x : true });
        });
        describe.each([[3, 8], [8, 3]])('%i bits to %i bits', (bits1, bits2) => {
            if (name == '$pow' && bits1 >= 4) return; // power grows crazy fast
            new SingleCellTestFixture({celltype: name, bits: { in1: bits1, in2: bits1, out: bits2 }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2, bits2), { no_random_x : true });
        });
    });
});

describe.each([
["$neg", arithfun1(a => -a)],
["$pos", arithfun1(a => a)],
])('%s', (name, fun) => {
    describe.each([false, true])('%s', sgn => {
        describe.each(numTestBits)('%i bits', (bits) => {
            new SingleCellTestFixture({celltype: name, bits: { in: bits, out: bits }, signed: sgn })
                .testFun(fun(sgn, bits), { no_random_x : true });
        });
    });
});

describe('$constant', () => {
    describe.each([
    '', '0', '1', 'x',
    '00', '01', '0x', '10', '11', '1x', 'x0', 'x1', 'xx',
    ])('%s', (cbits) => {
        new SingleCellTestFixture({celltype: '$constant', constant: cbits })
            .testFun(s => ({ out: Vector3vl.fromBin(cbits) }));
    });
});

const standard_shift = (a, x, sgn, bits) => Array(Math.max(-x, 0, bits)).fill(sgn ? a[0] : '0').join('').concat(a.slice(0, x < 0 ? x : undefined)).concat(Array(Math.max(x, 0)).fill('0').join('')).slice(-bits);

describe.each([
["$shl", shiftfun(standard_shift)],
["$shr", shiftfun((a, x, sgn, bits) => standard_shift(a, -x, sgn, bits))],
])('%s', (name, fun) => {
    describe.each([
    [false, false],
    [true,  false],
    [false, true],
    [true,  true],
    ])('%s %s', (sgn1, sgn2) => {
        describe.each(numTestBits)('%i bits', (bits) => {
            new SingleCellTestFixture({celltype: name, bits: { in1: bits, in2: Math.ceil(Math.log2(bits)) + 1, out: bits }, signed: { in1: sgn1, in2: sgn2, out: sgn1 }})
                .testFun(fun(sgn1, sgn2, bits), { no_random_x : true });
        });
        describe.each([[3, 8], [8, 3]])('%i bits to %i bits', (bits1, bits2) => {
            new SingleCellTestFixture({celltype: name, bits: { in1: bits1, in2: Math.ceil(Math.log2(Math.max(bits1, bits2))) + 1, out: bits2 }, signed: { in1: sgn1, in2: sgn2, out: sgn1 }})
                .testFun(fun(sgn1, sgn2, bits2), { no_random_x : true });
        });
    });
});

describe.each([
["$zeroextend", pbits => s => ({ out: s.in.concat(Vector3vl.zeros(pbits)) })],
["$signextend", pbits => s => ({ out: s.in.concat(Vector3vl.make(pbits, s.in.get(s.in.bits - 1))) })],
])('%s', (name, fun) => {
    describe.each(numTestBits)('%i bits', (bits) => {
        describe.each([0,1,4])('plus %i bits', (pbits) => {
            new SingleCellTestFixture({celltype: name, extend: { input: bits, output: bits + pbits }})
                .testFun(fun(pbits));
        });
    });
});

describe('$busslice', () => {
    describe.each(numTestBits)('%i bits', (bits) => {
        describe.each([
        [0, bits],
        [0, Math.ceil(bits/2)],
        [Math.floor(bits/2), bits],
        ])('%i-%i', (b1, b2) => {
            new SingleCellTestFixture({celltype: '$busslice', slice: { first: b1, count: b2 - b1 }})
                .testFun(s => ({ out: s.in.slice(b1, b2) }));
        });
    });
});

// TODO: better tests for stateful cells

describe('$dff', () => {
    describe.each(smallTestBits)('%i bits', (bits) => {
        describe.each([true, false])('enable polarity %s', (en_pol) => {
            describe("default initialization to undefined", () => {
                new SingleCellTestFixture({celltype: '$dff', bits: bits, polarity: {enable: en_pol}})
                    .testFun(s => ({out: Vector3vl.xes(bits)}), {fixed: {en: Vector3vl.fromBool(!en_pol)}});
            });
            describe.each([true, false])("initialization with %s", (initbit) => {
                new SingleCellTestFixture({celltype: '$dff', bits: bits, initial: Vector3vl.fromBool(initbit, bits).toBin(), polarity: {enable: en_pol}})
                    .testFun(s => ({out: Vector3vl.fromBool(initbit, bits)}), {fixed: {en: Vector3vl.fromBool(!en_pol)}});
            });
            describe("latching behavior", () => {
                new SingleCellTestFixture({celltype: '$dff', bits: bits, polarity: {enable: en_pol}})
                    .testFun((s, old) => ({out: s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }));
            });
            describe.each([true, false])('reset polarity %s', (arst_pol) => {
                describe("latching behavior with default reset", () => {
                    new SingleCellTestFixture({celltype: '$dff', bits: bits, polarity: {enable: en_pol, arst: arst_pol}})
                        .testFun((s, old) => ({out: s.arst.eq(Vector3vl.fromBool(arst_pol)) ? Vector3vl.zeros(bits) : s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }));
                });
                describe.each([true, false])("latching behavior with reset to %s", (arst_val) => {
                    new SingleCellTestFixture({celltype: '$dff', bits: bits, polarity: {enable: en_pol, arst: arst_pol}, arst_value: Vector3vl.fromBool(arst_val, bits).toBin()})
                        .testFun((s, old) => ({out: s.arst.eq(Vector3vl.fromBool(arst_pol)) ? Vector3vl.fromBool(arst_val, bits) : s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }));
                });
            });
            describe.each([true, false])('clock polarity %s', (clk_pol) => {
                new SingleCellTestFixture({celltype: '$dff', bits: bits, polarity: {clock: clk_pol, enable: en_pol}})
                    .testFun((s, old) => ({out: s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }), {clock: 'clk', clock_polarity: clk_pol});
            });
        });
        describe.each([true, false])('clock polarity %s', (clk_pol) => {
            new SingleCellTestFixture({celltype: '$dff', bits: bits, polarity: {clock: clk_pol}})
                .testFun((s, old) => ({out: s.in}), {clock: 'clk', clock_polarity: clk_pol});
        });
    });
});

// TODO: tests for public circuit interface

