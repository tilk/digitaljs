
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
    testFun(testname, fun) {
        var ins = [];
        var rec = () => {
            if (ins.length == this.inlist.length) {
                for (const k in this.inlist) {
                    this.circuit.setInput(this.inlist[k].name, ins[k]);
                }
                this.circuit.updateGates(); // propagate input change
                this.circuit.updateGates(); // propagate gate delay
                const outs = fun(...ins);
                for (const k in this.outlist) {
                    expect(this.circuit.getOutput(this.outlist[k].name).toArray())
                        .toEqual(outs[k].toArray());
                }
            } else {
                var bits = [];
                var rec2 = () => {
                    if (bits.length == this.inlist[ins.length].bits) {
                        ins.push(Vector3vl.fromArray(bits));
                        rec();
                        ins.pop();
                    } else {
                        for (const bit of [-1, 0, 1]) {
                            bits.push(bit);
                            rec2();
                            bits.pop();
                        }
                    }
                }
                rec2();
            }
        };
        test(testname, rec);
    }
};

describe.each([
["$and",  (i1, i2) => [i1.and(i2)]],
["$or",   (i1, i2) => [i1.or(i2)]],
["$xor",  (i1, i2) => [i1.xor(i2)]],
["$nand", (i1, i2) => [i1.nand(i2)]],
["$nor",  (i1, i2) => [i1.nor(i2)]],
["$xnor", (i1, i2) => [i1.xnor(i2)]]])('%s', (name, fun) => {
    describe.each([1, 2])('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: bits})
            .testFun("logic table check", fun);
    });
});

describe.each([
["$not",  i => [i.not()]],
["$repeater", i => [i]]])('%s', (name, fun) => {
    describe.each([1, 4])('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: bits})
            .testFun("logic table check", fun);
    });
});

describe.each([
["$reduce_and",  i => [i.reduceAnd()]],
["$reduce_or",  i => [i.reduceOr()]],
["$reduce_xor",  i => [i.reduceXor()]],
["$reduce_nand",  i => [i.reduceNand()]],
["$reduce_nor",  i => [i.reduceNor()]],
["$reduce_xnor",  i => [i.reduceXnor()]]])('%s', (name, fun) => {
    describe.each([1, 4])('%i bits', (bits) => {
        new SingleCellTestFixture({celltype: name, bits: bits})
            .testFun("logic table check", fun);
    });
});


