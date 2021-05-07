"use strict";

import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import * as help from '../help';
import { Vector3vl } from '3vl';

// Bit extending
export const BitExtend = Box.define('BitExtend', {
    /* default properties */
    extend: { input: 1, output: 1 },
    propagation: 0,
    
    attrs: {
        value: {
            refX: .5, refY: .5,
            textAnchor: 'middle', textVerticalAnchor: 'middle'
        }
    }
}, {
    initialize() {
        const extend = this.get('extend');
        console.assert(extend.input <= extend.output);
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: extend.input },
            { id: 'out', group: 'out', dir: 'out', bits: extend.output }
        ];
        
        Box.prototype.initialize.apply(this, arguments);
        
        this.on('change:extend', (_, extend) => {
            this._setPortsBits({ in: extend.input, out: extend.output });
        });
    },
    operation(data) {
        const ex = this.get('extend');
        return { out: data.in.concat(Vector3vl.make(ex.output - ex.input, this._extBit(data.in))) };
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'text',
            className: 'value',
            selector: 'value'
        }
    ]),
    _gateParams: Box.prototype._gateParams.concat(['extend'])
});
export const BitExtendView = BoxView.extend({
    _autoResizeBox: true,
    _calculateBoxWidth() {
        const text = this.el.querySelector('text.value');
        return text.getBBox().width + 10;
    }
});

export const ZeroExtend = BitExtend.define('ZeroExtend', {
    attrs: {
        value: { text: 'zero-extend' }
    }
}, {
    _extBit(i) {
        return -1;
    }
});
export const ZeroExtendView = BitExtendView;

export const SignExtend = BitExtend.define('SignExtend', {
    attrs: {
        value: { text: 'sign-extend' }
    }
}, {
    _extBit(i) {
        return i.get(i.bits - 1);
    }
});
export const SignExtendView = BitExtendView;

// Bus slicing
export const BusSlice = Box.define('BusSlice', {
    /* default properties */
    slice: { first: 0, count: 1, total: 2 },
    propagation: 0,
    
    size: { width: 40, height: 24 }
}, {
    initialize() {
        const slice = this.get('slice');
        
        const val = slice.count == 1 ? slice.first : 
            slice.first + "-" + (slice.first + slice.count - 1);
        
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: slice.total },
            { id: 'out', group: 'out', dir: 'out', bits: slice.count, portlabel: val, labelled: true }
        ];
        
        Box.prototype.initialize.apply(this, arguments);
        
        this.on('change:slice', (_, slice) => {
            this._setPortsBits({ in: slice.total, out: slice.count });
        });
    },
    operation(data) {
        const s = this.get('slice');
        return { out: data.in.slice(s.first, s.first + s.count) };
    },
    _gateParams: Box.prototype._gateParams.concat(['slice'])
});
export const BusSliceView = BoxView.extend({
    _autoResizeBox: true
});

// Bus grouping
export const BusRegroup = Box.define('BusRegroup', {
    /* default properties */
    groups: [1],
    propagation: 0,

    size: { width: 40, height: undefined }
}, {
    initialize() {
        var bits = 0;
        const ports = [];
        const groups = this.get('groups');
        
        this.get('size').height = groups.length*16+8;
        
        for (const [num, gbits] of groups.entries()) {
            const lbl = bits + (gbits > 1 ? '-' + (bits + gbits - 1) : '');
            bits += gbits;
            ports.push({ id: this.group_dir + num, group: this.group_dir, dir: this.group_dir, bits: gbits, portlabel: lbl, labelled: true });
        }
        this.set('bits', bits);
        
        const contra = this.group_dir == 'out' ? 'in' : 'out';
        ports.push({ id: contra, group: contra, dir: contra, bits: bits });
        this.get('ports').items = ports;
        
        Box.prototype.initialize.apply(this, arguments);
    },
    _gateParams: Box.prototype._gateParams.concat(['groups']),
    _unsupportedPropChanges: Box.prototype._unsupportedPropChanges.concat(['groups'])
});
export const BusRegroupView = BoxView.extend({
    _autoResizeBox: true
});

export const BusGroup = BusRegroup.define('BusGroup', {
}, {
    group_dir : 'in',
    operation(data) {
        const outdata = [];
        for (const num of this.get('groups').keys()) {
            outdata.push(data['in' + num]);
        }
        return { out : Vector3vl.concat(...outdata) };
    }
});
export const BusGroupView = BusRegroupView;

export const BusUngroup = BusRegroup.define('BusUngroup', {
}, {
    group_dir : 'out',
    operation(data) {
        const outdata = {};
        let pos = 0;
        for (const [num, gbits] of this.get('groups').entries()) {
            outdata['out' + num] = data.in.slice(pos, pos + gbits);
            pos += gbits;
        }
        return outdata;
    }
});
export const BusUngroupView = BusRegroupView;

