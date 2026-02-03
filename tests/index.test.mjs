"use strict";

import _ from 'lodash';
import { HeadlessCircuit, getCellType } from '../lib/circuit.mjs';
import { Vector3vl } from '3vl';
import * as cells from '../lib/cells.mjs';
import { SynchEngine } from '../lib/engines/synch.mjs';
import { WorkerEngine } from '../lib/engines/worker.mjs';
import { transformCircuit } from '../lib/transform.mjs';

console.assert = (stmt, msg) => { if (!stmt) throw new Error(msg); };

function randInt(lb, ub) {
    return Math.floor((ub - lb + 1) * Math.random()) + lb;
}

function deepcopy(obj) {
    if (typeof obj !== "object" || obj === null)
        return obj;
    let res = Array.isArray(obj) ? [] : {};
    for (let key in obj)
        res[key] = deepcopy(obj[key]);
    return res;
}

class CircuitTestFixture {
    constructor(circ, inlist, outlist, engine) {
        this.circ_data = circ;
        this.inlist = inlist;
        this.outlist = outlist;
        beforeAll(() => {
            this.circuit = new HeadlessCircuit(this.circ_data, { engine, engineOptions: { workerURL: new URL('../lib/engines/worker-worker.js', require('url').pathToFileURL(__filename).toString()) }});
            this.circuit.observeGraph();
        });
        afterAll(() => {
            this.circuit.shutdown();
            this.circuit = null;
        });
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
        test("randomized logic table check", async () => {
            for (const ins of gen(100)) {
                await this.expect(ins, fun, opts);
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
        test("complete logic table check", async () => {
            for (const ins of gen()) {
                await this.expect(ins, fun, opts);
            }
        });
        return this;
    }
    testFun(fun, opts = {}) {
        const totbits = this.inlist.reduce((a, b) => a + b.bits, 0);
        if (totbits <= 6) return this.testFunComplete(fun, opts);
        else return this.testFunRandomized(fun, opts);
    }
    testJSON(json) {
        test("serialization test", async () => {
            let json1 = this.circuit.toJSON();
            // Make sure the object can be serialized as JSON
            let jsonstr1 = JSON.stringify(json1);
            if (json)
                expect(json1).toMatchObject(json);
            // Test round trip
            let circuit2 = new HeadlessCircuit(JSON.parse(jsonstr1));
            let json2 = circuit2.toJSON();
            expect(json2).toEqual(json1);
        });
        return this;
    }
    expect(ins, outs, opts) {
        if (opts.clock) return this.expectSeq(ins, outs, opts);
        else return this.expectComb(ins, outs, opts);
    }
    async expectSeq(ins, fun, opts = {}) {
        let message = Object.entries(ins).map(([a, x]) => a + ':' + x.toBin()).join(' ');;
        try {
            const outs = fun(ins, this.circuitOutputs());
            message += ' ' + Object.entries(outs).map(([a, x]) => a + ':' + x.toBin()).join(' ');;
            for (const [name, value] of Object.entries(ins)) {
                this.circuit.setInput(name, value);
            }
            await this.clockPulse(opts.clock, opts.clock_polarity, opts.timeout);
            for (const k in this.outlist) {
                expect(this.circuit.getOutput(this.outlist[k].name).toBin())
                    .toEqual(outs[this.outlist[k].name].toBin());
            }
        } catch (e) {
            e.message = message + '\n' + e.message;
            throw e;
        }
    }
    async expectComb(ins, fun, opts = {}) {
        let message = Object.entries(ins).map(([a, x]) => a + ':' + x.toBin()).join(' ');;
        try {
            const outs = fun(ins, this.circuitOutputs());
            message += ' ' + Object.entries(outs).map(([a, x]) => a + ':' + x.toBin()).join(' ');
            for (const [name, value] of Object.entries(ins)) {
                this.circuit.setInput(name, value);
            }
            await this.waitUntilStable(opts.timeout);
            for (const k in this.outlist) {
                expect(this.circuit.getOutput(this.outlist[k].name).toBin())
                    .toEqual(outs[this.outlist[k].name].toBin());
            }
        } catch (e) {
            e.message = message + '\n' + e.message;
            throw e;
        }
    }
    async waitUntilStable(timeout) {
        timeout = timeout || 2;
        await this.circuit.synchronize();
        for (let x = 0; x < timeout && this.circuit.hasPendingEvents; x++)
            await this.circuit.updateGates({ synchronous: true });
        expect(this.circuit.hasPendingEvents).toBeFalsy();
    }
    async clockPulse(clk, polarity, timeout) {
        await this.waitUntilStable(timeout);
        this.circuit.setInput(clk, Vector3vl.fromBool(!polarity));
        await this.waitUntilStable(timeout);
        this.circuit.setInput(clk, Vector3vl.fromBool(polarity));
        await this.waitUntilStable(timeout);
    }
}

class SingleCellTestFixture extends CircuitTestFixture {
    constructor(engine, celldata) {
        const inlist = [];
        const outlist = [];
        const celltype = celldata.type ? cells[celldata.type] : getCellType(celldata.celltype);
        const cell = new celltype(deepcopy(celldata));
        const circ = {
            "devices": {
                "dut": celldata
            },
            "connectors": []
        };
        for (const [name, sig] of Object.entries(cell.get("inputSignals"))) {
            inlist.push({name: name, bits: sig.bits});
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
            outlist.push({name: name, bits: sig.bits});
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
        super(circ, inlist, outlist, engine);
    }
};

class SingleCellConstTestFixture extends CircuitTestFixture {
    constructor(engine, celldata, constin) {
        const inlist = [];
        const outlist = [];
        const celltype = celldata.type ? cells[celldata.type] : getCellType(celldata.celltype);
        const cell = new celltype(deepcopy(celldata));
        const circ = {
            "devices": {
                "dut": celldata,
                "constin": {type: 'Constant', constant: constin.bits}
            },
            "connectors": []
        };
        for (const [name, sig] of Object.entries(cell.get("inputSignals"))) {
            if (name == constin.input) {
                circ.connectors.push({
                    from: {
                        id: "constin",
                        port: "out"
                    },
                    to: {
                        id: "dut",
                        port: name
                    }
                });
                continue;
            }
            inlist.push({name: name, bits: sig.bits});
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
            outlist.push({name: name, bits: sig.bits});
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
        const new_circ = transformCircuit(circ);
        super(new_circ, inlist, outlist, engine);
    }
};

const testBits = [1, 2, 3, 4, 16, 32, 48, 64];
const numTestBits = [1, 2, 3, 8, 32, 48];
const smallTestBits = [1, 48];

describe.each([
["synch", SynchEngine],
["worker", WorkerEngine]])('%s', (name, engine) => {

describe.each([
["$and",  s => ({ out: s.in1.and(s.in2) })],
["$or",   s => ({ out: s.in1.or(s.in2) })],
["$xor",  s => ({ out: s.in1.xor(s.in2) })],
["$nand", s => ({ out: s.in1.nand(s.in2) })],
["$nor",  s => ({ out: s.in1.nor(s.in2) })],
["$xnor", s => ({ out: s.in1.xnor(s.in2) })]])('%s', (name, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture(engine, {celltype: name, bits: bits})
            .testFun(fun);
    });
});

describe.each([
["$not",      s => ({ out: s.in.not() })],
["$repeater", s => ({ out: s.in })]])('%s', (name, fun) => {
    describe.each(testBits)('%i bits', (bits) => {
        new SingleCellTestFixture(engine, {celltype: name, bits: bits})
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
        new SingleCellTestFixture(engine, {celltype: name, bits: bits})
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
        new SingleCellTestFixture(engine, {celltype: name, groups: Array(ins).fill(Math.ceil(bits / ins))})
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
        new SingleCellTestFixture(engine, {celltype: name, bits: {in: bits, sel: ins}})
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
["Eq", comparefun((a, b) => a == b)],
["Ne", comparefun((a, b) => a != b)],
["Lt", comparefun((a, b) => a < b)],
["Le", comparefun((a, b) => a <= b)],
["Gt", comparefun((a, b) => a > b)],
["Ge", comparefun((a, b) => a >= b)],
])('%s', (name, fun) => {
    describe.each([
    [false, false],
    [true,  false],
    [false, true],
    [true,  true],
    ])('%s %s', (sgn1, sgn2) => {
        describe.each(numTestBits)('%i bits', (bits) => {
            new SingleCellTestFixture(engine, {type: name, bits: { in1: bits, in2: bits }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2), { no_random_x : true });
        });
        describe.each([[3, 8], [8, 3]])('%i bits to %i bits', (bits1, bits2) => {
            new SingleCellTestFixture(engine, {type: name, bits: { in1: bits1, in2: bits2 }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2), { no_random_x : true });
        });
    });
    describe.each([-4546263468923059135n, -10n, -2, -1, 0, 1, 2, 12n, 4546263468923059135n])('with constant %i', con => {
        describe.each([false, true])('%s', sgn => {
            describe.each(testBits)('%i bits', (bits) => {
                if (sgn && (con > 2**(bits-1) - 1 || con < -(2**(bits-1)))) return;
                if (!sgn && (con > 2**bits-1 || con < 0)) return;
                new SingleCellTestFixture(engine, {type: name + 'Const', leftOp: false, constant: con, bits: { in: bits }, signed: { in: sgn }})
                    .testFun(s => fun(sgn, sgn)({in1: s.in, in2: Vector3vl.fromNumber(con, bits)}), { no_random_x : true })
                    .testJSON();
                new SingleCellTestFixture(engine, {type: name + 'Const', leftOp: true, constant: con, bits: { in: bits }, signed: { in: sgn }})
                    .testFun(s => fun(sgn, sgn)({in2: s.in, in1: Vector3vl.fromNumber(con, bits)}), { no_random_x : true })
                    .testJSON();
            });
        });
    });
    describe.each(testBits)('with %i bits constant', (bits) => {
        describe.each([false, true])('%s', sgn => {
            const testcon = con => {
                const conbits = Vector3vl.fromNumber(con, bits);
                const conbin = conbits.toBin();
                new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits }, signed: { in1: sgn, in2: sgn }}, {input: 'in1', bits: conbin})
                    .testFun(s => fun(sgn, sgn)({in1: conbits, in2: s.in2}), { no_random_x : true })
                    .testJSON();
                new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits }, signed: { in1: sgn, in2: sgn }}, {input: 'in2', bits: conbin})
                    .testFun(s => fun(sgn, sgn)({in1: s.in1, in2: conbits}), { no_random_x : true })
                    .testJSON();
            };
            // This is the value range for which `integrateArithConstant`
            // will create a constant operation.
            testcon(randInt(0, 999));
            testcon(randInt(-99, -1));
            if (2**bits - 1 <= Number.MAX_SAFE_INTEGER)
                return;
            testcon(randInt(Number.MAX_SAFE_INTEGER + 1, 2**bits - 1));
            testcon(-randInt(Number.MAX_SAFE_INTEGER + 1, 2**bits - 1));
        });
    });
});

const truncate = x => x > 0 ? Math.floor(x) : Math.ceil(x);

describe.each([
["Addition", arithfun((a, b) => a + b)],
["Subtraction", arithfun((a, b) => a - b)],
["Multiplication", arithfun((a, b) => a * b)],
["Division", arithfun((a, b) => b == 0 ? a : truncate(a / b))],
["Modulo", arithfun((a, b) => b == 0 ? a : Math.sign(a) * (Math.abs(a) % Math.abs(b)))],
["Power", arithfun((a, b) => a == 1 ? 1 : a == -1 ? (b % 2 ? -1 : 1) : b < 0 ? 0 : a ** b)],
])('%s', (name, fun) => {
    describe.each([
    [false, false],
    [true,  false],
    [false, true],
    [true,  true],
    ])('%s %s', (sgn1, sgn2) => {
        describe.each(numTestBits)('%i bits', (bits) => {
            if (name == 'Multiplication' && bits >= 24) return; // tests use JS numbers
            if (name == 'Power' && bits >= 4) return; // power grows crazy fast
            new SingleCellTestFixture(engine, {type: name, bits: { in1: bits, in2: bits, out: bits }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2, bits), { no_random_x : true });
        });
        describe.each([[3, 8], [8, 3]])('%i bits to %i bits', (bits1, bits2) => {
            if (name == 'Power' && bits1 >= 4) return; // power grows crazy fast
            new SingleCellTestFixture(engine, {type: name, bits: { in1: bits1, in2: bits1, out: bits2 }, signed: { in1: sgn1, in2: sgn2 }})
                .testFun(fun(sgn1, sgn2, bits2), { no_random_x : true });
        });
    });
    describe.each([-21n, -2, -1, 0, 1, 2, 17n])('with constant %i', con => {
        describe.each([false, true])('%s', sgn => {
            describe.each(numTestBits)('%i bits', (bits) => {
                if (sgn && (con > 2**(bits-1) - 1 || con < -(2**(bits-1)))) return;
                if (!sgn && (con > 2**bits-1 || con < 0)) return;
                if (name == 'Multiplication' && bits >= 24) return; // tests use JS numbers
                if (name == 'Power' && bits >= 4) return; // power grows crazy fast
                new SingleCellTestFixture(engine, {type: name + 'Const', leftOp: false, constant: con, bits: { in: bits, out: bits }, signed: { in: sgn }})
                    .testFun(s => fun(sgn, sgn, bits)({in1: s.in, in2: Vector3vl.fromNumber(con, bits)}), { no_random_x : true })
                    .testJSON();
                new SingleCellTestFixture(engine, {type: name + 'Const', leftOp: true, constant: con, bits: { in: bits, out: bits }, signed: { in: sgn }})
                    .testFun(s => fun(sgn, sgn, bits)({in2: s.in, in1: Vector3vl.fromNumber(con, bits)}), { no_random_x : true })
                    .testJSON();
            });
        });
    });
    describe.each(testBits)('with %i bits constant', (bits) => {
        if (name == 'Power' && bits >= 4) return; // power grows crazy fast
        describe.each([false, true])('%s', sgn => {
            const testcon = (con) => {
                let testval = true;
                // tests use JS numbers
                if (name == 'Multiplication' && bits >= 24)
                    testval = false;
                else if (bits >= 53)
                    testval = false;
                const conbits = Vector3vl.fromNumber(con, bits);
                const conbin = conbits.toBin();
                const test1 = new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits, out: bits }, signed: { in1: sgn, in2: sgn }}, {input: 'in1', bits: conbin})
                    .testJSON();
                const test2 = new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits, out: bits }, signed: { in1: sgn, in2: sgn }}, {input: 'in2', bits: conbin})
                    .testJSON();
                if (testval) {
                    test1.testFun(s => fun(sgn, sgn, bits)({in1: conbits, in2: s.in2}), { no_random_x : true });
                    test2.testFun(s => fun(sgn, sgn, bits)({in1: s.in1, in2: conbits}), { no_random_x : true });
                }
            };
            // This is the value range for which `integrateArithConstant`
            // will create a constant operation.
            testcon(randInt(0, 999));
            testcon(randInt(-99, -1));
            if (2**bits - 1 <= Number.MAX_SAFE_INTEGER)
                return;
            testcon(randInt(Number.MAX_SAFE_INTEGER + 1, 2**bits - 1));
            testcon(-randInt(Number.MAX_SAFE_INTEGER + 1, 2**bits - 1));
        });
    });
});

