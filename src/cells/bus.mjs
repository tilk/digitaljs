"use strict";

import * as joint from 'jointjs';
import { Gate, GateView, Box, BoxView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

// Bit extending
export const BitExtend = Gate.define('BitExtend', {
    propagation: 0,
    attrs: {
        "text.value": {
            fill: 'black',
            'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        console.assert(args.extend.input <= args.extend.output);
        this.markup = [
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.extend.input}),
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.extend.output}),
            '<rect class="body"/><text class="label"/>',
            '<text class="value"/>',
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const ex = this.get('extend');
        return { out: data.in.concat(Vector3vl.make(ex.output - ex.input, this.extbit(data.in))) };
    },
    gateParams: Gate.prototype.gateParams.concat(['extend'])
});
export const BitExtendView = GateView;

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
    propagation: 0,
    size: { width: 40, height: 24 },
}, {
    constructor: function(args) {
        const lblmarkup = [];
        const markup = [];
        args.bits = 0;
        const val = args.slice.count == 1 ? args.slice.first : 
            args.slice.first + "-" + (args.slice.first + args.slice.count - 1);
        this.markup = [
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.slice.total}),
            this.addLabelledWire(args, lblmarkup, 'right', 0.5, { id: 'out', dir: 'out', bits: args.slice.count, label: val}),
            '<rect class="body"/><text class="label"/>',
            lblmarkup.join(''),
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const s = this.get('slice');
        return { out: data.in.slice(s.first, s.first + s.count) };
    },
    gateParams: Gate.prototype.gateParams.concat(['slice'])
});
export const BusSliceView = BoxView;

// Bus grouping
export const BusRegroup = Box.define('BusRegroup', {
    propagation: 0,
}, {
    constructor: function(args) {
        const markup = [];
        const lblmarkup = [];
        args.bits = 0;
        const size = { width: 40, height: args.groups.length*16+8 };
        args.size = size;
        for (const [num, gbits] of args.groups.entries()) {
            const y = num*16+12;
            const lbl = args.bits + (gbits > 1 ? '-' + (args.bits + gbits - 1) : '');
            args.bits += gbits;
            markup.push(this.addLabelledWire(args, lblmarkup, this.group_dir == 'out' ? 'right' : 'left', y,
                { id: this.group_dir + num, dir: this.group_dir, bits: gbits, label: lbl }));
        }
        const contra = this.group_dir == 'out' ? 'in' : 'out';
        markup.push(this.addWire(args, this.group_dir == 'out' ? 'left' : 'right', 0.5,
            { id: contra, dir: contra, bits: args.bits }));
        markup.push('<rect class="body"/><text class="label"/>');
        markup.push(lblmarkup.join(''));
        this.markup = markup.join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    gateParams: Gate.prototype.gateParams.concat(['groups'])
});
export const BusRegroupView = BoxView;

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

