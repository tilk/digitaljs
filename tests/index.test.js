"use strict";

import { HeadlessCircuit, getCellType } from '../dist/main.js';
import { Vector3vl } from '3vl';

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
    test(testname, f) {
        test(testname, () => { f(this.circuit) });
    }
    testFunRandomized(fun) {
        const me = this;
        function randtest() {
            const ret = {};
            for (const x of me.inlist) {
                ret[x.name] = Vector3vl.fromArray(Array(x.bits).fill(0).map(x => Math.floor(3 * Math.random() - 1)));
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
                this.expectComb(ins, fun(ins));
            }
        });
    }
    testFunComplete(fun) {
        const me = this;
        function bitgen(n) {
            const bits = [];
            function* rec() {
                if (bits.length == n) yield bits;
                else {
                    for (const bit of [-1, 0, 1]) {
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
                else {
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
                this.expectComb(ins, fun(ins));
            }
        });
    }
    testFun(fun) {
        const totbits = this.inlist.reduce((a, b) => a + b.bits, 0);
        if (totbits <= 6) this.testFunComplete(fun);
        else this.testFunRandomized(fun);
    }
    expectComb(ins, outs) {
        for (const [name, value] of Object.entries(ins)) {
            this.circuit.setInput(name, value);
        }
        this.circuit.updateGates(); // propagate input change
        this.circuit.updateGates(); // propagate gate delay
        for (const k in this.outlist) {
            expect(this.circuit.getOutput(this.outlist[k].name).toArray())
                .toEqual(outs[this.outlist[k].name].toArray());
        }
    }
};

const testBits = [1, 2, 3, 4, 16, 32, 48, 64];

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

