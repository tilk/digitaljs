"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import * as help from '../help';
import { Vector3vl } from '3vl';

const and_path = "M19 4v32h16c9 0 16-7 16-16S44 4 35 4H20z";
const or_path = "M14.3 4l1.6 2s4.5 5.6 4.5 14-4.5 14-4.5 14l-1.6 2H28c3.8 0 16.6-.5 25-16h0A28 28 0 0028 4H16.8z";
const buf_path = "M18 2v36l2-1 32-17h0L20 3z";
const xor_arc_path = "M6.8 2.8L10 6.7S14.2 12 14.2 20 10 33.3 10 33.3l-3.2 3.9H10l1.7-2.4s4.8-6 4.8-14.8c0-8.9-4.8-14.8-4.8-14.8l-1.7-2.4z";
    
const xor_arc_path_markup = {
    tagName: 'path',
    selector: 'xor_arc',
    attributes: {
        'fill': "#000",
        'd': xor_arc_path
    }
};

const neg_markup = {
    tagName: 'circle',
    className: 'body',
    selector: 'neg_bubble',
    attributes: {
        'stroke': "#000",
        'stroke-width': '2px',
        'cx': 56,
        'cy': 20,
        'r': 4
    }
};

function gateMarkup(children = []) {
    return {
        tagName: 'g',
        selector: 'body',
        children: [
            {
                tagName: 'path',
                className: 'body gate',
                selector: 'gate'
            }
        ].concat(children)
    }
}

// base class for gates
export const GateSVG = Gate.define('GateSVG', {
    /* default properties */
    bits: 1,

    size: { width: 60, height: 40 },
    ports: {
        groups: {
            'in': { position: { name: 'left', args: { dx: 40 } }, attrs: { wire: { x2: -60 }, port: { refX: -60 } }, z: -1 },
            'out': { position: { name: 'right', args: { dx: -40 } }, attrs: { wire: { x2: 60 }, port: { refX: 60 } }, z: -1 }
        }
    }
}, {
    markup: Gate.prototype.markup.concat([gateMarkup()]),
    _gateParams: Gate.prototype._gateParams.concat(['bits'])
});

// Single-input gate model
export const Gate11 = GateSVG.define('Gate11', {}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: bits }
        ];
        
        GateSVG.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits({ in: bits, out: bits });
        });
    }
});

// Multi-input gate model
export const GateX1 = GateSVG.define('GateX1', {
    /* default properties */
    inputs: 2,

    attrs: {
        gate: {
            'vector-effect': 'non-scaling-stroke'
        },
        xor_arc: {
            'vector-effect': 'non-scaling-stroke'
        },
        neg_bubble: {
            'vector-effect': 'non-scaling-stroke'
        }
    }
}, {
    initialize() {
        const bits = this.get('bits');
        const inputs = this.get('inputs');

        const ports = [];
        for (let i = 1; i <= inputs; i++)
            ports.push({ id: 'in' + i, group: 'in', dir: 'in', bits: bits });
        ports.push({ id: 'out', group: 'out', dir: 'out', bits: bits });
        this.get('ports').items = ports;
        const scaling = (inputs * 16) / 40;
        const svgscaling = (inputs * 16 + 8) / 40;
        this.set('size', { width: 60 * svgscaling, height: 40 * scaling });
        this.attr('body/transform', 'translate(-4, -4) scale('+svgscaling+')');

        GateSVG.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            const inputs = this.get('inputs');
            const param = { out: bits };
            for (let i = 1; i <= inputs; i++)
                param['in' + i] = bits;
            this._setPortsBits(param);
        });
    },
    operation(data) {
        let ret = data.in1;
        for (let i = 2; i <= this.get('inputs'); i++)
            ret = this.binoperation(ret, data['in' + i]);
        return { out: this.finoperation(ret) };
    },
    finoperation(val) {
        return val
    },
    _gateParams: GateSVG.prototype._gateParams.concat(['inputs']),
    _unsupportedPropChanges: GateSVG.prototype._unsupportedPropChanges.concat(['inputs'])
});

// Reducing gate model
export const GateReduce = GateSVG.define('GateReduce', {}, {
    initialize() {
        const bits = this.get('bits');
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits },
            { id: 'out', group: 'out', dir: 'out', bits: 1 }
        ];
        
        GateSVG.prototype.initialize.apply(this, arguments);
        
        this.on('change:bits', (_, bits) => {
            this._setPortsBits({ in: bits });
        });
    }
});