describe.each([
["$neg", arithfun1(a => -a)],
["$pos", arithfun1(a => a)],
])('%s', (name, fun) => {
    describe.each([false, true])('%s', sgn => {
        describe.each(numTestBits)('%i bits', (bits) => {
            new SingleCellTestFixture(engine, {celltype: name, bits: { in: bits, out: bits }, signed: sgn })
                .testFun(fun(sgn, bits), { no_random_x : true });
        });
    });
});

describe('$constant', () => {
    describe.each([
    '', '0', '1', 'x',
    '00', '01', '0x', '10', '11', '1x', 'x0', 'x1', 'xx',
    ])('%s', (cbits) => {
        new SingleCellTestFixture(engine, {celltype: '$constant', constant: cbits })
            .testFun(s => ({ out: Vector3vl.fromBin(cbits) }));
    });
});

const standard_shift = (a, x, sgn, bits) => Array(Math.max(-x, 0, bits)).fill(sgn ? a[0] : '0').join('').concat(a.slice(0, x < 0 ? x : undefined)).concat(Array(Math.max(x, 0)).fill('0').join('')).slice(-bits);

describe.each([
["ShiftLeft", shiftfun(standard_shift)],
["ShiftRight", shiftfun((a, x, sgn, bits) => standard_shift(a, -x, sgn, bits))],
])('%s', (name, fun) => {
    describe.each([
    [false, false],
    [true,  false],
    [false, true],
    [true,  true],
    ])('%s %s', (sgn1, sgn2) => {
        describe.each(numTestBits)('%i bits', (bits) => {
            new SingleCellTestFixture(engine, {type: name, bits: { in1: bits, in2: Math.ceil(Math.log2(bits)) + 1, out: bits }, signed: { in1: sgn1, in2: sgn2, out: sgn1 }})
                .testFun(fun(sgn1, sgn2, bits), { no_random_x : true });
        });
        describe.each([[3, 8], [8, 3]])('%i bits to %i bits', (bits1, bits2) => {
            new SingleCellTestFixture(engine, {type: name, bits: { in1: bits1, in2: Math.ceil(Math.log2(Math.max(bits1, bits2))) + 1, out: bits2 }, signed: { in1: sgn1, in2: sgn2, out: sgn1 }})
                .testFun(fun(sgn1, sgn2, bits2), { no_random_x : true });
        });
    });
    describe.each([-4n, -2, -1, 0, 1, 2, 5n])('with constant %i', con => {
        describe.each([false, true])('%s', sgn => {
            describe.each(numTestBits)('%i bits', (bits) => {
                const bits2 = Math.ceil(Math.log2(bits)) + 1;
                new SingleCellTestFixture(engine, {type: name + 'Const', leftOp: false, constant: con, bits: { in: bits, out: bits }, signed: { in: sgn, out: sgn }})
                    .testFun(s => fun(sgn, con < 0, bits)({in1: s.in, in2: Vector3vl.fromNumber(con)}), { no_random_x : true })
                    .testJSON();
                if (sgn && (con > 2**(bits-1) - 1 || con < -(2**(bits-1)))) return;
                if (!sgn && (con > 2**bits-1 || con < 0)) return;
                new SingleCellTestFixture(engine, {type: name + 'Const', leftOp: true, constant: con, bits: { in: bits2, out: bits }, signed: { in: sgn, out: sgn }})
                    .testFun(s => fun(con < 0, sgn, bits)({in2: s.in, in1: Vector3vl.fromNumber(con, bits2)}), { no_random_x : true })
                    .testJSON();
            });
        });
    });
    describe.each(testBits)('with %i bits constant', (bits) => {
        describe.each([false, true])('%s', sgn => {
            const bits2 = Math.ceil(Math.log2(bits)) + 1;

            const con = randInt(0, Math.min(2**bits - 1, 999));
            const conbits = Vector3vl.fromNumber(con, bits);
            const conbin = conbits.toBin();
            new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits2, out: bits }, signed: { in1: sgn, in2: sgn, out: sgn }}, {input: 'in1', bits: conbin})
                .testFun(s => fun(sgn, sgn, bits)({in1: conbits, in2: s.in2}), { no_random_x : true })
                .testJSON();

            const ncon = -randInt(1, Math.min(2**(bits - 1), 99));
            const nconbits = Vector3vl.fromNumber(ncon, bits);
            const nconbin = nconbits.toBin();
            new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits2, out: bits }, signed: { in1: true, in2: sgn, out: true }}, {input: 'in1', bits: nconbin})
                .testFun(s => fun(true, sgn, bits)({in1: nconbits, in2: s.in2}), { no_random_x : true })
                .testJSON();

            const con2 = randInt(0, bits - 1);
            const conbits2 = Vector3vl.fromNumber(con2, bits2);
            const conbin2 = conbits2.toBin();
            new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits2, out: bits }, signed: { in1: sgn, in2: sgn, out: sgn }}, {input: 'in2', bits: conbin2})
                .testFun(s => fun(sgn, sgn, bits)({in1: s.in1, in2: conbits2}), { no_random_x : true })
                .testJSON();

            const ncon2 = -randInt(1, bits - 1);
            const nconbits2 = Vector3vl.fromNumber(ncon2, bits2);
            const nconbin2 = nconbits2.toBin();
            new SingleCellConstTestFixture(engine, {type: name, bits: { in1: bits, in2: bits2, out: bits }, signed: { in1: sgn, in2: true, out: sgn }}, {input: 'in2', bits: nconbin2})
                .testFun(s => fun(sgn, true, bits)({in1: s.in1, in2: nconbits2}), { no_random_x : true })
                .testJSON();
        });
    });
});

