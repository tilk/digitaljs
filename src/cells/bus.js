"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Bit extending
joint.shapes.digital.Gate.define('digital.BitExtend', {
    propagation: 0,
    attrs: {
        "text.value": {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        console.assert(args.extend.input <= args.extend.output);
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.extend.input}),
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.extend.output}),
            '<g class="scalable"><rect class="body"/></g><text class="label"/>',
            '<text class="value"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const ex = this.get('extend');
        return { out: data.in.concat(Array(ex.output - ex.input).fill(this.extbit(data.in))) };
    }
});

joint.shapes.digital.BitExtend.define('digital.ZeroExtend', {
    attrs: {
        "text.value": { text: 'zero-extend' }
    }
}, {
    extbit: function(i) {
        return -1;
    }
});

joint.shapes.digital.BitExtend.define('digital.SignExtend', {
    attrs: {
        "text.value": { text: 'sign-extend' }
    }
}, {
    extbit: function(i) {
        return i.slice(-1)[0];
    }
});

// Bus slicing
joint.shapes.digital.Gate.define('digital.BusSlice', {
    propagation: 0,
    size: { width: 40, height: 24 },
    attrs: {
        ".body": {
            size: { width: 40, height: 24 }
        },
        "text.value": {
            text: '',
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        const markup = [];
        args.bits = 0;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.slice.total}),
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.slice.count}),
            '<g class="scalable"><rect class="body"/></g><text class="label"/>',
            '<text class="value"/>',
            '</g>'
        ].join('');
        const val = args.slice.count == 1 ? args.slice.first : 
            args.slice.first + "-" + (args.slice.first + args.slice.count - 1);
        _.set(args, ["attrs", "text.value", "text"], '[' + val + ']');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const s = this.get('slice');
        return { out: data.in.slice(s.first, s.first + s.count) };
    }
});

// Bus grouping
joint.shapes.digital.Gate.define('digital.BusRegroup', {
    propagation: 0,
}, {
    constructor: function(args) {
        const markup = [];
        args.bits = 0;
        markup.push('<g class="rotatable">');
        const size = { width: 40, height: args.groups.length*16+8 };
        _.set(args, ['attrs', '.body'], size);
        args.size = size;
        for (const [num, gbits] of args.groups.entries()) {
            const y = num*16+12;
            args.bits += gbits;
            markup.push(this.addWire(args, this.group_dir == 'out' ? 'right' : 'left', y,
                { id: this.group_dir + num, dir: this.group_dir, bits: gbits }));
        }
        const contra = this.group_dir == 'out' ? 'in' : 'out';
        markup.push(this.addWire(args, this.group_dir == 'out' ? 'left' : 'right', 0.5,
            { id: contra, dir: contra, bits: args.bits }));
        markup.push('<g class="scalable"><rect class="body"/></g><text class="label"/>');
        markup.push('</g>');
        this.markup = markup.join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});

joint.shapes.digital.BusRegroup.define('digital.BusGroup', {
}, {
    group_dir : 'in',
    operation: function(data) {
        const outdata = [];
        for (const num of this.get('groups').keys()) {
            outdata.push(data['in' + num]);
        }
        return { out : _.flatten(outdata) };
    }
});
joint.shapes.digital.BusGroupView = joint.shapes.digital.GateView;

joint.shapes.digital.BusRegroup.define('digital.BusUngroup', {
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
joint.shapes.digital.BusUngroupView = joint.shapes.digital.GateView;