// Repeater (buffer) gate model
export const Repeater = Gate11.define('Repeater', {
    attrs: { gate: { d: buf_path }}
}, {
    operation(data) {
        return { out: data.in };
    }
});
export const RepeaterView = GateView;

// Not gate model
export const Not = Gate11.define('Not', {
    attrs: { gate: { d: buf_path }}
}, {
    operation(data) {
        return { out: data.in.not() };
    },
    markup: Gate.prototype.markup.concat([gateMarkup([neg_markup])]),
});
export const NotView = GateView;

// Or gate model
export const Or = GateX1.define('Or', {
    attrs: { gate: { d: or_path }}
}, {
    binoperation(in1, in2) {
        return in1.or(in2);
    }
});
export const OrView = GateView;

// And gate model
export const And = GateX1.define('And', {
    attrs: { gate: { d: and_path }}
}, {
    binoperation(in1, in2) {
        return in1.and(in2);
    }
});
export const AndView = GateView;

// Nor gate model
export const Nor = GateX1.define('Nor', {
    attrs: { gate: { d: or_path }}
}, {
    binoperation(in1, in2) {
        return in1.or(in2);
    },
    finoperation(val) {
        return val.not();
    },
    markup: Gate.prototype.markup.concat([gateMarkup([neg_markup])]),
});
export const NorView = GateView;

// Nand gate model
export const Nand = GateX1.define('Nand', {
    attrs: { gate: { d: and_path }}
}, {
    binoperation(in1, in2) {
        return in1.and(in2);
    },
    finoperation(val) {
        return val.not();
    },
    markup: Gate.prototype.markup.concat([gateMarkup([neg_markup])]),
});
export const NandView = GateView;

// Xor gate model
export const Xor = GateX1.define('Xor', {
    attrs: { gate: { d: or_path }}
}, {
    binoperation(in1, in2) {
        return in1.xor(in2);
    },
    markup: Gate.prototype.markup.concat([gateMarkup([xor_arc_path_markup])]),
});
export const XorView = GateView;

// Xnor gate model
export const Xnor = GateX1.define('Xnor', {
    attrs: { gate: { d: or_path }}
}, {
    binoperation(in1, in2) {
        return in1.xor(in2);
    },
    finoperation(val) {
        return val.not();
    },
    markup: Gate.prototype.markup.concat([gateMarkup([xor_arc_path_markup, neg_markup])]),
});
export const XnorView = GateView;

// Reducing Or gate model
export const OrReduce = GateReduce.define('OrReduce', {
    attrs: { gate: { d: or_path }}
}, {
    operation(data) {
        return { out: data.in.reduceOr() };
    }
});
export const OrReduceView = GateView;

// Reducing Nor gate model
export const NorReduce = GateReduce.define('NorReduce', {
    attrs: { gate: { d: or_path }}
}, {
    operation(data) {
        return { out: data.in.reduceNor() };
    },
    markup: GateReduce.prototype.markup.concat([neg_markup])
});
export const NorReduceView = GateView;

// Reducing And gate model
export const AndReduce = GateReduce.define('AndReduce', {
    attrs: { gate: { d: and_path }}
}, {
    operation(data) {
        return { out: data.in.reduceAnd() };
    }
});
export const AndReduceView = GateView;

// Reducing Nand gate model
export const NandReduce = GateReduce.define('NandReduce', {
    attrs: { gate: { d: and_path }}
}, {
    operation(data) {
        return { out: data.in.reduceNand() };
    },
    markup: Gate.prototype.markup.concat([gateMarkup([neg_markup])]),
});
export const NandReduceView = GateView;

// Reducing Xor gate model
export const XorReduce = GateReduce.define('XorReduce', {
    attrs: { gate: { d: or_path }}
}, {
    operation(data) {
        return { out: data.in.reduceXor() };
    },
    markup: Gate.prototype.markup.concat([gateMarkup([xor_arc_path_markup])]),
});
export const XorReduceView = GateView;

// Reducing Xnor gate model
export const XnorReduce = GateReduce.define('XnorReduce', {
    attrs: { gate: { d: or_path }}
}, {
    operation(data) {
        return { out: data.in.reduceXnor() };
    },
    markup: Gate.prototype.markup.concat([gateMarkup([xor_arc_path_markup, neg_markup])]),
});
export const XnorReduceView = GateView;