describe.each([
["$zeroextend", pbits => s => ({ out: s.in.concat(Vector3vl.zeros(pbits)) })],
["$signextend", pbits => s => ({ out: s.in.concat(Vector3vl.make(pbits, s.in.get(s.in.bits - 1))) })],
])('%s', (name, fun) => {
    describe.each(numTestBits)('%i bits', (bits) => {
        describe.each([0,1,4])('plus %i bits', (pbits) => {
            new SingleCellTestFixture(engine, {celltype: name, extend: { input: bits, output: bits + pbits }})
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
            new SingleCellTestFixture(engine, {celltype: '$busslice', slice: { first: b1, count: b2 - b1 }})
                .testFun(s => ({ out: s.in.slice(b1, b2) }));
        });
    });
});

// TODO: better tests for stateful cells

describe('$dff', () => {
    describe.each(smallTestBits)('%i bits', (bits) => {
        describe.each([true, false])('enable polarity %s', (en_pol) => {
            describe("default initialization to undefined", () => {
                new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, polarity: {enable: en_pol}})
                    .testFun(s => ({out: Vector3vl.xes(bits)}), {fixed: {en: Vector3vl.fromBool(!en_pol)}});
            });
            describe.each([true, false])("initialization with %s", (initbit) => {
                new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, initial: Vector3vl.fromBool(initbit, bits).toBin(), polarity: {enable: en_pol}})
                    .testFun(s => ({out: Vector3vl.fromBool(initbit, bits)}), {fixed: {en: Vector3vl.fromBool(!en_pol)}});
            });
            describe("latching behavior", () => {
                new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, polarity: {enable: en_pol}})
                    .testFun((s, old) => ({out: s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }));
            });
            describe.each([true, false])('reset polarity %s', (arst_pol) => {
                describe("latching behavior with default reset", () => {
                    new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, polarity: {enable: en_pol, arst: arst_pol}})
                        .testFun((s, old) => ({out: s.arst.eq(Vector3vl.fromBool(arst_pol)) ? Vector3vl.zeros(bits) : s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }));
                });
                describe.each([true, false])("latching behavior with reset to %s", (arst_val) => {
                    new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, polarity: {enable: en_pol, arst: arst_pol}, arst_value: Vector3vl.fromBool(arst_val, bits).toBin()})
                        .testFun((s, old) => ({out: s.arst.eq(Vector3vl.fromBool(arst_pol)) ? Vector3vl.fromBool(arst_val, bits) : s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }));
                });
            });
            describe.each([true, false])('clock polarity %s', (clk_pol) => {
                new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, polarity: {clock: clk_pol, enable: en_pol}})
                    .testFun((s, old) => ({out: s.en.eq(Vector3vl.fromBool(en_pol)) ? s.in : old.out }), {clock: 'clk', clock_polarity: clk_pol});
            });
        });
        describe.each([true, false])('clock polarity %s', (clk_pol) => {
            new SingleCellTestFixture(engine, {celltype: '$dff', bits: bits, polarity: {clock: clk_pol}})
                .testFun((s, old) => ({out: s.in}), {clock: 'clk', clock_polarity: clk_pol});
        });
    });
});

