"use strict";

import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
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
    initialize: function() {
        const extend = this.get('extend');
        console.assert(extend.input <= extend.output);
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: extend.input },
            { id: 'out', group: 'out', dir: 'out', bits: extend.output }
        ];
        
        Box.prototype.initialize.apply(this, arguments);
        
        this.on('change:extend', (_, extend) => {
            this.setPortsBits({ in: extend.input, out: extend.output });
        });
    },
    operation: function(data) {
        const ex = this.get('extend');
        return { out: data.in.concat(Vector3vl.make(ex.output - ex.input, this.extbit(data.in))) };
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'text',
            className: 'value',
            selector: 'value'
        }
    ]),
    gateParams: Box.prototype.gateParams.concat(['extend'])
});
export const BitExtendView = BoxView.extend({
    autoResizeBox: true,
    calculateBoxWidth: function() {
        const text = this.el.querySelector('text.value');
        return text.getBBox().width + 10;
    }
});

export const ZeroExtend = BitExtend.define('ZeroExtend', {
    attrs: {
        value: { text: 'zero-extend' }
    }
}, {
    extbit: function(i) {
        return -1;
    }
});
export const ZeroExtendView = BitExtendView;

export const SignExtend = BitExtend.define('SignExtend', {
    attrs: {
        value: { text: 'sign-extend' }
    }
}, {
    extbit: function(i) {
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
    initialize: function() {
        const slice = this.get('slice');
        
        const val = slice.count == 1 ? slice.first : 
            slice.first + "-" + (slice.first + slice.count - 1);
        
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: slice.total },
            { id: 'out', group: 'out', dir: 'out', bits: slice.count, portlabel: val, labelled: true }
        ];
        
        Box.prototype.initialize.apply(this, arguments);
        
        this.on('change:slice', (_, slice) => {
            this.setPortsBits({ in: slice.total, out: slice.count });
        });
    },
    operation: function(data) {
        const s = this.get('slice');
        return { out: data.in.slice(s.first, s.first + s.count) };
    },
    gateParams: Box.prototype.gateParams.concat(['slice'])
});
export const BusSliceView = BoxView.extend({
    autoResizeBox: true
});

// Bus grouping
export const BusRegroup = Box.define('BusRegroup', {
    /* default properties */
    groups: [1],
    propagation: 0,

    size: { width: 40, height: undefined }
}, {
    initialize: function() {
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
    gateParams: Box.prototype.gateParams.concat(['groups']),
    unsupportedPropChanges: Box.prototype.unsupportedPropChanges.concat(['groups'])
});
export const BusRegroupView = BoxView.extend({
    autoResizeBox: true
});

export const BusGroup = BusRegroup.define('BusGroup', {
}, {
    group_dir : 'in',
    operation: function(data) {
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
    operation: function(data) {
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

