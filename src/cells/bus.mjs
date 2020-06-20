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
        "text.value": {
            refX: .5, refY: .5,
            textAnchor: 'middle', textVerticalAnchor: 'middle'
        }
    }
}, {
    initialize: function() {
        Box.prototype.initialize.apply(this, arguments);
        
        const extend = this.get('extend');
        
        console.assert(extend.input <= extend.output);
        
        this.addPorts([
            { id: 'in', group: 'in', dir: 'in', bits: extend.input },
            { id: 'out', group: 'out', dir: 'out', bits: extend.output }
        ]);
        
        this.on('change:extend', (_, extend) => {
            this.setPortBits('in', extend.input);
            this.setPortBits('out', extend.output);
        });
    },
    operation: function(data) {
        const ex = this.get('extend');
        return { out: data.in.concat(Vector3vl.make(ex.output - ex.input, this.extbit(data.in))) };
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'text',
            className: 'value'
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
        "text.value": { text: 'zero-extend' }
    }
}, {
    extbit: function(i) {
        return -1;
    }
});
export const ZeroExtendView = BitExtendView;

export const SignExtend = BitExtend.define('SignExtend', {
    attrs: {
        "text.value": { text: 'sign-extend' }
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
        Box.prototype.initialize.apply(this, arguments);
        
        const slice = this.get('slice');
        
        const val = slice.count == 1 ? slice.first : 
            slice.first + "-" + (slice.first + slice.count - 1);
        
        this.addPort({ id: 'in', group: 'in', dir: 'in', bits: slice.total });
        this.addPort({ id: 'out', group: 'out', dir: 'out', bits: slice.count, portlabel: val }, { labelled: true });
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
    propagation: 0
}, {
    initialize: function() {
        Box.prototype.initialize.apply(this, arguments);
        
        var bits = 0;
        const groups = this.get('groups');
        
        const size = { width: 40, height: groups.length*16+8 };
        this.set('size', size);
        
        for (const [num, gbits] of groups.entries()) {
            const lbl = bits + (gbits > 1 ? '-' + (bits + gbits - 1) : '');
            bits += gbits;
            this.addPort({ id: this.group_dir + num, group: this.group_dir, dir: this.group_dir, bits: gbits, portlabel: lbl }, { labelled: true });
        }
        this.set('bits', bits);
        
        const contra = this.group_dir == 'out' ? 'in' : 'out';
        this.addPort({ id: contra, group: contra, dir: contra, bits: bits });
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