describe('$fsm', () => {
    const parity_moore = {
        bits: {in: 1, out: 1},
        init_state: 0,
        states: 2,
        trans_table: [
            {state_in: 0, state_out: 0, ctrl_in: '0', ctrl_out: '0'},
            {state_in: 0, state_out: 1, ctrl_in: '1', ctrl_out: '0'},
            {state_in: 1, state_out: 1, ctrl_in: '0', ctrl_out: '1'},
            {state_in: 1, state_out: 0, ctrl_in: '1', ctrl_out: '1'},
        ]
    };
    const parity_moore_trans = (st, i) => (st + i.toNumber()) % 2;
    const parity_moore_out   = (st, _) => Vector3vl.fromNumber(st, 1);
    const parity_mealy = {
        bits: {in: 1, out: 1},
        init_state: 0,
        states: 2,
        trans_table: [
            {state_in: 0, state_out: 0, ctrl_in: '0', ctrl_out: '0'},
            {state_in: 0, state_out: 1, ctrl_in: '1', ctrl_out: '1'},
            {state_in: 1, state_out: 1, ctrl_in: '0', ctrl_out: '1'},
            {state_in: 1, state_out: 0, ctrl_in: '1', ctrl_out: '0'},
        ]
    };
    const parity_mealy_trans = (st, i) => (st + i.toNumber()) % 2;
    const parity_mealy_out   = (st, i) => Vector3vl.fromNumber(parity_mealy_trans(st, i), 1);
    const parity2 = {
        bits: {in: 2, out: 2},
        init_state: 0,
        states: 2,
        trans_table: [
            {state_in: 0, state_out: 0, ctrl_in: 'x0', ctrl_out: '00'},
            {state_in: 0, state_out: 1, ctrl_in: 'x1', ctrl_out: '01'},
            {state_in: 1, state_out: 1, ctrl_in: '0x', ctrl_out: '11'},
            {state_in: 1, state_out: 0, ctrl_in: '1x', ctrl_out: '10'},
        ]
    };
    const parity2_trans = (st, i) => (st + i.slice(st, st+1).toNumber()) % 2;
    const parity2_out   = (st, i) => Vector3vl.fromNumber(parity2_trans(st, i), 1).concat(Vector3vl.fromNumber(st, 1));
    describe.each([
        ["parity_moore", parity_moore, parity_moore_trans, parity_moore_out],
        ["parity_mealy", parity_mealy, parity_mealy_trans, parity_mealy_out],
        ["parity2",      parity2,      parity2_trans,      parity2_out]
    ])('automaton %s', (x, orig_test_automaton, trans, out) => {
        describe.each([true, false])('clock polarity %s', clk_pol => {
            describe.each([true, false])('reset polarity %s', arst_pol => {
                const test_automaton = _.clone(orig_test_automaton);
                _.assign(test_automaton, {
                    celltype: '$fsm',
                    polarity: { clock: clk_pol, arst: arst_pol }
                });
                let state = test_automaton.init_state;
                new SingleCellTestFixture(engine, test_automaton)
                    .testFunRandomized(s => ({out: out(test_automaton.init_state, s.in)}), {no_random_x: true, fixed: {arst: Vector3vl.fromBool(arst_pol)}})
                    .testFunRandomized(s => { state = trans(state, s.in); return {out: out(state, s.in)}}, {no_random_x: true, fixed: {arst: Vector3vl.fromBool(!arst_pol)}, clock: 'clk', clock_polarity: clk_pol});
            });
        });
    });
});

describe('order', () => {
    // A circuit with order parameters on the ports
    const circuit = {
        subcircuits: {
            sub_mod: {
                devices: {
                    dev0: { type: "Input", net: "in1", order: 0, bits: 1 },
                    dev1: { type: "Input", net: "in2", order: 1, bits: 1 },
                    dev2: { type: "Output", net: "out1", order: 2, bits: 1 },
                    dev3: { type: "Output", net: "out2", order: 3, bits: 1 }
                },
                connectors: []
            }
        },
        devices: {
            dev0: { type: "Button", net: "in1", order: 0, bits: 1, label: "in1" },
            dev1: { type: "Button", net: "in2", order: 1, bits: 1, label: "in2" },
            dev2: { type: "Lamp", net: "out1", order: 2, bits: 1, label: "out1" },
            dev3: { type: "Lamp", net: "out2", order: 3, bits: 1, label: "out2" },
            dev4: { label: "m", type: "Subcircuit", celltype: "sub_mod" }
        },
        connectors: [
            { to: { id: "dev4", port: "in1" }, from: { id: "dev0", port: "out" }, name: "in1" },
            { to: { id: "dev4", port: "in2" }, from: { id: "dev1", port: "out" }, name: "in2" },
            { to: { id: "dev2", port: "in" }, from: { id: "dev4", port: "out1" }, name: "out1" },
            { to: { id: "dev3", port: "in" }, from: { id: "dev4", port: "out2" }, name: "out2" }
        ]
    };
    const inlist = [{ name: 'in1', bits: 1 }, { name: 'in2', bits: 1 }];
    const outlist = [{ name: 'out1', bits: 1 }, { name: 'out2', bits: 1 }];
    new CircuitTestFixture(circuit, inlist, outlist, engine)
        .testJSON(circuit);
});

});

// TODO: tests for public circuit interface

